import { Hono } from 'hono'

import {
  ChartInput,
  ClassifyInput,
  MineQuery,
  CreateListInput,
  RepoIdsInput,
  ReviewInput,
  SyncStepInput,
  UpdateListInput,
  UpdateListsInput,
  type Audience,
  type BulkResult,
  type Discover,
  type Mine,
  type Repo,
  type Me,
  type SyncStep,
} from '../shared/schemas'
import { topTopics } from '../shared/scoring'
import { batchSize, classify } from './ai'
import { currentUser, requireUser } from './auth'
import {
  listIdsForRepo,
  loadLibrary,
  loadOwnRepos,
  pruneStars,
  rowToRepo,
  saveChart,
  saveLists,
  saveOwnRepos,
  saveRepos,
  saveStars,
  setRepoLists,
} from './db'
import { clefModel, daysAgo, HttpError, oauthEnabled, today, type AppEnv } from './env'
import * as gh from './github'
import { valid } from './validate'

/** One page (100 stars) per request: the client reports progress (and the first-run scan fills in) every few seconds. */
const PAGES_PER_STEP = 1
async function ownList(db: D1Database, userId: string, listId: string) {
  const row = await db
    .prepare(`SELECT 1 FROM lists WHERE id = ?1 AND user_id = ?2`)
    .bind(listId, userId)
    .first()
  if (!row) {
    throw new HttpError(404, 'List not found')
  }
}

const CALLS_PER_STEP = 3
const OWN_FRESH_MS = 6 * 3600_000

const CACHED = { 'Cache-Control': 'private, max-age=21600' }

