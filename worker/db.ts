import type {
  Library,
  OwnRepo,
  Repo,
  Stargazer,
  Star,
  StarList,
  Unstarred,
  Upkeep,
} from '../shared/schemas'
import { daysAgo, today } from './env'

const CHUNK = 80

async function batch(db: D1Database, stmts: D1PreparedStatement[]) {
  for (let i = 0; i < stmts.length; i += CHUNK) {
    await db.batch(stmts.slice(i, i + CHUNK))
  }
}

export function repoUpsert(db: D1Database, r: Repo, now: string): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO repos (id, full_name, owner, name, description, url, homepage, language, language_color, topics,
        stars, forks, is_archived, is_fork, license, owner_avatar, created_at, pushed_at, latest_release_at, latest_release_tag, fetched_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)
       ON CONFLICT(id) DO UPDATE SET
        full_name=excluded.full_name, owner=excluded.owner, name=excluded.name, description=excluded.description,
        url=excluded.url, homepage=excluded.homepage, language=excluded.language, language_color=excluded.language_color,
        topics=excluded.topics, stars=excluded.stars, forks=excluded.forks, is_archived=excluded.is_archived,
        is_fork=excluded.is_fork, license=excluded.license, owner_avatar=excluded.owner_avatar, created_at=excluded.created_at,
        pushed_at=excluded.pushed_at, latest_release_at=excluded.latest_release_at,
        latest_release_tag=excluded.latest_release_tag, fetched_at=excluded.fetched_at`,
    )
    .bind(
      r.id,
      r.fullName,
      r.owner,
      r.name,
      r.description,
      r.url,
      r.homepage,
      r.language,
      r.languageColor,
      JSON.stringify(r.topics),
      r.stars,
      r.forks,
      r.isArchived ? 1 : 0,
      r.isFork ? 1 : 0,
      r.license,
      r.ownerAvatar,
      r.createdAt,
      r.pushedAt,
      r.latestReleaseAt,
      r.latestReleaseTag,
      now,
    )
}

export function snapshotUpsert(
  db: D1Database,
  repoId: string,
  stars: number,
  day = today(),
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO snapshots (repo_id, day, stars) VALUES (?1, ?2, ?3) ON CONFLICT(repo_id, day) DO UPDATE SET stars=excluded.stars`,
    )
    .bind(repoId, day, stars)
}

export async function saveRepos(db: D1Database, repos: Repo[]) {
  const now = new Date().toISOString()
  await batch(
    db,
    repos.flatMap((r) => [repoUpsert(db, r, now), snapshotUpsert(db, r.id, r.stars)]),
  )
}

export async function saveStars(
  db: D1Database,
  userId: string,
  runId: string,
  edges: Array<{ repo: Repo; starredAt: string }>,
) {
  await saveRepos(
    db,
    edges.map((e) => e.repo),
  )
  await batch(
    db,
    edges.map((e) =>
      db
        .prepare(
          `INSERT INTO stars (user_id, repo_id, starred_at, sync_run) VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT(user_id, repo_id) DO UPDATE SET starred_at=excluded.starred_at, sync_run=excluded.sync_run`,
        )
        .bind(userId, e.repo.id, e.starredAt, runId),
    ),
  )
}

export async function saveLists(
  db: D1Database,
  userId: string,
  runId: string,
  lists: Array<StarList & { repoIds: string[] }>,
) {
  const stmts: D1PreparedStatement[] = []
  for (const l of lists) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO lists (id, user_id, name, slug, description, is_private, sync_run) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, slug=excluded.slug, description=excluded.description,
             is_private=excluded.is_private, sync_run=excluded.sync_run`,
        )
        .bind(l.id, userId, l.name, l.slug, l.description, l.isPrivate ? 1 : 0, runId),
      db.prepare(`DELETE FROM list_items WHERE list_id = ?1`).bind(l.id),
      ...l.repoIds.map((r) =>
        db
          .prepare(`INSERT OR IGNORE INTO list_items (list_id, repo_id) VALUES (?1, ?2)`)
          .bind(l.id, r),
      ),
    )
  }
  // Lists deleted on GitHub since the last sync
  stmts.push(
    db
      .prepare(
        `DELETE FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE user_id = ?1 AND (sync_run IS NULL OR sync_run != ?2))`,
      )
      .bind(userId, runId),
    db
      .prepare(`DELETE FROM lists WHERE user_id = ?1 AND (sync_run IS NULL OR sync_run != ?2)`)
      .bind(userId, runId),
  )
  await batch(db, stmts)
}

/** Remove stars that the last full sync didn't see (unstarred elsewhere). */
export async function pruneStars(db: D1Database, userId: string, runId: string) {
  await db.batch([
    db
      .prepare(`DELETE FROM stars WHERE user_id = ?1 AND (sync_run IS NULL OR sync_run != ?2)`)
      .bind(userId, runId),
    db
      .prepare(`UPDATE users SET last_synced_at = ?2 WHERE id = ?1`)
      .bind(userId, new Date().toISOString()),
  ])
}

export async function listIdsForRepo(
  db: D1Database,
  userId: string,
  repoId: string,
): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT li.list_id FROM list_items li JOIN lists l ON l.id = li.list_id WHERE l.user_id = ?1 AND li.repo_id = ?2`,
    )
    .bind(userId, repoId)
    .all<{ list_id: string }>()
  return results.map((r) => r.list_id)
}

