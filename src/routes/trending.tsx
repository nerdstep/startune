import { HEALTH_LABEL, HEALTH_ORDER } from '@shared/scoring'
import { createFileRoute } from '@tanstack/react-router'
import { FlameIcon, PackageIcon, RefreshCwIcon, StarIcon, TelescopeIcon } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { z } from 'zod'

import { GrowthBadge, PageHeader } from '@/components/bits'
import { MomentumPlot } from '@/components/momentum-plot'
import { RepoTile, useOpenRepo } from '@/components/repo'
import { DORMANT_ALPHA } from '@/components/star-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HEALTH_CHART, HEALTH_CLASS } from '@/lib/palette'
import { useDerived, useDiscover, useStar, type EStar } from '@/lib/queries'
import { useNow } from '@/lib/use-now'
import { ago, fmtNum, fmtPct } from '@/lib/utils'

const Tab = z.enum(['rising', 'releases', 'discover'])
type Tab = z.infer<typeof Tab>

export const Route = createFileRoute('/trending')({
  validateSearch: z.object({ tab: Tab.optional().catch(undefined) }),
  component: Trending,
})

function Trending() {
  const { tab = 'rising' } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <>
      <PageHeader
        title="Trending"
        sub="What's moving in your stars, and what's new in the topics you care about."
      />
      <Tabs value={tab} onValueChange={(v) => void navigate({ search: { tab: v as Tab } })}>
        <TabsList>
          <TabsTrigger value="rising">
            <FlameIcon /> Rising
          </TabsTrigger>
          <TabsTrigger value="releases">
            <PackageIcon /> Fresh releases
          </TabsTrigger>
          <TabsTrigger value="discover">
            <TelescopeIcon /> Discover
          </TabsTrigger>
        </TabsList>
        <TabsContent value="rising">
          <Rising />
        </TabsContent>
        <TabsContent value="releases">
          <Releases />
        </TabsContent>
        <TabsContent value="discover">
          <DiscoverTab />
        </TabsContent>
      </Tabs>
    </>
  )
}

