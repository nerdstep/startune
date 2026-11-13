import type {
  ClassifyInput,
  CreateListInput,
  Library,
  ReviewInput,
  Star,
  StarList,
} from '@shared/schemas'
import {
  CRUFT_THRESHOLD,
  cruftRules,
  cruftScore,
  growth,
  health,
  momentum,
  rediscoverScore,
  type CruftResult,
  type Growth,
  type Health,
} from '@shared/scoring'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { ApiError, backend } from './api'
import { chunk } from './utils'

export const qk = {
  me: ['me'] as const,
  library: ['library'] as const,
  discover: ['discover'] as const,
}

export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: backend.me, staleTime: 60_000 })
}

export function useLibrary(enabled = true) {
  return useQuery({
    queryKey: qk.library,
    queryFn: backend.library,
    enabled,
    staleTime: 5 * 60_000,
  })
}

export function useDiscover() {
  return useQuery({
    queryKey: qk.discover,
    queryFn: backend.discover,
    staleTime: 6 * 3600_000,
    retry: 1,
  })
}

/* ---------- Derived view model ---------- */

export interface EStar extends Star {
  health: Health
  rules: CruftResult
  cruft: number
  isCruft: boolean
  g: Growth
  momentum: number
  rediscover: number
  snoozed: boolean
}

export interface Derived {
  stars: EStar[]
  byId: Map<string, EStar>
  lists: StarList[]
  listsById: Map<string, StarList>
  listCounts: Map<string, number>
  hasHistory: boolean
  library: Library
}

export function useDerived(): { data: Derived | undefined; isLoading: boolean; error: unknown } {
  const q = useLibrary()
  const data = useMemo(() => (q.data ? derive(q.data) : undefined), [q.data])
  return { data, isLoading: q.isLoading, error: q.error }
}

export function derive(lib: Library): Derived {
  const now = new Date()
  const seed = lib.today
  const listCounts = new Map<string, number>()
  let hasHistory = false
  const stars = lib.stars.map((s): EStar => {
    for (const l of s.listIds) {
      listCounts.set(l, (listCounts.get(l) ?? 0) + 1)
    }
    const rules = cruftRules(s, now)
    const cruft = cruftScore(rules.score, s.suggestion?.cruft)
    const g = growth(s.stars, s.growth, lib.today)
    if (g.d7 != null) {
      hasHistory = true
    }
    return {
      ...s,
      health: health(s, now),
      rules,
      cruft,
      isCruft: cruft >= CRUFT_THRESHOLD,
      g,
      momentum: momentum(s, now),
      rediscover: rediscoverScore(s, cruft, now, seed),
      snoozed: s.snoozedUntil != null && new Date(s.snoozedUntil) > now,
    }
  })
  return {
    stars,
    byId: new Map(stars.map((s) => [s.id, s])),
    lists: lib.lists,
    listsById: new Map(lib.lists.map((l) => [l.id, l])),
    listCounts,
    hasHistory,
    library: lib,
  }
}

/* ---------- Mutations ---------- */

function errMsg(e: unknown) {
  return e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong'
}

function useLibraryPatch() {
  const qc = useQueryClient()
  return useCallback(
    (fn: (lib: Library) => Library) => {
      const prev = qc.getQueryData<Library>(qk.library)
      if (prev) {
        qc.setQueryData<Library>(qk.library, fn(structuredClone(prev)))
      }
      return () => prev && qc.setQueryData(qk.library, prev)
    },
    [qc],
  )
}