export async function setRepoLists(
  db: D1Database,
  userId: string,
  repoId: string,
  listIds: string[],
) {
  await db.batch([
    db
      .prepare(
        `DELETE FROM list_items WHERE repo_id = ?1 AND list_id IN (SELECT id FROM lists WHERE user_id = ?2)`,
      )
      .bind(repoId, userId),
    ...listIds.map((l) =>
      db
        .prepare(`INSERT OR IGNORE INTO list_items (list_id, repo_id) VALUES (?1, ?2)`)
        .bind(l, repoId),
    ),
  ])
}

/* ---------- Library ---------- */

interface StarRow {
  id: string
  full_name: string
  owner: string
  name: string
  description: string | null
  url: string
  homepage: string | null
  language: string | null
  language_color: string | null
  topics: string
  stars: number
  forks: number
  is_archived: number
  is_fork: number
  license: string | null
  owner_avatar: string | null
  created_at: string | null
  pushed_at: string | null
  latest_release_at: string | null
  latest_release_tag: string | null
  starred_at: string
  reviewed_at: string | null
  snoozed_until: string | null
  list_ids: string | null
  s_list_id: string | null
  s_conf: number | null
  s_cruft: number | null
  s_model: string | null
  base7: number | null
  base30: number | null
  e_day: string | null
  e_stars: number | null
}

export function rowToRepo(
  r: Omit<
    StarRow,
    | 'starred_at'
    | 'reviewed_at'
    | 'snoozed_until'
    | 'list_ids'
    | 's_list_id'
    | 's_conf'
    | 's_cruft'
    | 's_model'
    | 'base7'
    | 'base30'
    | 'e_day'
    | 'e_stars'
  >,
): Repo {
  return {
    id: r.id,
    fullName: r.full_name,
    owner: r.owner,
    name: r.name,
    description: r.description,
    url: r.url,
    homepage: r.homepage,
    language: r.language,
    languageColor: r.language_color,
    topics: safeJson<string[]>(r.topics, []),
    stars: r.stars,
    forks: r.forks,
    isArchived: Boolean(r.is_archived),
    isFork: Boolean(r.is_fork),
    license: r.license,
    ownerAvatar: r.owner_avatar,
    createdAt: r.created_at,
    pushedAt: r.pushed_at,
    latestReleaseAt: r.latest_release_at,
    latestReleaseTag: r.latest_release_tag,
  }
}

export async function loadLibrary(db: D1Database, userId: string): Promise<Library> {
  const d7 = daysAgo(7)
  const d30 = daysAgo(30)
  const [starsRes, listsRes, unstarRes, user] = await Promise.all([
    db
      .prepare(
        `SELECT r.*, s.starred_at, s.reviewed_at, s.snoozed_until,
          (SELECT json_group_array(li.list_id) FROM list_items li JOIN lists l ON l.id = li.list_id
             WHERE li.repo_id = r.id AND l.user_id = ?1) AS list_ids,
          sg.list_id AS s_list_id, sg.list_confidence AS s_conf, sg.cruft AS s_cruft, sg.model AS s_model,
          (SELECT sn.stars FROM snapshots sn WHERE sn.repo_id = r.id AND sn.day <= ?2 ORDER BY sn.day DESC LIMIT 1) AS base7,
          (SELECT sn.stars FROM snapshots sn WHERE sn.repo_id = r.id AND sn.day <= ?3 ORDER BY sn.day DESC LIMIT 1) AS base30,
          (SELECT sn.day FROM snapshots sn WHERE sn.repo_id = r.id ORDER BY sn.day ASC LIMIT 1) AS e_day,
          (SELECT sn.stars FROM snapshots sn WHERE sn.repo_id = r.id ORDER BY sn.day ASC LIMIT 1) AS e_stars
         FROM stars s
         JOIN repos r ON r.id = s.repo_id
         LEFT JOIN suggestions sg ON sg.user_id = s.user_id AND sg.repo_id = s.repo_id
         WHERE s.user_id = ?1
         ORDER BY s.starred_at DESC`,
      )
      .bind(userId, d7, d30)
      .all<StarRow>(),
    db
      .prepare(
        `SELECT id, name, slug, description, is_private FROM lists WHERE user_id = ?1 ORDER BY name COLLATE NOCASE`,
      )
      .bind(userId)
      .all<{
        id: string
        name: string
        slug: string
        description: string | null
        is_private: number
      }>(),
    db
      .prepare(
        `SELECT repo_id, full_name, unstarred_at FROM unstar_log WHERE user_id = ?1 ORDER BY unstarred_at DESC LIMIT 200`,
      )
      .bind(userId)
      .all<{ repo_id: string; full_name: string; unstarred_at: string }>(),
    db
      .prepare(`SELECT login, last_synced_at FROM users WHERE id = ?1`)
      .bind(userId)
      .first<{ login: string; last_synced_at: string | null }>(),
  ])

  const stars: Star[] = starsRes.results.map((r) => ({
    ...rowToRepo(r),
    starredAt: r.starred_at,
    reviewedAt: r.reviewed_at,
    snoozedUntil: r.snoozed_until,
    listIds: safeJson<Array<string | null>>(r.list_ids, []).filter((x): x is string => Boolean(x)),
    suggestion:
      r.s_model != null
        ? {
            listId: r.s_list_id,
            listConfidence: r.s_conf ?? 0,
            cruft: r.s_cruft ?? 0,
            model: r.s_model,
          }
        : null,
    growth: { base7: r.base7, base30: r.base30, earliestDay: r.e_day, earliestStars: r.e_stars },
  }))

  const lists: StarList[] = listsRes.results.map((l) => ({
    id: l.id,
    name: l.name,
    slug: l.slug,
    description: l.description,
    isPrivate: Boolean(l.is_private),
  }))

  const recentlyUnstarred: Unstarred[] = unstarRes.results.map((u) => ({
    repoId: u.repo_id,
    fullName: u.full_name,
    unstarredAt: u.unstarred_at,
  }))

  return {
    stars,
    lists,
    recentlyUnstarred,
    lastSyncedAt: user?.last_synced_at ?? null,
    today: today(),
    login: user?.login ?? '',
  }
}