function Rising() {
  const { data, isLoading } = useDerived()
  const open = useOpenRepo()
  const [window, setWindow] = useState<'d7' | 'd30'>('d7')
  const [relative, setRelative] = useState(false)
  const [rowHover, setRowHover] = useState<string | null>(null)
  const delta = useCallback((s: EStar) => s.g[window] ?? 0, [window])

  const rows = useMemo(() => {
    if (!data) {
      return []
    }
    const val = (s: EStar) => {
      if (!data.hasHistory) {
        return s.momentum
      }
      const d = s.g[window] ?? 0
      if (!relative) {
        return d
      }
      const base = s.stars - d
      return base > 50 ? d / base : 0
    }
    return data.stars
      .filter((s) => !s.isArchived)
      .map((s) => ({ s, v: val(s) }))
      .filter((r) => r.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 40)
  }, [data, window, relative])
  const [trails, setTrails] = useState(true)
  // Weekly pace over the 23 days before this week, from the 30-day and 7-day totals (no estimates).
  // Trails only for the ranked repos (the list below), so the field stays calm and the trails tell the leaderboard's story.
  const ranked = useMemo(() => new Set(rows.map((r) => r.s.id)), [rows])
  const tailOf = useCallback(
    (s: EStar) => {
      if (!ranked.has(s.id)) {
        return null
      }
      const { d7, d30, estimated } = s.g
      if (estimated || d7 == null || d30 == null || d30 < d7) {
        return null
      }
      return { stars: s.stars - d7, pace: ((d30 - d7) * 7) / 23 }
    },
    [ranked],
  )

  if (isLoading || !data) {
    return <Skeleton className="h-96" />
  }

  return (
    <div className="space-y-3">
      {!data.hasHistory && (
        <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">
          StarTune records star counts every day. Until it has a week of history, this ranks by
          average stars per day since each repo was created.
        </div>
      )}
      {data.hasHistory && (
        <div className="flex flex-wrap gap-2">
          <Tabs value={window} onValueChange={(v) => setWindow(v as 'd7' | 'd30')}>
            <TabsList>
              <TabsTrigger value="d7">7 days</TabsTrigger>
              <TabsTrigger value="d30">30 days</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={relative ? 'pct' : 'abs'} onValueChange={(v) => setRelative(v === 'pct')}>
            <TabsList>
              <TabsTrigger value="abs">New stars</TabsTrigger>
              <TabsTrigger value="pct">% growth</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}
      {data.hasHistory && (
        <section
          className="overflow-hidden rounded-lg border bg-card"
          aria-labelledby="momentum-title"
        >
          <div className="border-b px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <h2 id="momentum-title" className="panel-title">
                Momentum
              </h2>
              {window === 'd7' && (
                <label
                  htmlFor="pace-trails"
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <Switch
                    id="pace-trails"
                    checked={trails}
                    onCheckedChange={setTrails}
                    aria-label="Show pace trails"
                  />
                  Pace trails
                </label>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Popularity against new stars {window === 'd7' ? 'this week' : 'this month'}. Diagonals
              mark growth rates; above a line is faster.
              {window === 'd7' &&
                trails &&
                " Trails (for the ranked repos below) run from each repo's weekly pace over the previous 23 days to this week: a trail rising into its dot means it's speeding up."}
            </p>
            <ul
              className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"
              aria-label="Colour key"
            >
              {HEALTH_ORDER.filter((hh) => hh !== 'archived').map((hh) => (
                <li key={hh} className="inline-flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{
                      background: HEALTH_CHART[hh],
                      opacity: hh === 'dormant' ? DORMANT_ALPHA : 1,
                    }}
                  />
                  {HEALTH_LABEL[hh]}
                  <span className="font-mono text-[11px]">{HEALTH_CLASS[hh]}</span>
                </li>
              ))}
            </ul>
          </div>
          <MomentumPlot
            stars={data.stars}
            delta={delta}
            windowLabel={window === 'd7' ? '7 days' : '30 days'}
            rates={window === 'd7' ? [0.005, 0.02, 0.1] : [0.02, 0.1, 0.4]}
            labelIds={rows.slice(0, 5).map((r) => r.s.id)}
            pinnedId={rowHover}
            onOpen={open}
            tailOf={window === 'd7' && trails ? tailOf : null}
          />
        </section>
      )}
      <Card className="gap-0 divide-y py-0">
        {rows.map(({ s, v }, i) => (
          <button
            key={s.id}
            onClick={() => open(s.id)}
            onMouseEnter={() => setRowHover(s.id)}
            onMouseLeave={() => setRowHover(null)}
            onFocus={() => setRowHover(s.id)}
            onBlur={() => setRowHover(null)}
            className="group grid grid-cols-[1.75rem_1fr_auto] items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 first:rounded-t-lg last:rounded-b-lg hover:bg-accent/40 md:grid-cols-[1.75rem_minmax(0,1fr)_11rem_9.5rem_6rem] lg:grid-cols-[1.75rem_minmax(0,1fr)_16rem_9.5rem_6rem]"
          >
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="flex min-w-0 items-center gap-2 truncate text-sm">
                <span
                  aria-hidden
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={
                    s.health === 'archived'
                      ? { boxShadow: `inset 0 0 0 1.5px ${HEALTH_CHART[s.health]}` }
                      : {
                          background: HEALTH_CHART[s.health],
                          opacity: s.health === 'dormant' ? DORMANT_ALPHA : 1,
                        }
                  }
                />
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">{s.owner}/</span>
                  <span className="font-medium underline-offset-2 group-hover:underline">
                    {s.name}
                  </span>
                </span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">{s.description}</span>
            </span>
            <SpectralBar value={rows[0] ? v / rows[0].v : 0} />
            <span className="hidden text-right font-mono text-[11px] text-muted-foreground tabular-nums md:block">
              {fmtNum(s.stars)} total
              {/* The readout carries whichever number the ranked value does not. */}
              {data.hasHistory ? readout(s.g[window] ?? 0, s.stars, relative) : ''}
            </span>
            <span className="text-right text-sm tabular-nums">
              <RankValue
                v={v}
                hasHistory={data.hasHistory}
                relative={relative}
                estimated={s.g.estimated}
                label={window === 'd7' ? '7d' : '30d'}
              />
            </span>
          </button>
        ))}
        {rows.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">Nothing is growing yet.</p>
        )}
      </Card>
    </div>
  )
}

/** The readout carries whichever number the ranked value does not: new stars, or % growth. */
function readout(gained: number, stars: number, relative: boolean): string {
  if (gained <= 0) {
    return ''
  }
  if (relative) {
    return ` · +${fmtNum(gained)} new`
  }
  const before = stars - gained
  return before > 0 ? ` · ${((gained / before) * 100).toFixed(1)}%` : ''
}

