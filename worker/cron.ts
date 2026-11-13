import { decrypt } from "./crypto";
import { saveRepos } from "./db";
import { daysAgo, today, type Bindings } from "./env";
import { reposByIds } from "./github";

/** GitHub calls per cron run. 100 repos each; keeps free-plan subrequest limits in mind. */
const MAX_CALLS = 30;

/**
 * Daily: refresh repo metadata + record a star-count snapshot (starred and own repos), oldest-fetched first.
 * Repos shared by several users are refreshed once, with whichever token sees them first.
 */
export async function dailyRefresh(env: Bindings) {
  const db = env.DB;
  const day = today();
  const users = (await db.prepare(`SELECT id, token_enc FROM users`).all<{ id: string; token_enc: string }>()).results;
  const done = new Set<string>();
  let calls = 0;

  for (const u of users) {
    if (calls >= MAX_CALLS) break;
    let token: string;
    try {
      token = await decrypt(env.SESSION_SECRET, u.token_enc);
    } catch {
      continue;
    }
    const { results } = await db
      .prepare(
        `SELECT r.id FROM repos r
         WHERE r.id IN (SELECT repo_id FROM stars WHERE user_id = ?1 UNION SELECT repo_id FROM own_repos WHERE user_id = ?1)
           AND substr(r.fetched_at, 1, 10) < ?2
         ORDER BY r.fetched_at ASC LIMIT ?3`,
      )
      .bind(u.id, day, (MAX_CALLS - calls) * 100)
      .all<{ id: string }>();
    const ids = results.map((r) => r.id).filter((id) => !done.has(id));

    for (let i = 0; i < ids.length && calls < MAX_CALLS; i += 100) {
      const chunk = ids.slice(i, i + 100);
      calls++;
      try {
        const repos = await reposByIds(token, chunk);
        await saveRepos(
          db,
          repos.filter((r): r is NonNullable<typeof r> => !!r),
        );
        chunk.forEach((id) => done.add(id));
      } catch (e) {
        console.error("refresh failed", u.id, e);
        break; // bad token or rate limit: move on to the next user
      }
    }
  }

  await db.batch([
    db.prepare(`DELETE FROM sessions WHERE expires_at < ?1`).bind(Date.now()),
    db.prepare(`DELETE FROM snapshots WHERE day < ?1`).bind(daysAgo(400)),
    db.prepare(`DELETE FROM unstar_log WHERE unstarred_at < ?1`).bind(new Date(Date.now() - 180 * 86_400_000).toISOString()),
    db.prepare(
      `DELETE FROM repos WHERE id NOT IN (SELECT repo_id FROM stars) AND id NOT IN (SELECT repo_id FROM unstar_log) AND id NOT IN (SELECT repo_id FROM own_repos)`,
    ),
  ]);
  console.log(`StarTune refresh: ${done.size} repos in ${calls} calls`);
}