/* ---------- Your repos ---------- */

export async function saveOwnRepos(
  db: D1Database,
  userId: string,
  rows: Array<{ repo: Repo; upkeep: Upkeep }>,
) {
  const run = crypto.randomUUID()
  await saveRepos(
    db,
    rows.map((r) => r.repo),
  )
  await batch(db, [
    ...rows.map((r) =>
      db
        .prepare(
          `INSERT INTO own_repos (user_id, repo_id, upkeep, sync_run) VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT(user_id, repo_id) DO UPDATE SET upkeep=excluded.upkeep, sync_run=excluded.sync_run`,
        )
        .bind(userId, r.repo.id, JSON.stringify(r.upkeep), run),
    ),
    // Repos deleted, renamed away, or made private since the last refresh
    db
      .prepare(`DELETE FROM own_repos WHERE user_id = ?1 AND (sync_run IS NULL OR sync_run != ?2)`)
      .bind(userId, run),
    db
      .prepare(`UPDATE users SET own_synced_at = ?2 WHERE id = ?1`)
      .bind(userId, new Date().toISOString()),
  ])
}

export async function saveChart(
  db: D1Database,
  userId: string,
  repoId: string,
  c: { history: Array<[number, number]>; exactSince: number | null; recent: Stargazer[] },
) {
  await db
    .prepare(
      `UPDATE own_repos SET history = ?3, exact_since = ?4, recent = ?5, charted_at = ?6 WHERE user_id = ?1 AND repo_id = ?2`,
    )
    .bind(
      userId,
      repoId,
      JSON.stringify(c.history),
      c.exactSince,
      JSON.stringify(c.recent),
      new Date().toISOString(),
    )
    .run()
}

type OwnRow = Parameters<typeof rowToRepo>[0] & {
  upkeep: string
  history: string | null
  exact_since: number | null
  recent: string
  charted_at: string | null
}

const EMPTY_UPKEEP: Upkeep = {
  openIssues: 0,
  openPrs: 0,
  waitingPrs: 0,
  oldestWaitingPrAt: null,
  unanswered: 0,
  oldestUnansweredAt: null,
  watchers: 0,
}

export async function loadOwnRepos(
  db: D1Database,
  userId: string,
  ids?: string[],
): Promise<OwnRepo[]> {
  const only = ids?.length ? ` AND o.repo_id IN (${ids.map((_, i) => `?${i + 2}`).join(',')})` : ''
  const { results } = await db
    .prepare(
      `SELECT r.*, o.upkeep, o.history, o.exact_since, o.recent, o.charted_at FROM own_repos o JOIN repos r ON r.id = o.repo_id WHERE o.user_id = ?1${only} ORDER BY r.stars DESC`,
    )
    .bind(userId, ...(ids ?? []))
    .all<OwnRow>()
  return results.map((r) => ({
    ...rowToRepo(r),
    upkeep: { ...EMPTY_UPKEEP, ...safeJson<Partial<Upkeep>>(r.upkeep, {}) },
    history: safeJson<Array<[number, number]> | null>(r.history, null),
    exactSince: r.exact_since,
    recent: safeJson<Stargazer[]>(r.recent, []),
    chartedAt: r.charted_at,
  }))
}

function safeJson<T>(s: string | null, fallback: T): T {
  if (!s) {
    return fallback
  }
  try {
    return JSON.parse(s) as T
  } catch {
    return fallback
  }
}