/** The ranked value: stars/day without history, else % growth or new stars in the window. */
function RankValue({
  v,
  hasHistory,
  relative,
  estimated,
  label,
}: {
  v: number
  hasHistory: boolean
  relative: boolean
  estimated: boolean
  label: string
}) {
  if (!hasHistory) {
    return <span>{v.toFixed(1)}/day</span>
  }
  if (relative) {
    return <span>{fmtPct(v)}</span>
  }
  return <GrowthBadge d={v} estimated={estimated} label={label} />
}

/** Stellar spectrum, cool to hot: M red, K orange, G yellow, A/F white, O/B blue (palette.ts). */
const SPECTRUM = `linear-gradient(90deg, ${HEALTH_CHART.archived}, ${HEALTH_CHART.dormant} 25%, ${HEALTH_CHART.quiet} 50%, ${HEALTH_CHART.active} 72%, ${HEALTH_CHART.thriving})`
const LINES = 'repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 3px)'

/**
 * Magnitude as a spectral bar: fine lines on a fixed cool-to-hot spectrum. Length is the value; how far the
 * bar reaches into the spectrum repeats it, so the fastest risers burn blue-white and slow ones stay red.
 */
function SpectralBar({ value }: { value: number }) {
  const f = Math.max(0.04, Math.min(1, value))
  const lines = { maskImage: LINES, WebkitMaskImage: LINES }
  return (
    <span className="relative hidden h-2.5 md:block" aria-hidden>
      <span
        className="absolute inset-0 opacity-15"
        style={{ backgroundImage: SPECTRUM, ...lines }}
      />
      <span
        className="absolute inset-y-0 left-0"
        style={{
          width: `${f * 100}%`,
          backgroundImage: SPECTRUM,
          backgroundSize: `${100 / f}% 100%`,
          ...lines,
        }}
      />
    </span>
  )
}

function Releases() {
  const { data, isLoading } = useDerived()
  const open = useOpenRepo()
  const now = useNow()
  const rows = useMemo(
    () =>
      (data?.stars ?? [])
        .filter(
          (s): s is EStar & { latestReleaseAt: string } =>
            s.latestReleaseAt !== null &&
            now - new Date(s.latestReleaseAt).getTime() < 45 * 86_400_000,
        )
        .sort((a, b) => b.latestReleaseAt.localeCompare(a.latestReleaseAt)),
    [data, now],
  )
  if (isLoading) {
    return <Skeleton className="h-96" />
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((s) => (
        <RepoTile
          key={s.id}
          s={s}
          onClick={() => open(s.id)}
          footer={
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-foreground/85">
                <PackageIcon /> {s.latestReleaseTag}
              </Badge>
              <span className="text-xs text-muted-foreground">{ago(s.latestReleaseAt)}</span>
            </div>
          }
        />
      ))}
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">No releases in the last 45 days.</p>
      )}
    </div>
  )
}

function DiscoverTab() {
  const q = useDiscover()
  const star = useStar()
  const [starred, setStarred] = useState<Set<string>>(new Set())
  if (q.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    )
  }
  if (q.error) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Couldn't search GitHub right now.{' '}
        <Button variant="link" onClick={() => void q.refetch()}>
          <RefreshCwIcon /> Retry
        </Button>
      </div>
    )
  }
  const groups = q.data?.groups ?? []
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        New repos (last 4 months, 50+ stars) in your most-starred topics, skipping ones you already
        starred.
      </p>
      {groups.map((g) => (
        <section key={g.topic}>
          <h3 className="mb-3 text-sm font-semibold">
            <span className="text-muted-foreground">#</span>
            {g.topic}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.repos.map((r) => (
              <RepoTile
                key={r.id}
                s={r}
                onClick={() => window.open(r.url, '_blank', 'noopener')}
                footer={
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      created {ago(r.createdAt)}
                    </span>
                    <Button
                      size="sm"
                      className="relative z-1"
                      variant={starred.has(r.id) ? 'outline' : 'default'}
                      disabled={starred.has(r.id)}
                      onClick={(e) => {
                        e.stopPropagation()
                        star.mutate([r.id])
                        setStarred((s) => new Set(s).add(r.id))
                      }}
                    >
                      <StarIcon /> {starred.has(r.id) ? 'Starred' : `Star · ${fmtNum(r.stars)}`}
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
        </section>
      ))}
      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Add topics to your stars (sync first) to get recommendations.
        </p>
      )}
    </div>
  )
}
