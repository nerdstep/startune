import { attentionScore, ownGrowth, signals, weekly, type Signal } from '@shared/own'
import type { Mine, OwnRepo } from '@shared/schemas'
import { health, type Growth, type Health } from '@shared/scoring'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { toast } from 'sonner'

import { ApiError, backend } from './api'
import { useNow } from './use-now'

export const mineKeys = { mine: ['mine'] as const, audience: ['audience'] as const }

const DAY = 86_400_000

export function useMine() {
  return useQuery({
    queryKey: mineKeys.mine,
    queryFn: () => backend.mine(),
    staleTime: 10 * 60_000,
    retry: 1,
  })
}

export function useAudience(enabled: boolean) {
  return useQuery({
    queryKey: mineKeys.audience,
    queryFn: backend.audience,
    enabled,
    staleTime: 6 * 3600_000,
    retry: 1,
  })
}

export function useRefreshMine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => backend.mine(true),
    onSuccess: (m) => qc.setQueryData(mineKeys.mine, m),
    onError: (e) =>
      toast.error(
        e instanceof ApiError || e instanceof Error ? e.message : "Couldn't refresh from GitHub",
      ),
  })
}

/* ---------- Charting ---------- */

export interface ChartRun {
  done: number
  total: number
  running: boolean
  /** Repos that couldn't be charted this session, with GitHub's reason. Not retried until asked. */
  failed: ReadonlyMap<string, string>
}

// Module-level, so a run carries on (and its progress still shows) when the page is left and reopened.
let run: ChartRun = { done: 0, total: 0, running: false, failed: new Map() }
const listeners = new Set<() => void>()
const charted = new Set<string>()
const update = (patch: Partial<ChartRun>) => {
  run = { ...run, ...patch }
  for (const l of listeners) {
    l()
  }
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useChartRun(): ChartRun {
  return useSyncExternalStore(subscribe, () => run)
}

/** Clear failures so the next pass tries those repos again. */
export function retryCharts() {
  update({ failed: new Map() })
}

/**
 * Chart star history for repos with none yet, or a chart over a day old (a cheap incremental call on the
 * server when the new stars fit in the newest 100): three repos a request, most-starred first, merged
 * into the cached list as each batch lands.
 */
export function useChartMine(mine: Mine | undefined): ChartRun {
  const qc = useQueryClient()
  const state = useChartRun()

  useEffect(() => {
    if (!mine || run.running) {
      return
    }
    const todo = mine.repos
      .filter((r) => r.stars > 0 && !charted.has(r.id) && !run.failed.has(r.id))
      .filter((r) => !r.chartedAt || Date.now() - new Date(r.chartedAt).getTime() > DAY)
      .map((r) => r.id)
    if (todo.length === 0) {
      return
    }
    update({ done: 0, total: todo.length, running: true })
    void (async () => {
      let done = 0
      for (let i = 0; i < todo.length; i += 3) {
        const ids = todo.slice(i, i + 3)
        try {
          // Sequential on purpose: each request spends up to ~30 GitHub calls.
          const res = await backend.chartMine(ids)
          const byId = new Map(res.repos.map((r) => [r.id, r]))
          qc.setQueryData<Mine>(mineKeys.mine, (m) =>
            m ? { ...m, repos: m.repos.map((r) => byId.get(r.id) ?? r) } : m,
          )
          const failed = new Map(run.failed)
          for (const f of res.failed) {
            failed.set(f.repoId, f.error)
          }
          for (const id of ids) {
            if (!failed.has(id)) {
              charted.add(id)
            }
          }
          done += ids.length
          update({ done, failed })
        } catch (e) {
          // The whole request failed (rate limit, network): stop, and mark what's left so it can be retried.
          const msg = e instanceof Error ? e.message : 'Charting failed'
          const failed = new Map(run.failed)
          for (const id of todo.slice(i)) {
            failed.set(id, msg)
          }
          update({ running: false, failed })
          return
        }
      }
      update({ running: false })
    })()
    // `state.failed` re-runs the pass after a retry clears failures.
  }, [mine, qc, state.failed])

  return state
}

/* ---------- Derived view model ---------- */

export interface EOwn extends OwnRepo {
  health: Health
  g: Growth
  /** Stars gained per week, last 26 weeks, oldest first. */
  weeks: number[]
  signals: Signal[]
  attention: number
}

export function useOwnDerived(mine: Mine | undefined): EOwn[] {
  const now = useNow()
  return useMemo(() => {
    if (!mine) {
      return []
    }
    const at = new Date(now)
    return mine.repos.map((r) => {
      const h = health(r, at)
      const g = ownGrowth(r, now)
      const sig = signals(r, h, g, now)
      return {
        ...r,
        health: h,
        g,
        weeks: weekly(r.history, now),
        signals: sig,
        attention: attentionScore(sig),
      }
    })
  }, [mine, now])
}
