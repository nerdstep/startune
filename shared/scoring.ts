import type { GrowthBasis, Star, StarList } from './schemas'

const DAY = 86_400_000

export function daysBetween(a: string | Date, b: string | Date): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / DAY
}

/* ---------- Health ---------- */

export type Health = 'thriving' | 'active' | 'quiet' | 'dormant' | 'archived'
export const HEALTH_ORDER: Health[] = ['thriving', 'active', 'quiet', 'dormant', 'archived']
export const HEALTH_LABEL: Record<Health, string> = {
  thriving: 'Thriving',
  active: 'Active',
  quiet: 'Quiet',
  dormant: 'Dormant',
  archived: 'Archived',
}
export const HEALTH_HINT: Record<Health, string> = {
  thriving: 'Pushed in the last 3 months',
  active: 'Pushed in the last year',
  quiet: 'No push in 1–3 years',
  dormant: 'No push in 3+ years',
  archived: 'Archived by its owner',
}

export function health(repo: Pick<Star, 'isArchived' | 'pushedAt'>, now: Date): Health {
  if (repo.isArchived) {
    return 'archived'
  }
  if (!repo.pushedAt) {
    return 'dormant'
  }
  const d = daysBetween(repo.pushedAt, now)
  if (d <= 90) {
    return 'thriving'
  }
  if (d <= 365) {
    return 'active'
  }
  if (d <= 365 * 3) {
    return 'quiet'
  }
  return 'dormant'
}

/* ---------- Cruft (rules) ---------- */

export const DEPRECATION =
  /\b(deprecated|unmaintained|no longer (maintained|supported|developed)|not maintained|abandoned|archived|obsolete|superseded|moved to|has moved|use .{1,40} instead|end of life|eol)\b/i

export interface CruftResult {
  score: number // 0..1
  reasons: string[]
}

/** Heuristic probability that a star is no longer worth keeping. */
export function cruftRules(
  repo: Pick<
    Star,
    'isArchived' | 'pushedAt' | 'description' | 'isFork' | 'stars' | 'latestReleaseAt'
  >,
  now: Date,
): CruftResult {
  const signals: Array<[number, string]> = []
  if (repo.isArchived) {
    signals.push([0.6, 'Archived'])
  }
  if (repo.description && DEPRECATION.test(repo.description)) {
    signals.push([0.55, "Description says it's deprecated or moved"])
  }

  const idle = repo.pushedAt ? daysBetween(repo.pushedAt, now) : Infinity
  if (idle > 365 * 5) {
    signals.push([0.45, `No push in ${Math.floor(idle / 365)}+ years`])
  } else if (idle > 365 * 3) {
    signals.push([0.3, `No push in ${Math.floor(idle / 365)}+ years`])
  } else if (idle > 365 * 2) {
    signals.push([0.12, 'No push in 2+ years'])
  }

  if (repo.isFork) {
    signals.push([0.15, "It's a fork"])
  }
  if (repo.stars < 30 && idle > 365 * 2) {
    signals.push([0.15, 'Small and inactive'])
  }

  // Recent release or push is evidence against cruft.
  const releaseAge = repo.latestReleaseAt ? daysBetween(repo.latestReleaseAt, now) : Infinity
  const fresh = idle < 180 || releaseAge < 365

  let keep = 1
  for (const [w] of signals) {
    keep *= 1 - w
  }
  let score = 1 - keep
  if (fresh && !repo.isArchived) {
    score *= 0.4
  }
  return { score: round(score), reasons: signals.map(([, r]) => r) }
}

/** Combine rule score with an AI probability when present. */
export function cruftScore(rules: number, ai: number | null | undefined): number {
  if (ai == null) {
    return rules
  }
  return round(0.45 * rules + 0.55 * ai)
}

export const CRUFT_THRESHOLD = 0.5

/**
 * A star's cruft: rules blended with Clef's view. Your own repos are never cruft: starring them
 * isn't a judgement to revisit, however quiet they are.
 */
export function starCruft(
  star: Parameters<typeof cruftRules>[0] & Pick<Star, 'owner' | 'suggestion'>,
  login: string,
  now: Date,
): { rules: CruftResult; cruft: number } {
  if (star.owner.toLowerCase() === login.toLowerCase()) {
    return { rules: { score: 0, reasons: [] }, cruft: 0 }
  }
  const rules = cruftRules(star, now)
  return { rules, cruft: cruftScore(rules.score, star.suggestion?.cruft) }
}

/* ---------- Growth / trending ---------- */

