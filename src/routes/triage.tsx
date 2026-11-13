import { HEALTH_LABEL } from '@shared/scoring'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  BrainCircuitIcon,
  CheckIcon,
  ClockIcon,
  ExternalLinkIcon,
  ListPlusIcon,
  SkipForwardIcon,
  type StarIcon,
  StarOffIcon,
  TelescopeIcon,
  TriangleAlertIcon,
  UndoIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'

import { GrowthBadge, LangDot, PageHeader, RepoAvatar } from '@/components/bits'
import { ListPicker } from '@/components/list-picker'
import { useOpenRepo } from '@/components/repo'
import { DORMANT_ALPHA, StarField, type Outcome } from '@/components/star-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HEALTH_CHART, HEALTH_CLASS } from '@/lib/palette'
import {
  useDerived,
  useReview,
  useUnstar,
  useUpdateLists,
  type Derived,
  type EStar,
} from '@/lib/queries'
import { useSyncContext } from '@/lib/sync-context'
import { useNow } from '@/lib/use-now'
import { ago, agoShort, fmtNum } from '@/lib/utils'

const Mode = z.enum(['cruft', 'unlisted', 'rediscover'])
type Mode = z.infer<typeof Mode>

export const Route = createFileRoute('/triage')({
  validateSearch: z.object({ mode: Mode.optional().catch(undefined) }),
  component: Triage,
})

const MODES: Record<Mode, { label: string; icon: typeof StarIcon; hint: string }> = {
  cruft: {
    label: 'Cruft',
    icon: TriangleAlertIcon,
    hint: 'Archived, abandoned or deprecated repos. Keep or let go.',
  },
  unlisted: {
    label: 'Unlisted',
    icon: ListPlusIcon,
    hint: "Give every star a home. Clef's pick is one key away.",
  },
  rediscover: {
    label: 'Rediscover',
    icon: TelescopeIcon,
    hint: 'Old stars that are still alive. Remember why you starred them?',
  },
}

function buildQueue(d: Derived, mode: Mode): string[] {
  const open = d.stars.filter((s) => !s.snoozed)
  if (mode === 'cruft') {
    return open
      .filter((s) => s.isCruft && !s.reviewedAt)
      .sort((a, b) => b.cruft - a.cruft)
      .map((s) => s.id)
  }
  if (mode === 'unlisted') {
    return open
      .filter((s) => s.listIds.length === 0 && !s.reviewedAt)
      .sort(
        (a, b) =>
          (b.suggestion?.listId ? b.suggestion.listConfidence : -1) -
            (a.suggestion?.listId ? a.suggestion.listConfidence : -1) ||
          b.starredAt.localeCompare(a.starredAt),
      )
      .map((s) => s.id)
  }
  return open
    .filter((s) => s.rediscover > 0)
    .sort((a, b) => b.rediscover - a.rediscover)
    .map((s) => s.id)
}

type Tally = { kept: number; unstarred: number; listed: number; skipped: number }

