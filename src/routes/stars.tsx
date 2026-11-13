import { HEALTH_LABEL, HEALTH_ORDER } from '@shared/scoring'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCheckIcon,
  FilterXIcon,
  ListPlusIcon,
  SearchIcon,
  StarOffIcon,
  XIcon,
} from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'

import { PageHeader } from '@/components/bits'
import { ListPicker } from '@/components/list-picker'
import { RepoRow, ROW_COLS, useOpenRepo } from '@/components/repo'
import { StarField } from '@/components/star-field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useDerived, useReview, useUnstar, type EStar } from '@/lib/queries'
import { cn } from '@/lib/utils'

const SORTS = {
  starred: 'Recently starred',
  oldest: 'Oldest stars',
  stars: 'Most stars',
  pushed: 'Recently pushed',
  trending: 'Trending',
  cruft: 'Cruft score',
  name: 'Name',
} as const

const Search = z.object({
  q: z.string().optional().catch(undefined),
  list: z.string().optional().catch(undefined), // list id or "none"
  lang: z.string().optional().catch(undefined),
  health: z
    .enum(['thriving', 'active', 'quiet', 'dormant', 'archived'])
    .optional()
    .catch(undefined),
  cruft: z.boolean().optional().catch(undefined),
  year: z.number().int().optional().catch(undefined),
  sort: z
    .enum(Object.keys(SORTS) as [keyof typeof SORTS, ...Array<keyof typeof SORTS>])
    .optional()
    .catch(undefined),
})
type Search = z.infer<typeof Search>

export const Route = createFileRoute('/stars')({
  validateSearch: Search,
  component: Library,
})

function sorter(sort: keyof typeof SORTS): (a: EStar, b: EStar) => number {
  switch (sort) {
    case 'oldest':
      return (a, b) => a.starredAt.localeCompare(b.starredAt)
    case 'stars':
      return (a, b) => b.stars - a.stars
    case 'pushed':
      return (a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? '')
    case 'trending':
      return (a, b) => (b.g.d7 ?? b.momentum) - (a.g.d7 ?? a.momentum)
    case 'cruft':
      return (a, b) => b.cruft - a.cruft
    case 'name':
      return (a, b) => a.fullName.localeCompare(b.fullName)
    case 'starred':
      return (a, b) => b.starredAt.localeCompare(a.starredAt)
  }
}