export const api = new Hono<AppEnv>()

  .get('/me', async (c) => {
    const row = await currentUser(c)
    const body: Me = {
      user: row ? { login: row.login, name: row.name, avatarUrl: row.avatar_url } : null,
      oauthEnabled: oauthEnabled(c.env),
      aiModel: clefModel(c.env),
    }
    return c.json(body)
  })

  .use('*', requireUser)

  .get('/library', async (c) => {
    return c.json(await loadLibrary(c.env.DB, c.var.user.id))
  })

  /* ---------- Sync (client-driven so huge libraries never hit Worker limits) ---------- */

  .post('/sync', valid('json', SyncStepInput), async (c) => {
    const { runId, phase, cursor } = c.req.valid('json')
    const { id: userId, token } = c.var.user

    if (phase === 'stars') {
      let after = cursor
      let processed = 0
      let total = 0
      for (let i = 0; i < PAGES_PER_STEP; i += 1) {
        const page = await gh.starPage(token, after)
        total = page.totalCount
        await saveStars(c.env.DB, userId, runId, page.stars)
        processed += page.stars.length
        after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null
        if (!after) {
          break
        }
      }
      const step: SyncStep = { phase: after ? 'stars' : 'lists', cursor: after, processed, total }
      return c.json(step)
    }

    if (phase === 'lists') {
      const lists = await gh.allLists(token)
      await saveLists(c.env.DB, userId, runId, lists)
      const step: SyncStep = {
        phase: 'lists',
        cursor: null,
        processed: lists.length,
        total: lists.length,
      }
      return c.json(step)
    }

    await pruneStars(c.env.DB, userId, runId)
    const step: SyncStep = { phase: 'done', cursor: null, processed: 0, total: 0 }
    return c.json(step)
  })

  /* ---------- Lists ---------- */

  .post('/lists', valid('json', CreateListInput), async (c) => {
    const input = c.req.valid('json')
    const list = await gh.createList(c.var.user.token, input)
    await c.env.DB.prepare(
      `INSERT INTO lists (id, user_id, name, slug, description, is_private) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(list.id, c.var.user.id, list.name, list.slug, list.description, list.isPrivate ? 1 : 0)
      .run()
    return c.json(list)
  })

  .patch('/lists/:id', valid('json', UpdateListInput), async (c) => {
    const id = c.req.param('id')
    await ownList(c.env.DB, c.var.user.id, id)
    const input = c.req.valid('json')
    const list = await gh.updateList(c.var.user.token, id, input)
    await c.env.DB.prepare(
      `UPDATE lists SET name=?2, slug=?3, description=?4, is_private=?5 WHERE id=?1`,
    )
      .bind(id, list.name, list.slug, list.description, list.isPrivate ? 1 : 0)
      .run()
    return c.json(list)
  })

  .delete('/lists/:id', async (c) => {
    const id = c.req.param('id')
    await ownList(c.env.DB, c.var.user.id, id)
    await gh.deleteList(c.var.user.token, id)
    await c.env.DB.batch([
      c.env.DB.prepare(`DELETE FROM list_items WHERE list_id = ?1`).bind(id),
      c.env.DB.prepare(`DELETE FROM lists WHERE id = ?1`).bind(id),
      c.env.DB.prepare(`UPDATE suggestions SET list_id = NULL WHERE list_id = ?1`).bind(id),
    ])
    return c.json({ ok: true })
  })

  /** Add/remove repos to/from lists. One GitHub mutation per repo. */
  .post('/stars/lists', valid('json', UpdateListsInput), async (c) => {
    const { repoIds, add, remove } = c.req.valid('json')
    const { id: userId, token } = c.var.user
    const owned = new Set(
      (
        await c.env.DB.prepare(`SELECT id FROM lists WHERE user_id = ?1`)
          .bind(userId)
          .all<{ id: string }>()
      ).results.map((r) => r.id),
    )
    for (const l of [...add, ...remove]) {
      if (!owned.has(l)) {
        throw new HttpError(404, 'List not found')
      }
    }

    const result: BulkResult = { ok: [], failed: [] }
    for (const repoId of repoIds) {
      try {
        const current = await listIdsForRepo(c.env.DB, userId, repoId)
        const next = [...new Set([...current.filter((l) => !remove.includes(l)), ...add])]
        if (next.length !== current.length || next.some((l) => !current.includes(l))) {
          await gh.setListsForRepo(token, repoId, next)
          await setRepoLists(c.env.DB, userId, repoId, next)
        }
        result.ok.push(repoId)
      } catch (e) {
        if (e instanceof HttpError && (e.status === 401 || e.status === 403 || e.status === 429)) {
          throw e
        }
        result.failed.push({ repoId, error: e instanceof Error ? e.message : String(e) })
      }
    }
    return c.json(result)
  })

  /* ---------- Unstar / restar ---------- */

  .post('/stars/unstar', valid('json', RepoIdsInput), async (c) => {
    const { repoIds } = c.req.valid('json')
    const { id: userId, token } = c.var.user
    const db = c.env.DB
    const result: BulkResult = { ok: [], failed: [] }
    for (const repoId of repoIds) {
      try {
        const star = await db
          .prepare(
            `SELECT s.starred_at, r.full_name FROM stars s JOIN repos r ON r.id = s.repo_id WHERE s.user_id = ?1 AND s.repo_id = ?2`,
          )
          .bind(userId, repoId)
          .first<{ starred_at: string; full_name: string }>()
        if (!star) {
          throw new Error('Not starred')
        }
        const lists = await listIdsForRepo(db, userId, repoId)
        await gh.removeStar(token, repoId)
        await db.batch([
          db
            .prepare(
              `INSERT INTO unstar_log (user_id, repo_id, full_name, starred_at, list_ids, unstarred_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(user_id, repo_id) DO UPDATE SET full_name=excluded.full_name, starred_at=excluded.starred_at,
               list_ids=excluded.list_ids, unstarred_at=excluded.unstarred_at`,
            )
            .bind(
              userId,
              repoId,
              star.full_name,
              star.starred_at,
              JSON.stringify(lists),
              new Date().toISOString(),
            ),
          db.prepare(`DELETE FROM stars WHERE user_id = ?1 AND repo_id = ?2`).bind(userId, repoId),
          db
            .prepare(
              `DELETE FROM list_items WHERE repo_id = ?1 AND list_id IN (SELECT id FROM lists WHERE user_id = ?2)`,
            )
            .bind(repoId, userId),
        ])
        result.ok.push(repoId)
      } catch (e) {
        if (e instanceof HttpError && (e.status === 401 || e.status === 403 || e.status === 429)) {
          throw e
        }
        result.failed.push({ repoId, error: e instanceof Error ? e.message : String(e) })
      }
    }
    return c.json(result)
  })

  /** Star again (undo, or from Discover). Restores lists recorded in the unstar log. */
  .post('/stars/star', valid('json', RepoIdsInput), async (c) => {
    const { repoIds } = c.req.valid('json')
    const { id: userId, token } = c.var.user
    const db = c.env.DB
    const result: BulkResult = { ok: [], failed: [] }
    const fresh = await gh.reposByIds(token, repoIds)
    await saveRepos(
      db,
      fresh.filter((r): r is NonNullable<typeof r> => Boolean(r)),
    )
    for (const [i, repoId] of repoIds.entries()) {
      try {
        if (!fresh[i]) {
          throw new Error('Repository no longer exists')
        }
        await gh.addStar(token, repoId)
        const log = await db
          .prepare(`SELECT list_ids FROM unstar_log WHERE user_id = ?1 AND repo_id = ?2`)
          .bind(userId, repoId)
          .first<{ list_ids: string }>()
        const lists = log ? (JSON.parse(log.list_ids) as string[]) : []
        const stillExist =
          lists.length > 0
            ? (
                await db
                  .prepare(`SELECT id FROM lists WHERE user_id = ?1`)
                  .bind(userId)
                  .all<{ id: string }>()
              ).results
                .map((r) => r.id)
                .filter((id) => lists.includes(id))
            : []
        if (stillExist.length > 0) {
          await gh.setListsForRepo(token, repoId, stillExist)
          await setRepoLists(db, userId, repoId, stillExist)
        }
        await db.batch([
          db
            .prepare(
              `INSERT OR REPLACE INTO stars (user_id, repo_id, starred_at) VALUES (?1, ?2, ?3)`,
            )
            .bind(userId, repoId, new Date().toISOString()),
          db
            .prepare(`DELETE FROM unstar_log WHERE user_id = ?1 AND repo_id = ?2`)
            .bind(userId, repoId),
        ])
        result.ok.push(repoId)
      } catch (e) {
        if (e instanceof HttpError && (e.status === 401 || e.status === 403 || e.status === 429)) {
          throw e
        }
        result.failed.push({ repoId, error: e instanceof Error ? e.message : String(e) })
      }
    }
    return c.json(result)
  })

  /* ---------- Review (local-only state) ---------- */

  .post('/stars/review', valid('json', ReviewInput), async (c) => {
    const { repoIds, action, days } = c.req.valid('json')
    const db = c.env.DB
    const now = new Date()
    const stmts = repoIds.map((id) => {
      if (action === 'keep') {
        return db
          .prepare(
            `UPDATE stars SET reviewed_at = ?3, snoozed_until = NULL WHERE user_id = ?1 AND repo_id = ?2`,
          )
          .bind(c.var.user.id, id, now.toISOString())
      }
      if (action === 'snooze') {
        return db
          .prepare(`UPDATE stars SET snoozed_until = ?3 WHERE user_id = ?1 AND repo_id = ?2`)
          .bind(
            c.var.user.id,
            id,
            new Date(now.getTime() + (days ?? 90) * 86_400_000).toISOString(),
          )
      }
      return db
        .prepare(
          `UPDATE stars SET reviewed_at = NULL, snoozed_until = NULL WHERE user_id = ?1 AND repo_id = ?2`,
        )
        .bind(c.var.user.id, id)
    })
    for (let i = 0; i < stmts.length; i += 80) {
      await db.batch(stmts.slice(i, i + 80))
    }
    return c.json({ ok: true })
  })

  /* ---------- AI (Clef) ---------- */

  .post('/ai/classify', valid('json', ClassifyInput), async (c) => {
    const { scope, before } = c.req.valid('json')
    const db = c.env.DB
    const userId = c.var.user.id
    const lists = (
      await db
        .prepare(`SELECT id, name, description FROM lists WHERE user_id = ?1`)
        .bind(userId)
        .all<{ id: string; name: string; description: string | null }>()
    ).results
    const size = batchSize(lists.length)
    const cutoff = before ?? new Date().toISOString()

    const scopeWhere: Record<typeof scope, string> = {
      unlisted: `AND sg.repo_id IS NULL AND NOT EXISTS (SELECT 1 FROM list_items li JOIN lists l ON l.id = li.list_id WHERE li.repo_id = s.repo_id AND l.user_id = s.user_id)`,
      unclassified: `AND sg.repo_id IS NULL`,
      all: `AND (sg.repo_id IS NULL OR sg.created_at < ?2)`,
    }
    const where = scopeWhere[scope]
    const targetSql = `FROM stars s JOIN repos r ON r.id = s.repo_id
    LEFT JOIN suggestions sg ON sg.user_id = s.user_id AND sg.repo_id = s.repo_id
    WHERE s.user_id = ?1 ${where}`
    const bind = scope === 'all' ? [userId, cutoff] : [userId]

    const { results } = await db
      .prepare(
        `SELECT r.*, s.starred_at ${targetSql} ORDER BY s.starred_at ASC LIMIT ${size * CALLS_PER_STEP}`,
      )
      .bind(...bind)
      .all<Parameters<typeof rowToRepo>[0] & { starred_at: string }>()

    const model = clefModel(c.env)
    const day = today()
    let processed = 0
    for (let i = 0; i < results.length; i += size) {
      const chunk = results
        .slice(i, i + size)
        .map((r) => ({ ...rowToRepo(r), starredAt: r.starred_at }))
      const out = await classify(c.env, chunk, lists, day)
      const now = new Date().toISOString()
      await db.batch(
        out.map((o) =>
          db
            .prepare(
              `INSERT OR REPLACE INTO suggestions (user_id, repo_id, list_id, list_confidence, cruft, model, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
            )
            .bind(userId, o.repoId, o.listId, o.listConfidence, o.cruft, model, now),
        ),
      )
      processed += chunk.length
    }

    const remaining = await db
      .prepare(`SELECT COUNT(*) AS n ${targetSql}`)
      .bind(...bind)
      .first<{ n: number }>()
    return c.json({ processed, remaining: remaining?.n ?? 0 })
  })

  /* ---------- Discover ---------- */

  .get('/discover', async (c) => {
    const userId = c.var.user.id
    const cache = (caches as unknown as { default: Cache }).default
    const key = new Request(`https://startune.cache/discover/${userId}/${today()}`)
    const hit = await cache.match(key)
    if (hit) {
      return c.json(await hit.json<Discover>(), 200, CACHED)
    }

    const { results } = await c.env.DB.prepare(
      `SELECT r.topics, s.starred_at, r.id FROM stars s JOIN repos r ON r.id = s.repo_id WHERE s.user_id = ?1`,
    )
      .bind(userId)
      .all<{ topics: string; starred_at: string; id: string }>()
    const starred = new Set(results.map((r) => r.id))
    const topics = topTopics(
      results.map((r) => ({ topics: JSON.parse(r.topics) as string[], starredAt: r.starred_at })),
      new Date(),
      6,
    )
    const since = daysAgo(120)
    const found =
      topics.length > 0
        ? await gh.searchTopics(
            c.var.user.token,
            topics.map((t) => ({
              key: t,
              q: `topic:${t} created:>${since} stars:>50 archived:false sort:stars`,
            })),
          )
        : []
    const body: Discover = {
      groups: found
        .map((g) => ({ topic: g.key, repos: g.repos.filter((r) => !starred.has(r.id)) }))
        .filter((g) => g.repos.length > 0),
    }
    const res = c.json(body, 200, CACHED)
    c.executionCtx.waitUntil(cache.put(key, res.clone()))
    return res
  })

  /* ---------- Your repos ---------- */

  /** Your public repos. Re-read from GitHub when older than 6 hours, or on ?refresh=1. */
  .get('/mine', valid('query', MineQuery), async (c) => {
    const { id: userId, login, token } = c.var.user
    const row = await c.env.DB.prepare(`SELECT own_synced_at FROM users WHERE id = ?1`)
      .bind(userId)
      .first<{ own_synced_at: string | null }>()
    let syncedAt = row?.own_synced_at ?? null
    const stale = !syncedAt || Date.now() - new Date(syncedAt).getTime() > OWN_FRESH_MS
    if (stale || c.req.valid('query').refresh === '1') {
      await saveOwnRepos(c.env.DB, userId, await gh.ownRepos(token, login))
      syncedAt = new Date().toISOString()
    }
    const body: Mine = { login, repos: await loadOwnRepos(c.env.DB, userId), syncedAt }
    return c.json(body)
  })

  /** Chart star history for up to 3 of your repos (about 11 GitHub calls each at most). */
  .post('/mine/chart', valid('json', ChartInput), async (c) => {
    const { repoIds } = c.req.valid('json')
    const { id: userId, token } = c.var.user
    const repos = await loadOwnRepos(c.env.DB, userId, repoIds)
    const failed: Array<{ repoId: string; error: string }> = []
    const WEEK = 7 * 86_400_000
    for (const r of repos) {
      try {
        const recent = r.chartedAt && Date.now() - new Date(r.chartedAt).getTime() < WEEK
        const prev = r.history && recent ? { history: r.history, exactSince: r.exactSince } : null
        // One repo at a time keeps the request inside the Worker's subrequest budget.
        const chart = await gh.chartRepo(token, r.fullName, r.id, prev)
        if (chart) {
          await saveChart(c.env.DB, userId, r.id, chart)
        } else {
          failed.push({ repoId: r.id, error: "GitHub didn't return this repo" })
        }
      } catch (e) {
        failed.push({ repoId: r.id, error: e instanceof Error ? e.message : 'Charting failed' })
      }
    }
    for (const id of repoIds) {
      if (!repos.some((r) => r.id === id)) {
        failed.push({ repoId: id, error: 'Not one of your repos' })
      }
    }
    return c.json({ repos: await loadOwnRepos(c.env.DB, userId, repoIds), failed })
  })

  /** What your recent stargazers also starred, sampled from up to 40 of them. Cached for the day. */
  .get('/mine/audience', async (c) => {
    const { id: userId, login, token } = c.var.user
    const cache = (caches as unknown as { default: Cache }).default
    const key = new Request(`https://startune.cache/audience/${userId}/${today()}`)
    const hit = await cache.match(key)
    if (hit) {
      return c.json(await hit.json<Audience>(), 200, CACHED)
    }

    const own = await loadOwnRepos(c.env.DB, userId)
    const ownIds = new Set(own.map((r) => r.id))
    const seen = new Set<string>([login.toLowerCase()])
    const people = own
      .flatMap((r) => r.recent)
      .sort((a, b) => b.starredAt.localeCompare(a.starredAt))
      .filter((g) => !seen.has(g.login.toLowerCase()) && Boolean(seen.add(g.login.toLowerCase())))
      .slice(0, 40)
      .map((g) => g.login)
    const lists = await gh.alsoStarred(token, people)
    const tally = new Map<string, { repo: Repo; by: number }>()
    for (const list of lists) {
      for (const r of list) {
        if (ownIds.has(r.id)) {
          continue
        }
        const t = tally.get(r.id)
        if (t) {
          t.by += 1
        } else {
          tally.set(r.id, { repo: r, by: 1 })
        }
      }
    }
    const top = [...tally.values()]
      .sort((a, b) => b.by - a.by || b.repo.stars - a.repo.stars)
      .slice(0, 12)
    const mine =
      top.length > 0
        ? await c.env.DB.prepare(
            `SELECT repo_id FROM stars WHERE user_id = ?1 AND repo_id IN (${top.map((_, i) => `?${i + 2}`).join(',')})`,
          )
            .bind(userId, ...top.map((t) => t.repo.id))
            .all<{ repo_id: string }>()
        : { results: [] }
    const starred = new Set(mine.results.map((r) => r.repo_id))
    const body: Audience = {
      sampled: people.length,
      alsoStarred: top.map((t) => ({ ...t, youStarred: starred.has(t.repo.id) })),
    }
    const res = c.json(body, 200, CACHED)
    c.executionCtx.waitUntil(cache.put(key, res.clone()))
    return res
  })

  /* ---------- Backup ---------- */

  .get('/export', async (c) => {
    const lib = await loadLibrary(c.env.DB, c.var.user.id)
    return c.json(
      {
        exportedAt: new Date().toISOString(),
        user: c.var.user.login,
        lists: lib.lists,
        stars: lib.stars.map(({ growth: _g, suggestion: _s, ...s }) => s),
        unstarred: lib.recentlyUnstarred,
      },
      200,
      {
        'Content-Disposition': `attachment; filename="startune-${c.var.user.login}-${today()}.json"`,
      },
    )
  })