export function useUpdateLists() {
  const patch = useLibraryPatch()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: {
      repoIds: string[]
      add?: string[]
      remove?: string[]
      quiet?: boolean
    }) => {
      const add = v.add ?? []
      const remove = v.remove ?? []
      const rollback = patch((lib) => {
        const ids = new Set(v.repoIds)
        for (const s of lib.stars) {
          if (ids.has(s.id)) {
            s.listIds = [...new Set([...s.listIds.filter((l) => !remove.includes(l)), ...add])]
          }
        }
        return lib
      })
      let failed = 0
      try {
        for (const part of chunk(v.repoIds, 40)) {
          const res = await backend.updateLists({ repoIds: part, add, remove })
          failed += res.failed.length
        }
      } catch (e) {
        rollback()
        throw e
      }
      if (failed) {
        toast.warning(`${failed} repo${failed > 1 ? 's' : ''} couldn't be updated`)
        void qc.invalidateQueries({ queryKey: qk.library })
      }
      return v
    },
    onSuccess: (v) => {
      if (v.quiet) {
        return
      }
      const lib = qc.getQueryData<Library>(qk.library)
      const name = (id: string) => lib?.lists.find((l) => l.id === id)?.name ?? 'list'
      const n = v.repoIds.length
      const what = n === 1 ? '1 repo' : `${n} repos`
      if (v.add?.length) {
        toast.success(`Added ${what} to ${v.add.map(name).join(', ')}`)
      } else if (v.remove?.length) {
        toast.success(`Removed ${what} from ${v.remove.map(name).join(', ')}`)
      }
    },
    onError: (e) => toast.error(errMsg(e)),
  })
}

export function useStar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (repoIds: string[]) => {
      for (const part of chunk(repoIds, 40)) {
        await backend.star(part)
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.library })
    },
    onError: (e) => toast.error(errMsg(e)),
  })
}

export function useUnstar() {
  const patch = useLibraryPatch()
  const qc = useQueryClient()
  const star = useStar()
  return useMutation({
    mutationFn: async (repoIds: string[]) => {
      const rollback = patch((lib) => {
        const ids = new Set(repoIds)
        const removed = lib.stars.filter((s) => ids.has(s.id))
        lib.stars = lib.stars.filter((s) => !ids.has(s.id))
        lib.recentlyUnstarred = [
          ...removed.map((s) => ({
            repoId: s.id,
            fullName: s.fullName,
            unstarredAt: new Date().toISOString(),
          })),
          ...lib.recentlyUnstarred,
        ]
        return lib
      })
      const ok: string[] = []
      try {
        for (const part of chunk(repoIds, 40)) {
          ok.push(...(await backend.unstar(part)).ok)
        }
      } catch (e) {
        rollback()
        throw e
      }
      if (ok.length < repoIds.length) {
        void qc.invalidateQueries({ queryKey: qk.library })
      }
      return ok
    },
    onSuccess: (ok) => {
      const lib = qc.getQueryData<Library>(qk.library)
      const label =
        ok.length === 1
          ? (lib?.recentlyUnstarred.find((u) => u.repoId === ok[0])?.fullName ?? '1 repo')
          : `${ok.length} repos`
      toast(`Unstarred ${label}`, {
        action: { label: 'Undo', onClick: () => star.mutate(ok) },
      })
    },
    onError: (e) => toast.error(errMsg(e)),
  })
}

export function useReview() {
  const patch = useLibraryPatch()
  return useMutation({
    mutationFn: async (v: ReviewInput) => {
      const rollback = patch((lib) => {
        const ids = new Set(v.repoIds)
        const now = new Date()
        for (const s of lib.stars) {
          if (!ids.has(s.id)) {
            continue
          }
          if (v.action === 'keep') {
            s.reviewedAt = now.toISOString()
            s.snoozedUntil = null
          } else if (v.action === 'snooze') {
            s.snoozedUntil = new Date(now.getTime() + (v.days ?? 90) * 86_400_000).toISOString()
          } else {
            s.reviewedAt = s.snoozedUntil = null
          }
        }
        return lib
      })
      try {
        await backend.review(v)
      } catch (e) {
        rollback()
        throw e
      }
    },
    onError: (e) => toast.error(errMsg(e)),
  })
}