export interface Growth {
  d7: number | null
  d30: number | null
  /** Relative 30-day growth, e.g. 0.12 = +12% */
  pct30: number | null
  estimated: boolean
}

/**
 * Turn snapshot bases into growth numbers. When there is no snapshot
 * that old yet, extrapolate from the earliest snapshot if it's at least 2 days old.
 */
export function growth(stars: number, basis: GrowthBasis, today: string): Growth {
  let estimated = false
  const fromBase = (base: number | null, days: number): number | null => {
    if (base != null) {
      return stars - base
    }
    if (basis.earliestDay == null || basis.earliestStars == null) {
      return null
    }
    const span = daysBetween(basis.earliestDay, today)
    if (span < 2) {
      return null
    }
    estimated = true
    return Math.round(((stars - basis.earliestStars) * days) / span)
  }
  const d7 = fromBase(basis.base7, 7)
  const d30 = fromBase(basis.base30, 30)
  const start30 = d30 != null ? stars - d30 : null
  const pct30 = d30 != null && start30 != null && start30 > 0 ? round(d30 / start30) : null
  return { d7, d30, pct30, estimated }
}

/** Rough stars-per-day since creation, for when there's no history yet. */
export function momentum(repo: Pick<Star, 'stars' | 'createdAt'>, now: Date): number {
  if (!repo.createdAt) {
    return 0
  }
  const age = Math.max(daysBetween(repo.createdAt, now), 30)
  return repo.stars / age
}

/* ---------- Rediscover ---------- */

/**
 * Higher = better candidate to resurface: starred long ago, never reviewed,
 * still alive, and grown since. Includes a deterministic per-day jitter so the
 * deck reshuffles daily.
 */
export function rediscoverScore(
  s: Pick<Star, 'id' | 'starredAt' | 'reviewedAt' | 'stars' | 'pushedAt' | 'isArchived'>,
  cruft: number,
  now: Date,
  seed: string,
): number {
  const ageYears = daysBetween(s.starredAt, now) / 365
  if (ageYears < 0.75 || s.isArchived) {
    return 0
  }
  const reviewedRecently = s.reviewedAt ? daysBetween(s.reviewedAt, now) < 180 : false
  if (reviewedRecently) {
    return 0
  }
  const alive = s.pushedAt ? Math.max(0, 1 - daysBetween(s.pushedAt, now) / 730) : 0
  const popularity = Math.min(1, Math.log10(Math.max(s.stars, 1)) / 5)
  const age = Math.min(1, ageYears / 6)
  const jitter = hash01(s.id + seed) * 0.25
  return round((0.35 * age + 0.35 * alive + 0.3 * popularity) * (1 - cruft) + jitter)
}

/* ---------- List ideas ---------- */

export interface ListIdea {
  topic: string
  repoIds: string[]
}

/** Topics shared by several unlisted repos that don't already have a list. */
export function listIdeas(stars: Star[], lists: StarList[], min = 4, max = 8): ListIdea[] {
  const taken = new Set(lists.flatMap((l) => [norm(l.name), norm(l.slug)]))
  // Language topics ("rust", "typescript") are better served by the language filter.
  for (const s of stars) {
    if (s.language) {
      taken.add(norm(s.language))
    }
  }
  const byTopic = new Map<string, string[]>()
  for (const s of stars) {
    if (s.listIds.length > 0) {
      continue
    }
    for (const t of s.topics) {
      const arr = byTopic.get(t) ?? []
      arr.push(s.id)
      byTopic.set(t, arr)
    }
  }
  return [...byTopic.entries()]
    .filter(([t, ids]) => ids.length >= min && !taken.has(norm(t)) && !GENERIC_TOPICS.has(t))
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, max)
    .map(([topic, repoIds]) => ({ topic, repoIds }))
}

const GENERIC_TOPICS = new Set(['hacktoberfest', 'awesome', 'github', 'open-source', 'opensource'])

/** Weighted topic interest, favouring recent stars. */
export function topTopics(stars: Pick<Star, 'topics' | 'starredAt'>[], now: Date, n = 6): string[] {
  const w = new Map<string, number>()
  for (const s of stars) {
    const years = daysBetween(s.starredAt, now) / 365
    const weight = recencyWeight(years)
    for (const t of s.topics) {
      if (!GENERIC_TOPICS.has(t)) {
        w.set(t, (w.get(t) ?? 0) + weight)
      }
    }
  }
  return [...w.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([t]) => t)
}

/* ---------- utils ---------- */

function recencyWeight(years: number): number {
  if (years < 1) {
    return 3
  }
  if (years < 3) {
    return 1.5
  }
  return 0.5
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 10_000) / 10_000
}
