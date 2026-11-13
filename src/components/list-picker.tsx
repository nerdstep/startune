import { LIST_LIMITS } from '@shared/schemas'
import { CheckIcon, MinusIcon, PlusIcon, SearchIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCreateList, useDerived, useUpdateLists } from '@/lib/queries'
import { cn } from '@/lib/utils'

/** Why a list named `name` can't be created, by GitHub's limits (LIST_LIMITS), or null if it can. */
function whyNoNewList(lists: number, name: string): string | null {
  if (lists >= LIST_LIMITS.lists) {
    return `GitHub allows ${LIST_LIMITS.lists} lists, and you have them all.`
  }
  if (name.length > LIST_LIMITS.name) {
    return `A list name can be up to ${LIST_LIMITS.name} characters.`
  }
  return null
}

/** Whether none, some or all of the `total` selected repos are in a list. */
function membershipState(inList: number, total: number): 'none' | 'some' | 'all' {
  if (inList === 0) {
    return 'none'
  }
  return inList === total ? 'all' : 'some'
}

/**
 * Toggle list membership for one or many repos. For a selection, lists that only
 * some of the repos are in show a dash; clicking adds the rest.
 */
export function ListPicker({
  repoIds,
  children,
  align = 'end',
  onDone,
}: {
  repoIds: string[]
  /** The trigger element, e.g. a <Button>. */
  children: React.ReactElement
  align?: 'start' | 'center' | 'end'
  onDone?: () => void
}) {
  const { data } = useDerived()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const update = useUpdateLists()
  const create = useCreateList()

  const membership = useMemo(() => {
    const m = new Map<string, number>()
    if (!data) {
      return m
    }
    for (const id of repoIds) {
      for (const l of data.byId.get(id)?.listIds ?? []) {
        m.set(l, (m.get(l) ?? 0) + 1)
      }
    }
    return m
  }, [data, repoIds])

  if (!data) {
    return children
  }
  const lists = data.lists.filter((l) => l.name.toLowerCase().includes(q.trim().toLowerCase()))
  const exact = data.lists.some((l) => l.name.toLowerCase() === q.trim().toLowerCase())
  const blocked = whyNoNewList(data.lists.length, q.trim())

  const toggle = (listId: string) => {
    const all = (membership.get(listId) ?? 0) === repoIds.length
    update.mutate(all ? { repoIds, remove: [listId] } : { repoIds, add: [listId] })
    onDone?.()
  }

  const createAndAdd = async () => {
    const name = q.trim()
    if (!name) {
      return
    }
    const list = await create.mutateAsync({ name, isPrivate: false })
    update.mutate({ repoIds, add: [list.id] })
    setQ('')
    onDone?.()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={children} />
      <PopoverContent align={align} className="w-72 p-2" onClick={(e) => e.stopPropagation()}>
        <div className="relative mb-2">
          <SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && q.trim() && !exact && !blocked) {
                void createAndAdd()
              }
              e.stopPropagation()
            }}
            placeholder="Find or create a list…"
            className="h-9 w-full rounded-md border border-input bg-background pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
          />
        </div>
        <div className="max-h-64 overflow-y-auto">
          {lists.map((l) => {
            const n = membership.get(l.id) ?? 0
            const state = membershipState(n, repoIds.length)
            return (
              <button
                key={l.id}
                onClick={() => toggle(l.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              >
                <span
                  className={cn(
                    'grid size-4 place-items-center rounded-sm border border-input',
                    state !== 'none' && 'border-primary bg-primary text-primary-foreground',
                  )}
                >
                  {state === 'all' && <CheckIcon className="size-3" strokeWidth={3} />}
                  {state === 'some' && <MinusIcon className="size-3" strokeWidth={3} />}
                </span>
                <span className="flex-1 truncate">{l.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {data.listCounts.get(l.id) ?? 0}
                </span>
              </button>
            )
          })}
          {lists.length === 0 && !q && (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              No lists yet. Type a name to create one.
            </p>
          )}
        </div>
        {q.trim() && !exact && blocked && (
          <p className="mt-1 border-t px-2 pt-2 pb-1 text-xs text-muted-foreground">{blocked}</p>
        )}
        {q.trim() && !exact && !blocked && (
          <button
            onClick={() => void createAndAdd()}
            disabled={create.isPending}
            className="mt-1 flex w-full items-center gap-2 rounded-md border-t px-2 py-1.5 text-left text-sm hover:bg-accent"
          >
            <PlusIcon className="size-4" /> Create “{q.trim()}”
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
