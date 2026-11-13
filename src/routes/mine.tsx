import type { Signal } from '@shared/own'
import type { Stargazer } from '@shared/schemas'
import { HEALTH_HINT, HEALTH_LABEL, HEALTH_ORDER } from '@shared/scoring'
import { createFileRoute } from '@tanstack/react-router'
import {
  ArchiveIcon,
  ArrowUpRightIcon,
  FileTextIcon,
  GitForkIcon,
  GitPullRequestIcon,
  MessageCircleIcon,
  PackageIcon,
  RefreshCwIcon,
  StarIcon,
  TelescopeIcon,
  XIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { z } from 'zod'

import { PageHeader } from '@/components/bits'
import { HistoryChart, type Range } from '@/components/history-chart'
import { DORMANT_ALPHA } from '@/components/star-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip } from '@/components/ui/tooltip'
import {
  retryCharts,
  useAudience,
  useChartMine,
  useMine,
  useOwnDerived,
  useRefreshMine,
  type ChartRun,
  type EOwn,
} from '@/lib/mine'
import { HEALTH_CHART, HEALTH_CLASS } from '@/lib/palette'
import { useLibrary, useStar } from '@/lib/queries'
import { useNow } from '@/lib/use-now'
import { ago, agoShort, cn, fmtNum } from '@/lib/utils'

const Sort = z.enum(['stars', 'rising', 'attention', 'pushed'])
type Sort = z.infer<typeof Sort>

export const Route = createFileRoute('/mine')({
  validateSearch: z.object({
    repo: z.string().optional().catch(undefined),
    sort: Sort.optional().catch(undefined),
    range: z.enum(['all', '1y', '90d']).optional().catch(undefined),
    forks: z.boolean().optional().catch(undefined),
  }),
  component: MinePage,
})

const ROW = 'md:grid-cols-[2.25rem_minmax(0,1fr)_8.5rem_5.75rem_minmax(0,13rem)_4rem_2rem]'
const DAY = 86_400_000

function MinePage() {
  const q = useMine()
  const refresh = useRefreshMine()
  const chart = useChartMine(q.data)
  const all = useOwnDerived(q.data)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { sort = 'stars', range = 'all', forks = false } = search
  const set = useCallback(
    (s: Partial<typeof search>) =>
      void navigate({ search: (p) => ({ ...p, ...s }), replace: true, resetScroll: false }),
    [navigate],
  )
  const [rowHover, setRowHover] = useState<string | null>(null)

  const repos = useMemo(() => all.filter((r) => forks || !r.isFork), [all, forks])
  const focus = search.repo ? (all.find((r) => r.name === search.repo) ?? null) : null
  const toggleFocus = useCallback(
    (id: string) => {
      const r = all.find((x) => x.id === id)
      set({ repo: r && r.name !== search.repo ? r.name : undefined })
    },
    [all, search.repo, set],
  )

  useEffect(() => {
    if (!focus) {
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) {
        return
      }
      // Leave Esc to fields, menus, dialogs and tooltips that are open or focused.
      const t = e.target instanceof Element ? e.target : null
      if (
        t?.closest(
          'input, textarea, select, [contenteditable], [role=menu], [role=dialog], [role=listbox]',
        ) ||
        document.querySelector('[data-popup-open]')
      ) {
        return
      }
      set({ repo: undefined })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focus, set])

  if (q.isLoading) {
    return (
      <>
        <PageHeader title="Your repos" sub="Reading your public repos from GitHub…" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Skeleton className="h-104" />
          <Skeleton className="h-104" />
        </div>
      </>
    )
  }
  if (q.error || !q.data) {
    return (
      <>
        <PageHeader title="Your repos" />
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Couldn't read your repos from GitHub
          {q.error instanceof Error ? `: ${q.error.message}` : '.'}{' '}
          <Button variant="link" onClick={() => void q.refetch()}>
            <RefreshCwIcon /> Try again
          </Button>
        </div>
      </>
    )
  }

  const login = q.data.login
  const total = repos.reduce((n, r) => n + r.stars, 0)
  const forkCount = all.filter((r) => r.isFork).length
  // The audience sample waits for a first chart of every starred repo, so it isn't cached from partial recents.
  const firstCharting =
    chart.running && repos.some((r) => r.stars > 0 && r.history == null && !chart.failed.has(r.id))
  const hasRecents = repos.some((r) => r.recent.length > 0)

  return (
    <>
      <PageHeader
        title="Your repos"
        sub={
          <>
            Public repos under <span className="text-foreground">@{login}</span>: how they're
            growing, who's starring them, and what's waiting on you.
          </>
        }
      >
        <span className="measure hidden sm:inline">read {ago(q.data.syncedAt)}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
        >
          <RefreshCwIcon className={cn(refresh.isPending && 'animate-spin')} /> Refresh
        </Button>
      </PageHeader>

      {all.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No public repos under @{login} yet. Once you publish one, its stars and upkeep show up
          here.
        </div>
      ) : (
        <div className="space-y-4">
          {focus && (
            <div className="flex items-center gap-3 rounded-lg border border-primary/50 px-4 py-2 text-sm">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              <span className="min-w-0 truncate">
                Focused on <span className="font-medium">{focus.name}</span>
                <span className="text-muted-foreground"> · its trail, upkeep and stargazers</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => set({ repo: undefined })}
              >
                <XIcon /> Clear{' '}
                <kbd className="font-mono text-[11px] text-muted-foreground">Esc</kbd>
              </Button>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <HistoryPanel
              repos={repos}
              total={total}
              range={range}
              setRange={(r) => set({ range: r === 'all' ? undefined : r })}
              focus={focus}
              pinnedId={rowHover}
              onFocus={toggleFocus}
              chart={chart}
              onSort={(v) => {
                set({ sort: v === 'stars' ? undefined : v })
                document
                  .getElementById('repos-title')
                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            />
            <AttentionPanel
              repos={focus ? [focus] : repos}
              focused={Boolean(focus)}
              onFocus={toggleFocus}
            />
          </div>

          <section
            className="overflow-hidden rounded-lg border bg-card"
            aria-labelledby="repos-title"
          >
            <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
              <h2 id="repos-title" className="panel-title mr-auto">
                Repos <span className="measure ml-1">{repos.length}</span>
              </h2>
              {forkCount > 0 && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={forks}
                    onCheckedChange={(v) => set({ forks: v || undefined })}
                    aria-label="Include forks"
                  />
                  Forks <span className="font-mono text-[11px]">{forkCount}</span>
                </label>
              )}
              <Tabs
                value={sort}
                onValueChange={(v) => set({ sort: v === 'stars' ? undefined : (v as Sort) })}
              >
                <TabsList>
                  <TabsTrigger value="stars">Stars</TabsTrigger>
                  <TabsTrigger value="rising">Rising</TabsTrigger>
                  <TabsTrigger value="attention">Needs you</TabsTrigger>
                  <TabsTrigger value="pushed">Pushed</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <RepoTable
              repos={repos}
              sort={sort}
              focusId={focus?.id ?? null}
              onFocus={toggleFocus}
              onHover={setRowHover}
              failed={chart.failed}
            />
            <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
              Weekly bars share one scale (square root, so small repos still register). Click a repo
              to focus the page on it.
            </p>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <StargazersPanel repos={focus ? [focus] : repos} focus={focus} login={login} />
            <AlsoStarredPanel enabled={hasRecents && !firstCharting} waiting={firstCharting} />
          </div>
        </div>
      )}
    </>
  )
}

/** The small line under a repo's star count: its 30-day gain, or why there isn't one yet. */
function gain30Label(r: EOwn, failed: boolean): string {
  if (r.stars === 0) {
    return '—'
  }
  if (failed) {
    return "couldn't chart"
  }
  if (r.history == null) {
    return 'charting…'
  }
  const d30 = r.g.d30 ?? 0
  return d30 > 0 ? `${r.g.estimated ? '≈' : ''}+${fmtNum(d30)} 30d` : '+0 30d'
}

/* ---------- Star history ---------- */

function HistoryPanel({
  repos,
  total,
  range,
  setRange,
  focus,
  pinnedId,
  onFocus,
  chart,
  onSort,
}: {
  repos: EOwn[]
  total: number
  range: Range
  setRange: (r: Range) => void
  focus: EOwn | null
  pinnedId: string | null
  onFocus: (id: string) => void
  chart: ChartRun
  onSort: (s: Sort) => void
}) {
  const now = useNow()
  const subject = focus ? [focus] : repos
  const sum = (k: 'd7' | 'd30') => subject.reduce((n, r) => n + (r.g[k] ?? 0), 0)
  const est30 = subject.some((r) => r.g.estimated && (r.g.d30 ?? 0) > 0)
  // The 7-day window can start in the sampled part too (a repo gaining 100+ stars a week).
  const since7 = now - 7 * DAY
  const est7 = subject.some(
    (r) => r.exactSince != null && r.exactSince > since7 && (r.g.d7 ?? 0) > 0,
  )
  const failed = repos.filter((r) => chart.failed.has(r.id))
  const firstFailed = failed[0]
  const starred = repos.filter((r) => r.stars > 0)
  const sampled = starred.some((r) => r.exactSince != null && r.exactSince > 0)
  return (
    <section
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card"
      aria-labelledby="history-title"
    >
      <div className="flex flex-wrap items-stretch border-b">
        <h2
          id="history-title"
          className="panel-title flex basis-full items-center px-4 py-3 md:min-w-36 md:basis-auto"
        >
          Star history
        </h2>
        <Stat
          label={focus ? focus.name : 'Stars'}
          value={fmtNum(focus ? focus.stars : total)}
          onClick={() => onSort('stars')}
          hint="Sort repos by stars"
        />
        <Stat
          label="Last 30 days"
          value={`${est30 ? '≈' : ''}+${fmtNum(sum('d30'))}`}
          onClick={() => onSort('rising')}
          hint="Sort repos by recent stars"
        />
        <Stat
          label="Last 7 days"
          value={`${est7 ? '≈' : ''}+${fmtNum(sum('d7'))}`}
          onClick={() => onSort('rising')}
          hint="Sort repos by recent stars"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 pt-3">
        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList>
            <TabsTrigger value="all">All time</TabsTrigger>
            <TabsTrigger value="1y">1 year</TabsTrigger>
            <TabsTrigger value="90d">90 days</TabsTrigger>
          </TabsList>
        </Tabs>
        {chart.running && (
          <span
            className="ml-auto flex items-center gap-2 text-xs text-muted-foreground"
            aria-live="polite"
          >
            Charting star history
            <span className="font-mono text-[11px] tabular-nums">
              {chart.done}/{chart.total}
            </span>
            <Progress value={(chart.done / Math.max(1, chart.total)) * 100} className="w-20" />
          </span>
        )}
        {firstFailed && !chart.running && (
          <span className="ml-auto flex items-center gap-1 text-xs text-warning">
            <Tooltip content={chart.failed.get(firstFailed.id) ?? ''}>
              <span>
                {failed.length === 1
                  ? `${firstFailed.name} couldn't be charted`
                  : `${failed.length} repos couldn't be charted`}
              </span>
            </Tooltip>
            <Button variant="link" size="sm" className="h-auto px-1 text-xs" onClick={retryCharts}>
              Retry
            </Button>
          </span>
        )}
      </div>
      {starred.length === 0 ? (
        <p className="flex-1 px-4 py-16 text-center text-sm text-muted-foreground">
          None of your public repos has stars yet. When one does, its history draws here.
        </p>
      ) : (
        <HistoryChart
          repos={repos}
          range={range}
          focusId={focus?.id ?? null}
          pinnedId={pinnedId}
          onFocus={onFocus}
        />
      )}
      <div className="space-y-1.5 border-t px-4 py-2.5 text-xs text-muted-foreground">
        <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Colour key">
          {HEALTH_ORDER.map((hh) => (
            <li key={hh} className="inline-flex items-center gap-1.5">
              <svg width="14" height="6" aria-hidden className="shrink-0">
                <line
                  x1="0"
                  x2="14"
                  y1="3"
                  y2="3"
                  stroke={HEALTH_CHART[hh]}
                  strokeWidth="1.5"
                  strokeDasharray={hh === 'archived' ? '3 2' : undefined}
                  opacity={hh === 'dormant' ? DORMANT_ALPHA : 1}
                />
              </svg>
              {HEALTH_LABEL[hh]}
              <span className="font-mono text-[11px]">{HEALTH_CLASS[hh]}</span>
            </li>
          ))}
        </ul>
        <p>
          Rebuilt from the dates GitHub records for each current stargazer, so unstars drop out.
          {sampled &&
            ' Bigger repos are sampled before their newest 100 stars (≈ marks estimates).'}{' '}
          Click a trail to focus it.
        </p>
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  onClick,
  hint,
}: {
  label: string
  value: string
  onClick: () => void
  hint: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label={`${label}: ${value}. ${hint}`}
      className="flex min-w-0 flex-1 basis-0 flex-col justify-center border-t border-l px-4 py-2.5 text-left transition-colors first-of-type:border-l-0 hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none md:border-t-0 md:first-of-type:border-l"
    >
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold tracking-tight tabular-nums">{value}</span>
    </button>
  )
}

/* ---------- Needs attention ---------- */

const SIGNAL_ICON: Record<Signal['key'], typeof StarIcon> = {
  prs: GitPullRequestIcon,
  issues: MessageCircleIcon,
  revive: TelescopeIcon,
  release: PackageIcon,
  archive: ArchiveIcon,
  hygiene: FileTextIcon,
}

const GROUPS: Array<{ title: string; levels: number[] }> = [
  { title: 'Waiting on you', levels: [2] },
  { title: 'Worth a look', levels: [1] },
  { title: 'Housekeeping', levels: [0] },
]

function AttentionPanel({
  repos,
  focused,
  onFocus,
}: {
  repos: EOwn[]
  focused: boolean
  onFocus: (id: string) => void
}) {
  const [more, setMore] = useState(false)
  const items = useMemo(
    () =>
      repos
        .flatMap((r) => r.signals.map((s) => ({ r, s })))
        .sort((a, b) => b.s.level - a.s.level || b.r.stars - a.r.stars),
    [repos],
  )
  const shown = more ? items : items.slice(0, 8)
  return (
    <section
      className="flex min-w-0 flex-col rounded-lg border bg-card"
      aria-labelledby="attention-title"
    >
      <div className="border-b px-4 py-3">
        <h2 id="attention-title" className="panel-title">
          Needs attention <span className="measure ml-1">{items.length}</span>
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Other people's PRs and issues first, then upkeep. Each links to the place to act.
        </p>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          {focused ? 'Nothing waiting on this repo.' : 'Nothing waiting on you.'}
        </p>
      ) : (
        <div className="flex-1">
          {GROUPS.map((g) => {
            const list = shown.filter((x) => g.levels.includes(x.s.level))
            if (list.length === 0) {
              return null
            }
            return (
              <div key={g.title}>
                <h3 className="px-4 pt-3 pb-1 text-xs font-medium text-muted-foreground">
                  {g.title}
                </h3>
                <ul>
                  {list.map(({ r, s }) => {
                    const Icon = SIGNAL_ICON[s.key]
                    return (
                      <li
                        key={`${r.id}${s.key}`}
                        className="group flex items-start gap-2.5 px-4 py-1.5 hover:bg-accent/40"
                      >
                        <Icon
                          className={cn(
                            'mt-0.5 size-3.5 shrink-0',
                            s.level === 2 ? 'text-foreground' : 'text-muted-foreground',
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1 text-[13px] leading-snug">
                          {!focused && (
                            <button
                              className="mr-1.5 font-medium hover:underline"
                              onClick={() => onFocus(r.id)}
                            >
                              {r.name}
                            </button>
                          )}
                          <span className={focused ? 'font-medium' : undefined}>{s.label}</span>
                          <span className="block text-xs text-muted-foreground">{s.detail}</span>
                        </div>
                        <a
                          href={s.href}
                          target="_blank"
                          rel="noopener"
                          className="mt-0.5 rounded-sm p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                          aria-label={`${s.label} on GitHub (${r.name})`}
                        >
                          <ArrowUpRightIcon className="size-3.5" />
                        </a>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
          {items.length > 8 && (
            <div className="px-4 pt-1 pb-3">
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0 text-xs"
                onClick={() => setMore((m) => !m)}
              >
                {more ? 'Show fewer' : `Show all ${items.length}`}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/* ---------- Repos table ---------- */

function RepoTable({
  repos,
  sort,
  focusId,
  onFocus,
  onHover,
  failed,
}: {
  repos: EOwn[]
  sort: Sort
  focusId: string | null
  onFocus: (id: string) => void
  onHover: (id: string | null) => void
  failed: ReadonlyMap<string, string>
}) {
  const rows = useMemo(() => {
    const key: Record<Sort, (r: EOwn) => number> = {
      stars: (r) => r.stars,
      rising: (r) => r.g.d30 ?? -1,
      attention: (r) => r.attention * 1e7 + r.stars,
      pushed: (r) => (r.pushedAt ? new Date(r.pushedAt).getTime() : 0),
    }
    return [...repos].sort((a, b) => key[sort](b) - key[sort](a) || b.stars - a.stars)
  }, [repos, sort])
  const peak = useMemo(() => Math.max(1, ...repos.flatMap((r) => r.weeks.map(Math.round))), [repos])

  return (
    <div role="table" aria-label="Your repos">
      <div
        role="row"
        className={cn(
          'hidden items-center gap-3 border-b px-4 py-2 text-xs text-muted-foreground md:grid',
          ROW,
        )}
      >
        <span role="columnheader">Class</span>
        <span role="columnheader">Repo</span>
        <span role="columnheader">Stars a week, 26 wk</span>
        <span role="columnheader" className="text-right">
          Stars
        </span>
        <span role="columnheader">Needs</span>
        <span role="columnheader" className="text-right">
          Pushed
        </span>
        <span role="columnheader" aria-label="Open on GitHub" />
      </div>
      <div role="rowgroup" className="divide-y">
        {rows.map((r) => {
          const on = r.id === focusId
          const top = [...r.signals].sort((a, b) => b.level - a.level)
          return (
            <div
              key={r.id}
              role="row"
              onMouseEnter={() => onHover(r.id)}
              onMouseLeave={() => onHover(null)}
              className={cn(
                'group/row relative grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 transition-colors duration-100 hover:bg-accent/40 has-focus-visible:bg-accent/40',
                ROW,
                on && 'bg-accent/50',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'absolute inset-y-0 left-0 w-px bg-primary',
                  on ? 'block' : 'hidden group-has-focus-visible/row:block',
                )}
              />
              <span role="cell" className="flex items-center gap-1">
                <ClassDot r={r} />
              </span>
              <span role="cell" className="min-w-0">
                <button
                  className="flex max-w-full min-w-0 items-center gap-2 rounded-sm text-left text-sm after:absolute after:inset-0 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  aria-pressed={on}
                  onClick={() => onFocus(r.id)}
                  onFocus={() => onHover(r.id)}
                  onBlur={() => onHover(null)}
                >
                  <span className="truncate font-medium">{r.name}</span>
                  {r.isFork && (
                    <Badge
                      variant="outline"
                      className="h-5 shrink-0 gap-1 px-1.5 text-[11px] text-muted-foreground"
                    >
                      <GitForkIcon className="size-3" /> fork
                    </Badge>
                  )}
                  {r.isArchived && (
                    <span className="shrink-0 text-xs text-muted-foreground">archived</span>
                  )}
                </button>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.description ?? 'No description'}
                </span>
              </span>
              <span role="cell" className="hidden md:block">
                <WeekBars r={r} peak={peak} failed={failed.has(r.id)} />
              </span>
              <span role="cell" className="text-right tabular-nums">
                <span className="block text-sm">{fmtNum(r.stars)}</span>
                <span className="block font-mono text-[11px] text-muted-foreground">
                  {gain30Label(r, failed.has(r.id))}
                </span>
              </span>
              <span
                role="cell"
                className="col-span-2 col-start-2 flex min-w-0 flex-wrap gap-1.5 md:col-span-1 md:col-start-auto"
              >
                {top.slice(0, 2).map((s) => {
                  const Icon = SIGNAL_ICON[s.key]
                  return (
                    <Tooltip key={s.key} content={`${s.label} · ${s.detail}`}>
                      <span
                        className={cn(
                          'relative z-10 inline-flex max-w-full items-center gap-1 truncate rounded-sm border px-1.5 py-0.5 text-[11px]',
                          s.level === 2
                            ? 'border-input text-foreground'
                            : 'border-border text-muted-foreground',
                        )}
                      >
                        <Icon className="size-3 shrink-0" aria-hidden />
                        <span className="truncate">{s.label}</span>
                      </span>
                    </Tooltip>
                  )
                })}
                {top.length > 2 && (
                  <span className="self-center font-mono text-[11px] text-muted-foreground">
                    +{top.length - 2}
                  </span>
                )}
              </span>
              <span
                role="cell"
                className="hidden text-right font-mono text-[11px] text-muted-foreground md:block"
              >
                {agoShort(r.pushedAt)}
              </span>
              <span role="cell" className="hidden md:block">
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener"
                  className="relative z-10 grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={`Open ${r.name} on GitHub`}
                >
                  <ArrowUpRightIcon className="size-4" />
                </a>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ClassDot({ r }: { r: EOwn }) {
  const c = HEALTH_CHART[r.health]
  return (
    <Tooltip
      content={`${HEALTH_LABEL[r.health]} (class ${HEALTH_CLASS[r.health]}) · ${HEALTH_HINT[r.health]}`}
    >
      <span className="relative z-10 inline-flex items-center gap-1">
        <span
          className="size-2 rounded-full"
          style={
            r.health === 'archived'
              ? { boxShadow: `inset 0 0 0 1.5px ${c}` }
              : { background: c, opacity: r.health === 'dormant' ? DORMANT_ALPHA : 1 }
          }
        />
        <span className="font-mono text-[11px] text-muted-foreground">
          {HEALTH_CLASS[r.health]}
        </span>
        <span className="sr-only">{HEALTH_LABEL[r.health]}</span>
      </span>
    </Tooltip>
  )
}

/** Stars gained each week for 26 weeks as fine bars in the repo's class colour, on one square-root scale for every row. */
function WeekBars({ r, peak, failed }: { r: EOwn; peak: number; failed: boolean }) {
  const W = 136
  const H = 22
  if (r.history == null && r.stars > 0 && !failed) {
    return <span className="block h-5.5 w-full rounded-sm bg-secondary/60" aria-hidden />
  }
  const weeks = r.weeks
  const max = Math.max(...weeks)
  const step = W / weeks.length
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-5.5 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label={
        max > 0 ? `Peak week: ${fmtNum(Math.round(max))} stars` : 'No new stars in 26 weeks'
      }
    >
      <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} stroke="var(--grid-strong)" />
      {weeks.map((v, i) => {
        const hh = v > 0 ? Math.max(1.5, Math.sqrt(v / peak) * (H - 2)) : 0
        return hh > 0 ? (
          <rect
            key={i}
            x={i * step + step * 0.3}
            y={H - 1 - hh}
            width={Math.max(1, step * 0.4)}
            height={hh}
            fill={HEALTH_CHART[r.health]}
          />
        ) : null
      })}
    </svg>
  )
}

/* ---------- Audience ---------- */

function Avatar({ g }: { g: Stargazer }) {
  if (g.avatarUrl) {
    return (
      <img
        src={`${g.avatarUrl}${g.avatarUrl.includes('?') ? '&' : '?'}s=48`}
        alt=""
        loading="lazy"
        className="size-6 shrink-0 rounded-full bg-muted ring-1 ring-border"
      />
    )
  }
  return (
    <span
      aria-hidden
      className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold text-muted-foreground ring-1 ring-border"
    >
      {g.login[0]?.toUpperCase()}
    </span>
  )
}

function emptyGazersText(charting: boolean, mode: 'latest' | 'notable'): string {
  if (charting) {
    return 'Reading stargazers…'
  }
  return mode === 'notable' ? 'No stargazers in the last 90 days.' : 'No stargazers yet.'
}

function StargazersPanel({
  repos,
  focus,
  login,
}: {
  repos: EOwn[]
  focus: EOwn | null
  login: string
}) {
  const [mode, setMode] = useState<'latest' | 'notable'>('latest')
  const [more, setMore] = useState(false)
  const now = useNow()
  const rows = useMemo(() => {
    const me = login.toLowerCase()
    const list = repos.flatMap((r) =>
      r.recent.filter((g) => g.login.toLowerCase() !== me).map((g) => ({ g, r })),
    )
    if (mode === 'latest') {
      return list.sort((a, b) => b.g.starredAt.localeCompare(a.g.starredAt))
    }
    // Notable: the most-followed of the last 90 days.
    const since = new Date(now - 90 * 86_400_000).toISOString()
    return list.filter((x) => x.g.starredAt >= since).sort((a, b) => b.g.followers - a.g.followers)
  }, [repos, mode, login, now])
  const shown = rows.slice(0, more ? 30 : 10)
  const charting = repos.some((r) => r.stars > 0 && r.history == null)
  return (
    <section className="min-w-0 rounded-lg border bg-card" aria-labelledby="gazers-title">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 id="gazers-title" className="panel-title">
            {focus ? `Who starred ${focus.name}` : 'Who starred you'}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {mode === 'latest'
              ? 'Newest stargazers first.'
              : 'Most-followed stargazers of the last 90 days.'}
          </p>
        </div>
        <Tabs value={mode} onValueChange={(v) => setMode(v as 'latest' | 'notable')}>
          <TabsList>
            <TabsTrigger value="latest">Latest</TabsTrigger>
            <TabsTrigger value="notable">Notable</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {shown.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          {emptyGazersText(charting, mode)}
        </p>
      ) : (
        <ul className="divide-y">
          {shown.map(({ g, r }) => (
            <li key={`${r.id}${g.login}`} className="flex items-center gap-3 px-4 py-2">
              <Avatar g={g} />
              <div className="min-w-0 flex-1">
                <a
                  href={`https://github.com/${g.login}`}
                  target="_blank"
                  rel="noopener"
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {g.login}
                  {g.name && (
                    <span className="ml-1.5 font-normal text-muted-foreground">{g.name}</span>
                  )}
                </a>
                <span className="block truncate text-xs text-muted-foreground">
                  {focus ? '' : `starred ${r.name} · `}
                  <span className="font-mono text-[11px]">{fmtNum(g.followers)}</span>{' '}
                  {g.followers === 1 ? 'follower' : 'followers'}
                </span>
              </div>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {agoShort(g.starredAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 10 && (
        <div className="border-t px-4 py-2">
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0 text-xs"
            onClick={() => setMore((m) => !m)}
          >
            {more ? 'Show fewer' : `Show ${Math.min(30, rows.length) - 10} more`}
          </Button>
        </div>
      )}
    </section>
  )
}

function AlsoStarredPanel({ enabled, waiting }: { enabled: boolean; waiting: boolean }) {
  const q = useAudience(enabled)
  const star = useStar()
  const lib = useLibrary()
  // The library is the truth for what's starred now; the sample's flag is from when it was cached.
  const inStars = useMemo(
    () => (lib.data ? new Set(lib.data.stars.map((s) => s.id)) : null),
    [lib.data],
  )
  const [starred, setStarred] = useState<Set<string>>(new Set())
  const max = q.data?.alsoStarred[0]?.by ?? 1
  const renderBody = () => {
    if (waiting || (enabled && q.isLoading)) {
      return (
        <div className="space-y-2 p-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </div>
      )
    }
    if (q.error) {
      return (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Couldn't sample your stargazers right now.{' '}
          <Button variant="link" size="sm" onClick={() => void q.refetch()}>
            Retry
          </Button>
        </p>
      )
    }
    const also = q.data
    if (!enabled || !also?.alsoStarred.length) {
      return (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          Not enough stargazers to compare yet.
        </p>
      )
    }
    return (
      <ul className="divide-y">
        {also.alsoStarred.map(({ repo, by, youStarred }) => {
          const mine = inStars ? inStars.has(repo.id) : youStarred
          const done = mine || starred.has(repo.id)
          return (
            <li
              key={repo.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2"
            >
              <div className="min-w-0">
                <a
                  href={repo.url}
                  target="_blank"
                  rel="noopener"
                  className="block truncate text-sm hover:underline"
                >
                  <span className="text-muted-foreground">{repo.owner}/</span>
                  <span className="font-medium">{repo.name}</span>
                </a>
                <span className="mt-1 flex items-center gap-2">
                  <span className="h-1 w-16 shrink-0 bg-secondary" aria-hidden>
                    <span
                      className="block h-full bg-foreground/60"
                      style={{ width: `${(by / max) * 100}%` }}
                    />
                  </span>
                  <span className="truncate font-mono text-[11px] text-muted-foreground">
                    {by} of {also.sampled} · {fmtNum(repo.stars)} stars
                  </span>
                </span>
              </div>
              {done ? (
                <span className="text-xs text-muted-foreground">
                  {mine ? 'In your stars' : 'Starred'}
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setStarred((s) => new Set(s).add(repo.id))
                    star.mutate([repo.id], {
                      onError: () =>
                        setStarred((s) => {
                          const next = new Set(s)
                          next.delete(repo.id)
                          return next
                        }),
                    })
                  }}
                >
                  <StarIcon /> Star
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    )
  }
  return (
    <section className="min-w-0 rounded-lg border bg-card" aria-labelledby="also-title">
      <div className="border-b px-4 py-3">
        <h2 id="also-title" className="panel-title">
          Your stargazers also star
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {q.data
            ? `What ${q.data.sampled} of your most recent stargazers starred lately, most shared first.`
            : 'What your most recent stargazers starred lately.'}
        </p>
      </div>
      {renderBody()}
    </section>
  )
}