function Library() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/stars' })
  const { data, isLoading } = useDerived()
  const [q, setQ] = useState(search.q ?? '')
  const dq = useDeferredValue(q)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const lastClicked = useRef<string | null>(null)
  const unstar = useUnstar()
  const review = useReview()

  const set = (patch: Partial<Search>) =>
    void navigate({ search: (s) => ({ ...s, ...patch }), replace: true })

  // Debounce the search box into the URL.
  useEffect(() => {
    const t = setTimeout(
      () => void navigate({ search: (s) => ({ ...s, q: q || undefined }), replace: true }),
      300,
    )
    return () => clearTimeout(t)
  }, [q, navigate])

  const languages = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of data?.stars ?? []) {
      if (s.language) {
        m.set(s.language, (m.get(s.language) ?? 0) + 1)
      }
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [data])

  const rows = useMemo(() => {
    if (!data) {
      return []
    }
    const needle = dq.trim().toLowerCase()
    const out = data.stars.filter((s) => {
      if (
        search.list === 'none'
          ? s.listIds.length > 0
          : search.list && !s.listIds.includes(search.list)
      ) {
        return false
      }
      if (search.lang && s.language !== search.lang) {
        return false
      }
      if (search.health && s.health !== search.health) {
        return false
      }
      if (search.cruft && !s.isCruft) {
        return false
      }
      if (search.year && new Date(s.starredAt).getFullYear() !== search.year) {
        return false
      }
      if (needle) {
        const hay = `${s.fullName} ${s.description ?? ''} ${s.topics.join(' ')}`.toLowerCase()
        if (!needle.split(/\s+/).every((w) => hay.includes(w))) {
          return false
        }
      }
      return true
    })
    return out.sort(sorter(search.sort ?? 'starred'))
  }, [data, dq, search])

  // Drop selections that are filtered out or gone
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(rows.map((r) => r.id))
      const next = new Set([...prev].filter((id) => visible.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [rows])

  const listRef = useRef<HTMLDivElement>(null)
  const virt = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 62,
    overscan: 8,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  })

  const onSelect = (id: string, shift: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (shift && lastClicked.current) {
        const a = rows.findIndex((r) => r.id === lastClicked.current)
        const b = rows.findIndex((r) => r.id === id)
        const [lo, hi] = a < b ? [a, b] : [b, a]
        for (let i = lo; i <= hi; i += 1) {
          const r = rows[i]
          if (r) {
            next.add(r.id)
          }
        }
      } else if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
    lastClicked.current = id
  }

  const activeFilters: Array<[string, () => void]> = []
  if (search.list) {
    activeFilters.push([
      search.list === 'none' ? 'Unlisted' : (data?.listsById.get(search.list)?.name ?? 'List'),
      () => set({ list: undefined }),
    ])
  }
  if (search.lang) {
    activeFilters.push([search.lang, () => set({ lang: undefined })])
  }
  if (search.health) {
    activeFilters.push([HEALTH_LABEL[search.health], () => set({ health: undefined })])
  }
  if (search.cruft) {
    activeFilters.push(['Likely cruft', () => set({ cruft: undefined })])
  }
  if (search.year) {
    activeFilters.push([`Starred in ${search.year}`, () => set({ year: undefined })])
  }

  const ids = [...selected]
  const allSelected = rows.length > 0 && selected.size === rows.length
  const [hovered, setHovered] = useState<string | null>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const headRef = useRef<HTMLDivElement>(null)
  const [barH, setBarH] = useState(110)
  const [headH, setHeadH] = useState(34)
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (barRef.current) {
        setBarH(barRef.current.offsetHeight)
      }
      if (headRef.current) {
        setHeadH(headRef.current.offsetHeight)
      }
    })
    if (barRef.current) {
      ro.observe(barRef.current)
    }
    if (headRef.current) {
      ro.observe(headRef.current)
    }
    return () => ro.disconnect()
  }, [])
  const openRepo = useOpenRepo()
  const filtered = activeFilters.length > 0 || dq.trim().length > 0
  const lit = useMemo(() => (filtered ? new Set(rows.map((r) => r.id)) : null), [filtered, rows])
  // Guide words: the first and last repo actually in view.
  const items = virt.getVirtualItems()
  const chrome = 56 + barH + headH // top bar + sticky filter bar + sticky column header
  const top = (virt.scrollOffset ?? 0) - virt.options.scrollMargin + chrome
  const bottom = top + (typeof window === 'undefined' ? 800 : window.innerHeight) - chrome
  // A row counts as in view once at least half of it clears the sticky header (and before half of it leaves the bottom).
  const inView = items.filter(
    (v) =>
      v.start + v.size / 2 - virt.options.scrollMargin > top &&
      v.start + v.size / 2 - virt.options.scrollMargin < bottom,
  )
  const first = inView[0]
  const last = inView.at(-1)
  const sort = search.sort ?? 'starred'
  const sortBy = (key: keyof typeof SORTS) => set({ sort: key === 'starred' ? undefined : key })

  const renderRows = () => {
    if (isLoading) {
      return (
        <div className="space-y-2 pt-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )
    }
    if (rows.length === 0) {
      return (
        <div className="mt-4 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          No stars match these filters.{' '}
          <button
            className="text-foreground underline underline-offset-4"
            onClick={() => (setQ(''), void navigate({ search: {} }))}
          >
            Clear filters
          </button>
        </div>
      )
    }
    return (
      <div ref={listRef} style={{ height: virt.getTotalSize(), position: 'relative' }}>
        {virt.getVirtualItems().map((v) => {
          const s = rows[v.index]
          if (!s) {
            return null
          }
          return (
            <div
              key={s.id}
              data-index={v.index}
              ref={virt.measureElement}
              className="absolute inset-x-0"
              style={{ transform: `translateY(${v.start - virt.options.scrollMargin}px)` }}
            >
              <RepoRow
                s={s}
                selected={selected.has(s.id)}
                onSelect={onSelect}
                onHover={setHovered}
              />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Stars"
        sub={
          data
            ? `${rows.length.toLocaleString()} of ${data.stars.length.toLocaleString()} repos`
            : undefined
        }
      />

      {/* Filters: one row */}
      <div
        ref={barRef}
        className="sticky top-14 z-10 -mx-4 flex flex-wrap items-center gap-2 bg-background/95 px-4 py-3 backdrop-blur-sm md:-mx-8 md:px-8"
      >
        <div className="relative min-w-52 flex-1">
          <SearchIcon className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, description, topics…"
            className="pl-9"
          />
        </div>
        <Filter label="List" active={Boolean(search.list)}>
          <DropdownMenuCheckboxItem
            checked={!search.list}
            onCheckedChange={() => set({ list: undefined })}
          >
            Any
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={search.list === 'none'}
            onCheckedChange={() => set({ list: 'none' })}
          >
            Unlisted
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {data?.lists.map((l) => (
            <DropdownMenuCheckboxItem
              key={l.id}
              checked={search.list === l.id}
              onCheckedChange={() => set({ list: l.id })}
            >
              <span className="flex-1">{l.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {data.listCounts.get(l.id) ?? 0}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
        </Filter>
        <Filter label="Language" active={Boolean(search.lang)}>
          <DropdownMenuCheckboxItem
            checked={!search.lang}
            onCheckedChange={() => set({ lang: undefined })}
          >
            Any
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <div className="max-h-72 overflow-y-auto">
            {languages.map(([l, n]) => (
              <DropdownMenuCheckboxItem
                key={l}
                checked={search.lang === l}
                onCheckedChange={() => set({ lang: l })}
              >
                <span className="flex-1">{l}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{n}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        </Filter>
        <Filter label="Health" active={Boolean(search.health) || Boolean(search.cruft)}>
          <DropdownMenuCheckboxItem
            checked={Boolean(search.cruft)}
            onCheckedChange={(c) => set({ cruft: c ? true : undefined })}
          >
            Likely cruft only
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {HEALTH_ORDER.map((h) => (
            <DropdownMenuCheckboxItem
              key={h}
              checked={search.health === h}
              onCheckedChange={(c) => set({ health: c ? h : undefined })}
            >
              {HEALTH_LABEL[h]}
            </DropdownMenuCheckboxItem>
          ))}
        </Filter>
        <Filter label={SORTS[search.sort ?? 'starred']} active={false}>
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          {(Object.keys(SORTS) as Array<keyof typeof SORTS>).map((k) => (
            <DropdownMenuCheckboxItem
              key={k}
              checked={(search.sort ?? 'starred') === k}
              onCheckedChange={() => set({ sort: k === 'starred' ? undefined : k })}
            >
              {SORTS[k]}
            </DropdownMenuCheckboxItem>
          ))}
        </Filter>
        {activeFilters.length > 0 && (
          <div className="flex w-full flex-wrap items-center gap-1.5">
            {activeFilters.map(([label, clear]) => (
              <Badge
                key={label}
                role="button"
                tabIndex={0}
                className="cursor-pointer"
                onClick={clear}
              >
                {label} <XIcon />
              </Badge>
            ))}
            <Button size="sm" variant="ghost" onClick={() => void navigate({ search: {} })}>
              <FilterXIcon /> Clear
            </Button>
          </div>
        )}
        <div className="flex w-full items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {selected.size > 0
              ? `${selected.size} selected · shift-click to select a range`
              : 'Shift-click to select a range'}
          </span>
          {first && last && rows.length > 0 && (
            <span className="hidden min-w-0 truncate sm:block" aria-hidden>
              <span className="text-foreground">{rows[first.index]?.fullName}</span>
              <span className="mx-2">to</span>
              <span className="text-foreground">{rows[last.index]?.fullName}</span>
              <span className="ml-3 font-mono text-[11px] tabular-nums">
                {first.index + 1}–{last.index + 1} of {rows.length.toLocaleString()}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_17rem] xl:items-start xl:gap-6">
        <div className="min-w-0">
          <div
            ref={headRef}
            role="row"
            style={{ top: 56 + barH }}
            className={cn(
              'sticky z-9 grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-3 border-y bg-background px-3 py-2 text-xs text-muted-foreground',
              ROW_COLS,
            )}
          >
            <Checkbox
              checked={allSelected}
              indeterminate={!allSelected && selected.size > 0}
              onCheckedChange={() =>
                setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))
              }
              aria-label="Select all"
            />
            <span role="columnheader" className="hidden md:block">
              Class
            </span>
            <SortHead
              label="Repository"
              active={sort === 'name'}
              dir="up"
              onClick={() => sortBy('name')}
            />
            <SortHead
              label="Stars"
              active={sort === 'stars'}
              dir="down"
              onClick={() => sortBy('stars')}
              className="hidden justify-end md:flex"
            />
            <SortHead
              label="Pushed"
              active={sort === 'pushed'}
              dir="down"
              onClick={() => sortBy('pushed')}
              className="hidden md:flex"
            />
            <SortHead
              label="Starred"
              active={sort === 'starred' || sort === 'oldest'}
              dir={sort === 'oldest' ? 'up' : 'down'}
              onClick={() => sortBy(sort === 'starred' ? 'oldest' : 'starred')}
              className="hidden md:flex"
            />
            <span role="columnheader" className="hidden md:block">
              List
            </span>
          </div>
          {renderRows()}
        </div>
        {data && (
          <aside
            style={{ top: 56 + barH + 12 }}
            className="sticky hidden overflow-hidden rounded-lg border bg-card xl:block"
            aria-labelledby="lit-title"
          >
            <div className="border-b px-4 py-3">
              <h2 id="lit-title" className="panel-title">
                In the field
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {filtered
                  ? `${rows.length.toLocaleString()} matching stars lit`
                  : 'Filter to light up matches'}
                {selected.size > 0 ? ` · ${selected.size} selected ringed` : ''}
              </p>
            </div>
            <StarField
              stars={data.stars}
              compact
              height={340}
              highlightSet={lit}
              ringSet={selected.size > 0 ? selected : null}
              pinnedId={hovered}
              onOpen={openRepo}
            />
          </aside>
        )}
      </div>

      {/* Bulk actions */}
      <div
        className={cn(
          'fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-xl items-center gap-2 rounded-lg border bg-popover p-2 pl-4 shadow-2xl shadow-black/50 transition-[opacity,translate] duration-150 ease-out md:bottom-6',
          selected.size > 0
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-6 opacity-0',
        )}
      >
        <span className="mr-auto text-sm font-medium tabular-nums">{selected.size} selected</span>
        <ListPicker repoIds={ids} align="center">
          <Button size="sm" variant="outline">
            <ListPlusIcon /> Lists
          </Button>
        </ListPicker>
        <Button
          size="sm"
          variant="outline"
          onClick={() => (review.mutate({ repoIds: ids, action: 'keep' }), setSelected(new Set()))}
        >
          <CheckCheckIcon /> Keep
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => (unstar.mutate(ids), setSelected(new Set()))}
        >
          <StarOffIcon /> Unstar
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setSelected(new Set())}
          aria-label="Clear selection"
        >
          <XIcon />
        </Button>
      </div>
    </>
  )
}

function ariaSort(active: boolean, dir: 'up' | 'down') {
  if (!active) {
    return 'none'
  }
  return dir === 'up' ? 'ascending' : 'descending'
}

function SortHead({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string
  active: boolean
  dir: 'up' | 'down'
  onClick: () => void
  className?: string
}) {
  const Icon = dir === 'up' ? ArrowUpIcon : ArrowDownIcon
  return (
    <span role="columnheader" aria-sort={ariaSort(active, dir)} className={cn('flex', className)}>
      <button
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 text-left transition-colors hover:text-foreground',
          active && 'text-foreground',
        )}
      >
        {label}
        {active && <Icon className="size-3" />}
      </button>
    </span>
  )
}

function Filter({
  label,
  active,
  children,
}: {
  label: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn('h-9', active && 'border-ring/60 bg-secondary')}
          />
        }
      >
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
