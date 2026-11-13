import { HEALTH_LABEL, HEALTH_ORDER, type Health } from '@shared/scoring'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowRightIcon,
  BrainCircuitIcon,
  ShuffleIcon,
  StarIcon,
  TrendingUpIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { PageHeader } from '@/components/bits'
import { useOpenRepo } from '@/components/repo'
import { SyncButton } from '@/components/shell'
import { DORMANT_ALPHA, StarField } from '@/components/star-field'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { HEALTH_CHART, HEALTH_CLASS } from '@/lib/palette'
import { useDerived, type EStar } from '@/lib/queries'
import { useSyncContext } from '@/lib/sync-context'
import { ago, cn, fmtNum } from '@/lib/utils'

export const Route = createFileRoute('/')({ component: Overview })

function Overview() {
  const { data, isLoading } = useDerived()
  const navigate = useNavigate()
  const open = useOpenRepo()
  const [shuffle, setShuffle] = useState(0)
  const [focusHealth, setFocusHealth] = useState<Health | null>(null)

  const stats = useMemo(() => {
    if (!data) {
      return null
    }
    const s = data.stars
    const listed = s.filter((x) => x.listIds.length > 0).length
    const cruft = s.filter((x) => x.isCruft).length
    const growing = s.filter((x) => (x.g.d7 ?? 0) > 0).length
    const oldest = s.reduce(
      (a, b) => (a && a.starredAt < b.starredAt ? a : b),
      s[0] as EStar | undefined,
    )
    const health = new Map<Health, number>(HEALTH_ORDER.map((h) => [h, 0]))
    for (const x of s) {
      health.set(x.health, (health.get(x.health) ?? 0) + 1)
    }
    return { total: s.length, listed, unlisted: s.length - listed, cruft, growing, oldest, health }
  }, [data])

  const gems = useMemo(() => {
    if (!data) {
      return []
    }
    const pool = data.stars
      .filter((s) => s.rediscover > 0 && !s.snoozed)
      .sort((a, b) => b.rediscover - a.rediscover)
      .slice(0, 30)
    const start = (shuffle * 5) % Math.max(pool.length, 1)
    return [...pool.slice(start), ...pool.slice(0, start)].slice(0, 5)
  }, [data, shuffle])

  const hot = useMemo(() => {
    if (!data) {
      return []
    }
    const key = (s: EStar) => (data.hasHistory ? (s.g.d7 ?? 0) : s.momentum)
    return [...data.stars]
      .filter((s) => !s.isArchived)
      .sort((a, b) => key(b) - key(a))
      .slice(0, 5)
  }, [data])

  if (isLoading || !data || !stats) {
    return <OverviewSkeleton />
  }
  if (stats.total === 0) {
    return <FirstRun />
  }

  const listedPct = Math.round((stats.listed / stats.total) * 100)
  const since = stats.oldest ? new Date(stats.oldest.starredAt).getFullYear() : '—'

  return (
    <>
      <PageHeader
        title="Overview"
        sub={`${stats.total.toLocaleString()} stars charted since ${since} · synced ${ago(data.library.lastSyncedAt)}`}
      >
        <Button variant="outline" nativeButton={false} render={<Link to="/map" />}>
          Open star map
        </Button>
        <Button nativeButton={false} render={<Link to="/triage" search={{ mode: 'cruft' }} />}>
          Start triage <ArrowRightIcon />
        </Button>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <section
          className="overflow-hidden rounded-lg border bg-card"
          aria-labelledby="field-title"
        >
          <div className="flex flex-wrap items-stretch border-b">
            <h2
              id="field-title"
              className="panel-title flex basis-full items-center px-4 py-3 md:basis-auto md:min-w-36"
            >
              Star field
            </h2>
            <Readout label="Stars" value={fmtNum(stats.total)} to="/stars" />
            <Readout
              label="In Lists"
              value={`${listedPct}%`}
              detail={`${stats.unlisted.toLocaleString()} unlisted`}
              to="/stars"
              search={{ list: 'none' }}
            />
            <Readout
              label="Likely cruft"
              value={fmtNum(stats.cruft)}
              to="/triage"
              search={{ mode: 'cruft' }}
              tone="warning"
            />
            <Readout
              label={data.hasHistory ? 'Growing this week' : 'Growing'}
              value={data.hasHistory ? fmtNum(stats.growing) : '—'}
              detail={data.hasHistory ? undefined : 'needs a few days of history'}
              to="/trending"
            />
          </div>
          <StarField stars={data.stars} onOpen={open} height={540} focusHealth={focusHealth} />
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t px-4 py-2.5 text-xs text-muted-foreground">
            <span>
              {focusHealth
                ? `Showing ${HEALTH_LABEL[focusHealth].toLowerCase()} stars (class ${HEALTH_CLASS[focusHealth]})`
                : 'Size is popularity. Nearer means pushed more recently.'}
            </span>
            <span className="ml-auto hidden sm:inline">
              Drag or arrow keys to orbit · [ ] to step through stars · Enter or click to open
            </span>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-lg border bg-card" aria-labelledby="class-title">
            <div className="border-b px-4 py-3">
              <h2 id="class-title" className="panel-title">
                Health by class
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Hover a class to isolate it in the field
              </p>
            </div>
            <ul className="divide-y">
              {HEALTH_ORDER.map((h) => {
                const n = stats.health.get(h) ?? 0
                return (
                  <li key={h}>
                    <button
                      onClick={() => void navigate({ to: '/stars', search: { health: h } })}
                      onMouseEnter={() => setFocusHealth(h)}
                      onMouseLeave={() => setFocusHealth(null)}
                      onFocus={() => setFocusHealth(h)}
                      onBlur={() => setFocusHealth(null)}
                      aria-label={`${HEALTH_LABEL[h]}, class ${HEALTH_CLASS[h]}: ${n} stars. Open in Stars.`}
                      className="group flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
                    >
                      <span className="w-7 font-mono text-[11px] text-muted-foreground">
                        {HEALTH_CLASS[h]}
                      </span>
                      <span
                        className="size-2 rounded-full"
                        style={
                          h === 'archived'
                            ? { boxShadow: `inset 0 0 0 1.5px ${HEALTH_CHART[h]}` }
                            : {
                                background: HEALTH_CHART[h],
                                opacity: h === 'dormant' ? DORMANT_ALPHA : 1,
                              }
                        }
                      />
                      <span className="flex-1">{HEALTH_LABEL[h]}</span>
                      <span className="tabular-nums">{n}</span>
                    </button>
                    <div className="mx-4 mb-2 h-px bg-grid">
                      <div
                        className="h-px"
                        style={{
                          width: `${(n / stats.total) * 100}%`,
                          background: HEALTH_CHART[h],
                        }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
          <AiCallout />
        </aside>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border bg-card" aria-labelledby="hot-title">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 id="hot-title" className="panel-title">
                Brightening
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data.hasHistory
                  ? 'Most new stars in the last 7 days'
                  : 'Fastest-growing since creation'}
              </p>
            </div>
            <Link to="/trending" className="text-xs text-muted-foreground hover:text-foreground">
              All trending <ArrowRightIcon className="inline size-3.5" />
            </Link>
          </div>
          <ol className="divide-y">
            {hot.map((s, i) => (
              <li key={s.id}>
                <button
                  onClick={() => open(s.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent/60"
                >
                  <span className="w-4 font-mono text-[11px] text-muted-foreground">{i + 1}</span>
                  <ClassDot health={s.health} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-muted-foreground">{s.owner}/</span>
                    <span className="font-medium">{s.name}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <TrendingUpIcon className="size-3.5 text-muted-foreground" />
                    {data.hasHistory ? `+${fmtNum(s.g.d7 ?? 0)}` : `${s.momentum.toFixed(1)}/day`}
                  </span>
                  <span className="hidden w-16 items-center justify-end gap-1 text-xs text-muted-foreground tabular-nums sm:inline-flex">
                    <StarIcon className="size-3" />
                    {fmtNum(s.stars)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-lg border bg-card" aria-labelledby="gems-title">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h2 id="gems-title" className="panel-title">
                Forgotten gems
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Starred long ago, still alive, never revisited
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setShuffle((n) => n + 1)}>
              <ShuffleIcon /> Shuffle
            </Button>
          </div>
          <ul className="divide-y">
            {gems.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => open(s.id)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent/60"
                >
                  <ClassDot health={s.health} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-muted-foreground">{s.owner}/</span>
                    <span className="font-medium">{s.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">starred {ago(s.starredAt)}</span>
                </button>
              </li>
            ))}
            {gems.length === 0 && (
              <li className="px-4 py-6 text-sm text-muted-foreground">
                Nothing forgotten right now.
              </li>
            )}
          </ul>
          <Link
            to="/triage"
            search={{ mode: 'rediscover' }}
            className="flex items-center justify-between border-t px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Rediscover them one by one <ArrowRightIcon className="size-4" />
          </Link>
        </section>
      </div>
    </>
  )
}

function ClassDot({ health }: { health: Health }) {
  return (
    <span
      title={`${HEALTH_LABEL[health]} (class ${HEALTH_CLASS[health]})`}
      className="size-2 shrink-0 rounded-full"
      style={
        health === 'archived'
          ? { boxShadow: `inset 0 0 0 1.5px ${HEALTH_CHART[health]}` }
          : { background: HEALTH_CHART[health], opacity: health === 'dormant' ? DORMANT_ALPHA : 1 }
      }
    />
  )
}

function Readout({
  label,
  value,
  detail,
  to,
  search,
  tone,
}: {
  label: string
  value: string
  detail?: string
  to: '/stars' | '/triage' | '/trending'
  search?: Record<string, string>
  tone?: 'warning'
}) {
  return (
    <Link
      to={to}
      search={search as never}
      className="group flex min-w-[50%] flex-1 flex-col justify-center border-t px-4 py-2.5 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none sm:min-w-0 md:border-t-0 md:border-l"
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-2">
        <span
          className={cn(
            'text-xl font-semibold tracking-tight tabular-nums',
            tone === 'warning' && 'text-warning',
          )}
        >
          {value}
        </span>
        {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
      </span>
    </Link>
  )
}

function AiCallout() {
  const { data } = useDerived()
  const { classify } = useSyncContext()
  if (!data) {
    return null
  }
  const unlisted = data.stars.filter((s) => s.listIds.length === 0)
  const pending = unlisted.filter((s) => !s.suggestion).length
  const suggested = unlisted.filter((s) => s.suggestion?.listId).length
  const renderBody = () => {
    if (classify.progress.running) {
      return (
        <div className="mt-3 space-y-2">
          <Progress value={classify.progress.pct} />
          <p className="text-xs text-muted-foreground tabular-nums">{classify.progress.label}</p>
        </div>
      )
    }
    if (pending > 0) {
      return (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Suggest a List and a cruft score for your {pending.toLocaleString()} unlisted repos with
            Cloudflare's Clef model.
          </p>
          <Button
            size="sm"
            className="mt-3"
            variant="outline"
            onClick={() => void classify.run('unlisted')}
            disabled={data.lists.length === 0}
          >
            {data.lists.length === 0 ? 'Create a list first' : 'Suggest lists'}
          </Button>
        </>
      )
    }
    return (
      <>
        <p className="mt-1 text-xs text-muted-foreground">
          {suggested.toLocaleString()} unlisted repos have a suggested List.
        </p>
        <Button
          size="sm"
          className="mt-3"
          variant="outline"
          nativeButton={false}
          render={<Link to="/triage" search={{ mode: 'unlisted' }} />}
        >
          Review suggestions <ArrowRightIcon />
        </Button>
      </>
    )
  }
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="panel-title flex items-center gap-2">
        <BrainCircuitIcon className="size-4 text-muted-foreground" /> Clef suggestions
      </h2>
      {renderBody()}
    </section>
  )
}

function FirstRun() {
  const { sync } = useSyncContext()
  return (
    <div className="grid min-h-[60dvh] place-items-center text-center">
      <div className="max-w-md">
        <svg viewBox="0 0 32 32" aria-hidden className="mx-auto mb-6 size-10">
          <path
            d="M16 3l3.4 8.2 8.6.7-6.6 5.6 2 8.5L16 21.4 8.6 26l2-8.5L4 11.9l8.6-.7z"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        <h1 className="text-2xl font-semibold tracking-tight">Chart your stars</h1>
        <p className="mt-2 text-muted-foreground">
          StarTune reads your stars and Lists from GitHub and plots every one. A few thousand stars
          take under a minute.
        </p>
        <div className="mt-6 flex justify-center">
          {sync.progress.running ? (
            <p className="text-sm tabular-nums">{sync.progress.label}</p>
          ) : (
            <SyncButton />
          )}
        </div>
      </div>
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-48" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
        <Skeleton className="h-150" />
        <Skeleton className="h-90" />
      </div>
    </div>
  )
}