function Triage() {
  const { mode = 'cruft' } = Route.useSearch()
  const navigate = useNavigate({ from: '/triage' })
  const { data, isLoading } = useDerived()
  const [queue, setQueue] = useState<{ mode: Mode; ids: string[] } | null>(null)
  const [i, setI] = useState(0)
  const [tally, setTally] = useState<Tally>({ kept: 0, unstarred: 0, listed: 0, skipped: 0 })
  const unstar = useUnstar()
  const review = useReview()
  const update = useUpdateLists()

  // Snapshot the queue when the mode changes so cards don't reshuffle as you act.
  useEffect(() => {
    if (data && queue?.mode !== mode) {
      setQueue({ mode, ids: buildQueue(data, mode) })
      setI(0)
    }
  }, [data, mode, queue?.mode])

  const current: EStar | undefined = useMemo(() => {
    if (!data || !queue) {
      return undefined
    }
    return data.byId.get(queue.ids[i] ?? '')
  }, [data, queue, i])

  // Rebuild once Clef finishes so its picks float to the top
  const { classify } = useSyncContext()
  const wasRunning = useRef(false)
  useEffect(() => {
    if (wasRunning.current && !classify.progress.running) {
      setQueue(null)
    }
    wasRunning.current = classify.progress.running
  }, [classify.progress.running])

  // Skip over repos unstarred elsewhere
  useEffect(() => {
    const id = queue?.ids[i]
    if (data && id !== undefined && !data.byId.get(id) && !unstar.isPending) {
      setI((n) => n + 1)
    }
  }, [data, queue, i, unstar.isPending])

  const suggested =
    current?.suggestion?.listId && !current.listIds.includes(current.suggestion.listId)
      ? data?.listsById.get(current.suggestion.listId)
      : undefined

  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const next = useCallback((k: keyof Tally) => {
    setTally((t) => ({ ...t, [k]: t[k] + 1 }))
    setI((n) => n + 1)
  }, [])

  const act = useCallback(
    (a: 'keep' | 'unstar' | 'skip' | 'snooze' | 'accept' | 'back') => {
      if (a === 'back') {
        return setI((n) => Math.max(0, n - 1))
      }
      if (!current) {
        return
      }
      if (a === 'keep' || a === 'unstar' || (a === 'accept' && suggested)) {
        setOutcome({
          star: current,
          kind: a === 'unstar' ? 'unstar' : 'keep',
          at: performance.now(),
        })
      }
      if (a === 'keep') {
        review.mutate({ repoIds: [current.id], action: 'keep' })
        next('kept')
      } else if (a === 'unstar') {
        unstar.mutate([current.id])
        next('unstarred')
      } else if (a === 'snooze') {
        review.mutate({ repoIds: [current.id], action: 'snooze', days: 90 })
        next('skipped')
      } else if (a === 'accept' && suggested) {
        update.mutate({ repoIds: [current.id], add: [suggested.id] })
        review.mutate({ repoIds: [current.id], action: 'keep' })
        next('listed')
      } else if (a === 'skip') {
        next('skipped')
      }
    },
    [current, next, review, suggested, unstar, update],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.metaKey ||
        e.ctrlKey ||
        document.querySelector('[role=dialog]')
      ) {
        return
      }
      const map: Record<string, Parameters<typeof act>[0]> = {
        ArrowRight: 'keep',
        k: 'keep',
        ArrowLeft: 'unstar',
        u: 'unstar',
        a: 'accept',
        s: 'snooze',
        j: 'skip',
        ' ': 'skip',
        Backspace: 'back',
      }
      const a = map[e.key]
      if (a) {
        e.preventDefault()
        act(a)
      }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [act])

  const total = queue?.ids.length ?? 0
  const done = Math.min(i, total)
  const openRepo = useOpenRepo()
  const upNext = (queue?.ids.slice(i + 1) ?? [])
    .map((id) => data?.byId.get(id))
    .filter((x): x is EStar => Boolean(x))
    .slice(0, 4)

  return (
    <>
      <PageHeader title="Triage" sub={<span className="hidden sm:inline">{MODES[mode].hint}</span>}>
        <Tabs value={mode} onValueChange={(m) => void navigate({ search: { mode: m as Mode } })}>
          <TabsList>
            {(Object.keys(MODES) as Mode[]).map((m) => {
              const M = MODES[m]
              return (
                <TabsTrigger key={m} value={m}>
                  <M.icon /> {M.label}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      </PageHeader>

      {isLoading || !queue || !data ? (
        <Skeleton className="h-112" />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
              <span className="text-foreground">
                {done} of {total}
              </span>
              <Progress value={total ? (done / total) * 100 : 100} className="flex-1" />
              <span>
                {tally.kept} kept · {tally.listed} listed · {tally.unstarred} unstarred
              </span>
            </div>

            {current && (
              <div className="mb-3 overflow-hidden rounded-lg border bg-card lg:hidden">
                <StarField
                  stars={data.stars}
                  highlightId={current.id}
                  onOpen={openRepo}
                  height={112}
                  compact
                  outcome={outcome}
                />
              </div>
            )}
            {mode === 'unlisted' && <ClefNudge />}

            {current ? (
              <SwipeCard
                key={current.id}
                onSwipe={(dir) => act(dir === 'right' ? 'keep' : 'unstar')}
              >
                <TriageCard s={current} derived={data} />
              </SwipeCard>
            ) : (
              <Done tally={tally} mode={mode} onRestart={() => setQueue(null)} />
            )}

            {current && (
              <>
                <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-20 -mx-2 mt-4 grid grid-cols-3 gap-2 rounded-lg bg-background/95 p-2 backdrop-blur-sm sm:grid-cols-4 md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
                  <Button variant="destructive" size="lg" onClick={() => act('unstar')}>
                    <StarOffIcon /> Unstar <Kbd>←</Kbd>
                  </Button>
                  {suggested ? (
                    <Button
                      size="lg"
                      onClick={() => act('accept')}
                      className="min-w-0 sm:col-span-2"
                    >
                      <BrainCircuitIcon /> <span className="truncate">Add to {suggested.name}</span>{' '}
                      <Kbd>A</Kbd>
                    </Button>
                  ) : (
                    <ListPicker repoIds={[current.id]} align="center" onDone={() => next('listed')}>
                      <Button size="lg" variant="outline" className="sm:col-span-2">
                        <ListPlusIcon /> List…
                      </Button>
                    </ListPicker>
                  )}
                  <Button
                    size="lg"
                    variant={suggested ? 'outline' : 'default'}
                    onClick={() => act('keep')}
                  >
                    <CheckIcon /> Keep <Kbd>→</Kbd>
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => act('back')} disabled={i === 0}>
                    <UndoIcon /> Back
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => act('skip')}>
                    <SkipForwardIcon /> Skip <Kbd>J</Kbd>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => act('snooze')}>
                    <ClockIcon /> Snooze 90 days <Kbd>S</Kbd>
                  </Button>
                  {suggested && (
                    <ListPicker repoIds={[current.id]} align="center" onDone={() => next('listed')}>
                      <Button variant="ghost" size="sm">
                        <ListPlusIcon /> Other list…
                      </Button>
                    </ListPicker>
                  )}
                </div>
              </>
            )}
          </div>
          <Sidebar
            current={current}
            upNext={upNext}
            derived={data}
            onOpen={openRepo}
            outcome={outcome}
          />
        </div>
      )}
    </>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-1 hidden rounded-sm border border-current/25 px-1.5 font-mono text-[11px] leading-4 opacity-70 sm:inline">
      {children}
    </kbd>
  )
}