export function useCreateList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateListInput) => backend.createList(input),
    onSuccess: (list) => {
      qc.setQueryData<Library>(qk.library, (lib) =>
        lib
          ? { ...lib, lists: [...lib.lists, list].sort((a, b) => a.name.localeCompare(b.name)) }
          : lib,
      )
    },
    onError: (e) => toast.error(errMsg(e)),
  })
}

export function useEditList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id: string; input: Partial<CreateListInput> }) =>
      backend.updateList(v.id, v.input),
    onSuccess: (list) => {
      qc.setQueryData<Library>(qk.library, (lib) =>
        lib ? { ...lib, lists: lib.lists.map((l) => (l.id === list.id ? list : l)) } : lib,
      )
      toast.success('List updated')
    },
    onError: (e) => toast.error(errMsg(e)),
  })
}

export function useDeleteList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await backend.deleteList(id)
      return id
    },
    onSuccess: (id) => {
      qc.setQueryData<Library>(qk.library, (lib) =>
        lib
          ? {
              ...lib,
              lists: lib.lists.filter((l) => l.id !== id),
              stars: lib.stars.map((s) => ({ ...s, listIds: s.listIds.filter((l) => l !== id) })),
            }
          : lib,
      )
      toast.success('List deleted')
    },
    onError: (e) => toast.error(errMsg(e)),
  })
}

/* ---------- Long-running loops ---------- */

export interface Progress {
  running: boolean
  label: string
  pct: number
  /** Items done so far and the total, when the loop counts them (sync: stars fetched). */
  done?: number
  total?: number
}

const idle: Progress = { running: false, label: '', pct: 0 }

export function useSync() {
  const qc = useQueryClient()
  const [p, setP] = useState<Progress>(idle)
  const run = useCallback(async () => {
    if (p.running) {
      return
    }
    const runId = crypto.randomUUID()
    let done = 0
    let total: number | undefined
    let cursor: string | null = null
    setP({ running: true, label: 'Fetching stars…', pct: 2 })
    try {
      for (;;) {
        const step = await backend.sync({ runId, phase: 'stars', cursor })
        done += step.processed
        total = step.total
        setP({
          running: true,
          label: `Fetched ${done.toLocaleString()} of ${step.total.toLocaleString()} stars`,
          pct: Math.min(85, (done / Math.max(step.total, 1)) * 85),
          done,
          total,
        })
        if (step.phase !== 'stars') {
          break
        }
        cursor = step.cursor
      }
      setP({ running: true, label: 'Syncing lists…', pct: 90, done, total })
      await backend.sync({ runId, phase: 'lists', cursor: null })
      setP({ running: true, label: 'Tidying up…', pct: 97, done, total })
      await backend.sync({ runId, phase: 'finish', cursor: null })
      await qc.invalidateQueries({ queryKey: qk.library })
      toast.success(`Synced ${done.toLocaleString()} stars`)
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setP(idle)
    }
  }, [p.running, qc])
  return useMemo(() => ({ progress: p, run }), [p, run])
}

export function useClassify() {
  const qc = useQueryClient()
  const [p, setP] = useState<Progress>(idle)
  const run = useCallback(
    async (scope: ClassifyInput['scope']) => {
      if (p.running) {
        return
      }
      const before = new Date().toISOString()
      let done = 0
      setP({ running: true, label: 'Asking Clef…', pct: 3 })
      try {
        for (;;) {
          const res = await backend.classify({ scope, before })
          done += res.processed
          const total = done + res.remaining
          setP({
            running: true,
            label: `Classified ${done} of ${total}`,
            pct: total ? (done / total) * 100 : 100,
          })
          if (res.remaining === 0 || res.processed === 0) {
            break
          }
        }
        await qc.invalidateQueries({ queryKey: qk.library })
        toast.success(done ? `Clef reviewed ${done} repos` : 'Nothing left to classify')
      } catch (e) {
        toast.error(errMsg(e))
      } finally {
        setP(idle)
      }
    },
    [p.running, qc],
  )
  return useMemo(() => ({ progress: p, run }), [p, run])
}