function ClefNudge() {
  const { data } = useDerived()
  const { classify } = useSyncContext()
  if (!data) {
    return null
  }
  const pending = data.stars.filter((s) => s.listIds.length === 0 && !s.suggestion).length
  if (!pending && !classify.progress.running) {
    return null
  }
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-2.5 text-sm">
      <BrainCircuitIcon className="size-4 text-muted-foreground" />
      {classify.progress.running ? (
        <>
          <span className="tabular-nums">{classify.progress.label}</span>
          <Progress value={classify.progress.pct} className="w-32" />
        </>
      ) : (
        <>
          <span className="flex-1 text-muted-foreground">
            {pending.toLocaleString()} unlisted repos don't have a Clef suggestion yet.
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void classify.run('unlisted')}
            disabled={data.lists.length === 0}
          >
            Suggest lists
          </Button>
        </>
      )}
    </div>
  )
}

function TriageCard({ s, derived }: { s: EStar; derived: Derived }) {
  const now = useNow()
  const years = (now - new Date(s.starredAt).getTime()) / (365 * 86_400_000)
  const reasons = [
    ...s.rules.reasons,
    ...(s.suggestion ? [`Clef puts it at ${Math.round(s.suggestion.cruft * 100)}%`] : []),
  ]
  const suggested =
    s.suggestion?.listId && !s.listIds.includes(s.suggestion.listId)
      ? derived.listsById.get(s.suggestion.listId)
      : undefined
  return (
    <article
      className="overflow-hidden rounded-lg border bg-card"
      aria-label={`${s.fullName}, triage card`}
    >
      <div className="px-5 pt-5 md:px-7 md:pt-6">
        <div className="flex items-start gap-3">
          <RepoAvatar owner={s.owner} src={s.ownerAvatar} className="mt-1 size-10 md:size-11" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm text-muted-foreground">
              {s.owner}
              <span className="sm:hidden">
                {' · '}
                <span
                  className="mr-1 inline-block size-2 rounded-full align-middle"
                  style={
                    s.health === 'archived'
                      ? { boxShadow: `inset 0 0 0 1.5px ${HEALTH_CHART[s.health]}` }
                      : {
                          background: HEALTH_CHART[s.health],
                          opacity: s.health === 'dormant' ? DORMANT_ALPHA : 1,
                        }
                  }
                />
                <span className="text-foreground">
                  Class <span className="font-mono">{HEALTH_CLASS[s.health]}</span>
                </span>
                {` · starred ${agoShort(s.starredAt)}`}
              </span>
            </div>
            <h2 className="truncate text-3xl font-semibold tracking-tight">{s.name}</h2>
          </div>
          <div className="hidden shrink-0 sm:block">
            <ClassMark s={s} years={years} align="right" />
          </div>
        </div>
        <p className="mt-4 max-w-[65ch] text-base leading-relaxed text-foreground/90">
          {s.description ?? <span className="text-muted-foreground">No description</span>}
        </p>
        <div className="mt-4 flex gap-1.5 overflow-hidden max-sm:flex-nowrap sm:flex-wrap">
          <GrowthBadge d={s.g.d7} estimated={s.g.estimated} />
          {s.isFork && <Badge variant="outline">Fork</Badge>}
          {s.topics.slice(0, 6).map((t) => (
            <Badge key={t} variant="outline">
              {t}
            </Badge>
          ))}
        </div>
      </div>
      {(s.isCruft || s.rules.reasons.length > 0) && (
        <div className="mt-5 flex flex-col gap-3 border-y px-5 py-4 sm:flex-row sm:gap-8 md:px-7">
          <div className="shrink-0">
            <div className="text-3xl font-semibold tracking-tight text-warning tabular-nums">
              {Math.round(s.cruft * 100)}%
            </div>
            <div className="text-xs text-muted-foreground">likely cruft</div>
          </div>
          <ol className="space-y-1 text-sm">
            {reasons.map((r, n) => (
              <li key={r} className="flex gap-3">
                <span className="w-4 shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground">
                  {n + 1}
                </span>
                {r}
              </li>
            ))}
          </ol>
        </div>
      )}
      <dl
        className={`grid grid-cols-4 border-b [&>div+div]:border-l ${s.isCruft || s.rules.reasons.length > 0 ? '' : 'mt-5 border-t'}`}
      >
        <Metric label="Stars" value={fmtNum(s.stars)} />
        <Metric label="Forks" value={fmtNum(s.forks)} />
        <Metric label="Last push" value={ago(s.pushedAt)} short={agoShort(s.pushedAt)} />
        <Metric
          label="Release"
          value={s.latestReleaseTag ? `${s.latestReleaseTag}` : 'none'}
          detail={s.latestReleaseTag ? ago(s.latestReleaseAt) : undefined}
        />
      </dl>
      {suggested && s.suggestion && (
        <div className="flex items-center gap-2 border-b px-5 py-3 text-sm md:px-7">
          <BrainCircuitIcon className="size-4 text-muted-foreground" />
          Clef suggests <span className="font-medium">{suggested.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {Math.round(s.suggestion.listConfidence * 100)}% confident
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 px-5 py-3 text-xs text-muted-foreground md:px-7">
        <LangDot color={s.languageColor} name={s.language} />
        {s.listIds.map((l) => (
          <Badge key={l}>{derived.listsById.get(l)?.name}</Badge>
        ))}
        <a
          href={s.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onPointerDown={(e) => e.stopPropagation()}
        >
          Open on GitHub <ExternalLinkIcon className="size-3" />
        </a>
      </div>
    </article>
  )
}

/** Class swatch, letter and name at readout scale: the stage's spectral reading. */
function ClassMark({ s, years, align }: { s: EStar; years: number; align: 'left' | 'right' }) {
  const c = HEALTH_CHART[s.health]
  return (
    <div className={align === 'right' ? 'text-right' : 'flex flex-wrap items-baseline gap-x-3'}>
      <div className={`flex items-center gap-2 ${align === 'right' ? 'justify-end' : ''}`}>
        <span
          className="size-3 rounded-full"
          style={
            s.health === 'archived'
              ? { boxShadow: `inset 0 0 0 2px ${c}` }
              : { background: c, opacity: s.health === 'dormant' ? DORMANT_ALPHA : 1 }
          }
        />
        <span className="text-lg font-semibold tracking-tight">
          Class <span className="font-mono">{HEALTH_CLASS[s.health]}</span>
        </span>
        <span className="text-sm text-muted-foreground">{HEALTH_LABEL[s.health]}</span>
      </div>
      <div className={`text-xs text-muted-foreground ${align === 'right' ? 'mt-1' : ''}`}>
        starred{' '}
        <span className="text-foreground tabular-nums">
          {years >= 1 ? `${years.toFixed(1)} years ago` : ago(s.starredAt)}
        </span>
      </div>
    </div>
  )
}

function Metric({
  label,
  value,
  detail,
  short,
}: {
  label: string
  value: string
  detail?: string
  short?: string
}) {
  return (
    <div className="min-w-0 px-3 py-2.5 sm:px-5 sm:py-3 md:px-7">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold tracking-tight tabular-nums sm:text-lg">
        {short ? (
          <>
            <span className="sm:hidden">{short}</span>
            <span className="hidden sm:inline">{value}</span>
          </>
        ) : (
          value
        )}
      </dd>
      {detail && (
        <dd className="hidden truncate text-xs text-muted-foreground sm:block">{detail}</dd>
      )}
    </div>
  )
}

function Sidebar({
  current,
  upNext,
  derived,
  onOpen,
  outcome,
}: {
  current: EStar | undefined
  upNext: EStar[]
  derived: Derived
  onOpen: (id: string) => void
  outcome: Outcome | null
}) {
  return (
    <aside className="flex flex-col gap-4">
      <section
        className="hidden overflow-hidden rounded-lg border bg-card lg:block"
        aria-labelledby="sits-title"
      >
        <div className="border-b px-4 py-3">
          <h2 id="sits-title" className="panel-title">
            Where it sits
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            This repo among all {derived.stars.length.toLocaleString()} stars
          </p>
        </div>
        <StarField
          stars={derived.stars}
          highlightId={current?.id ?? null}
          onOpen={onOpen}
          height={280}
          compact
          outcome={outcome}
        />
      </section>
      {upNext.length > 0 && (
        <section className="rounded-lg border bg-card" aria-labelledby="next-title">
          <h2 id="next-title" className="panel-title border-b px-4 py-3">
            Up next
          </h2>
          <ol className="divide-y">
            {upNext.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={
                    s.health === 'archived'
                      ? { boxShadow: `inset 0 0 0 1.5px ${HEALTH_CHART[s.health]}` }
                      : {
                          background: HEALTH_CHART[s.health],
                          opacity: s.health === 'dormant' ? DORMANT_ALPHA : 1,
                        }
                  }
                />
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-muted-foreground">{s.owner}/</span>
                  {s.name}
                </span>
                {s.isCruft && (
                  <span className="text-xs text-warning tabular-nums">
                    {Math.round(s.cruft * 100)}%
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
      <section
        className="hidden rounded-lg border bg-card p-4 md:block"
        aria-labelledby="keys-title"
      >
        <h2 id="keys-title" className="panel-title">
          Keys
        </h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-sm">
          {KEYS.map(([k, label]) => (
            <div key={k} className="contents">
              <dt>
                <kbd className="inline-grid h-5 min-w-5 place-items-center rounded-sm border px-1 font-mono text-[11px] text-muted-foreground">
                  {k}
                </kbd>
              </dt>
              <dd className="text-muted-foreground">{label}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Swipe works too. Unstars can be undone from the toast or Settings.
        </p>
      </section>
    </aside>
  )
}

const KEYS: Array<[string, string]> = [
  ['←', 'Unstar'],
  ['→', 'Keep'],
  ['A', "Accept Clef's List"],
  ['S', 'Snooze 90 days'],
  ['J', 'Skip'],
  ['⌫', 'Back'],
]

function SwipeCard({
  children,
  onSwipe,
}: {
  children: React.ReactNode
  onSwipe: (dir: 'left' | 'right') => void
}) {
  const [dx, setDx] = useState(0)
  const start = useRef<number | null>(null)
  const threshold = 110
  return (
    <div
      className="relative touch-pan-y select-none"
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) {
          return
        }
        start.current = e.clientX
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => start.current != null && setDx(e.clientX - start.current)}
      onPointerUp={() => {
        if (Math.abs(dx) > threshold) {
          onSwipe(dx > 0 ? 'right' : 'left')
        }
        start.current = null
        setDx(0)
      }}
      onPointerCancel={() => {
        start.current = null
        setDx(0)
      }}
      style={{
        transform: `translateX(${dx}px) rotate(${dx / 40}deg)`,
        transition: start.current == null ? 'transform 250ms cubic-bezier(.2,.8,.2,1)' : 'none',
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-lg transition-opacity"
        style={{
          opacity: Math.min(1, Math.abs(dx) / threshold),
          boxShadow:
            dx > 0 ? 'inset 0 0 0 2px var(--success)' : 'inset 0 0 0 2px var(--destructive)',
        }}
      />
      <div className="animate-in fade-in-0 zoom-in-[0.98] duration-200">{children}</div>
    </div>
  )
}

function Done({ tally, mode, onRestart }: { tally: Tally; mode: Mode; onRestart: () => void }) {
  return (
    <div className="rounded-lg border bg-card p-10 text-center">
      <div className="mx-auto grid size-10 place-items-center rounded-full border border-success/30 bg-success/10">
        <CheckIcon className="size-5 text-success" />
      </div>
      <h2 className="mt-4 text-xl font-semibold">Queue clear</h2>
      <p className="mt-2 text-sm text-muted-foreground tabular-nums">
        {tally.kept} kept · {tally.listed} listed · {tally.unstarred} unstarred · {tally.skipped}{' '}
        skipped
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button variant="outline" onClick={onRestart}>
          Rebuild {MODES[mode].label.toLowerCase()} queue
        </Button>
        <Button nativeButton={false} render={<Link to="/stars" />}>
          Browse all stars
        </Button>
      </div>
    </div>
  )
}
