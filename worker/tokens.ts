import { decrypt, encrypt } from './crypto'
import { HttpError, type Bindings } from './env'

/**
 * GitHub user tokens, including expiring ones. An OAuth app with "Expire user access tokens"
 * issues 8-hour access tokens with 6-month refresh tokens, and each refresh rotates both: the old
 * pair stops working. Tokens without an expiry (personal access tokens, or expiry turned off) are
 * stored without one and never refreshed.
 */

/** A token as GitHub's OAuth token endpoint grants it (code exchange or refresh). */
export interface TokenGrant {
  accessToken: string
  scopes: string | null
  /** Set only when the OAuth app expires tokens. */
  refreshToken: string | null
  expiresAt: number | null
  refreshExpiresAt: number | null
}

/** The token endpoint's JSON body. A refusal comes back as 200 with `error` and no token. */
interface GrantBody {
  access_token?: string
  scope?: string
  refresh_token?: string
  expires_in?: number
  refresh_token_expires_in?: number
}

/**
 * What asking GitHub for a token can come to. `refused` means GitHub answered and said no (a bad,
 * used or revoked code or refresh token); `unavailable` means it couldn't answer (network error,
 * 5xx, rate limit), and trying again later may work.
 */
export type GrantResult =
  | { kind: 'granted'; grant: TokenGrant }
  | { kind: 'refused' }
  | { kind: 'unavailable' }

/** The stored token columns of `users`: every query, insert and update builds from this list. */
export const TOKEN_COLUMNS = [
  'token_enc',
  'refresh_enc',
  'token_expires_at',
  'refresh_expires_at',
] as const

/** A user's stored tokens: the access token and, for expiring tokens, the refresh token. */
export interface StoredTokens {
  token_enc: string
  refresh_enc: string | null
  /** Unix ms; null for a token that doesn't expire. */
  token_expires_at: number | null
  refresh_expires_at: number | null
}

export type TokenRow = StoredTokens & { id: string }

/** The token columns, qualified by a table alias, for a SELECT list. */
export const tokenColumnList = (alias = '') =>
  TOKEN_COLUMNS.map((c) => (alias ? `${alias}.${c}` : c)).join(', ')

/** The stored values in TOKEN_COLUMNS order, for `.bind()`. */
export const tokenValues = (t: StoredTokens) => TOKEN_COLUMNS.map((c) => t[c])

/** Refresh this long before expiry, so a token never runs out partway through a request. */
export const REFRESH_EARLY_MS = 5 * 60_000

/**
 * After GitHub refuses a refresh, re-read the row this many times, pausing between reads: a
 * concurrent request may have won the refresh and not saved its new pair yet.
 */
const RACE_CHECKS = 8
const RACE_PAUSE_MS = 250

const EXPIRED = 'Your GitHub sign-in has expired. Please sign in again.'
const UNREADABLE =
  "Your saved GitHub sign-in can't be read (was SESSION_SECRET changed?). Please sign in again."
const UNAVAILABLE = "GitHub isn't responding right now. Please try again in a minute."

export function readGrant(body: GrantBody, now = Date.now()): TokenGrant | null {
  if (!body.access_token) {
    return null
  }
  return {
    accessToken: body.access_token,
    scopes: body.scope ?? null,
    refreshToken: body.refresh_token ?? null,
    expiresAt: body.expires_in ? now + body.expires_in * 1000 : null,
    refreshExpiresAt: body.refresh_token_expires_in
      ? now + body.refresh_token_expires_in * 1000
      : null,
  }
}

/** POSTs to GitHub's token endpoint with the app's credentials plus `params`. */
export async function requestGrant(
  env: Bindings,
  params: Record<string, string>,
): Promise<GrantResult> {
  let body: GrantBody
  try {
    const res = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'StarTune',
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        ...params,
      }),
    })
    if (!res.ok) {
      return { kind: 'unavailable' }
    }
    body = (await res.json()) as GrantBody
  } catch {
    return { kind: 'unavailable' }
  }
  const grant = readGrant(body)
  return grant ? { kind: 'granted', grant } : { kind: 'refused' }
}

/** A grant encrypted into its stored columns. */
export async function storedTokens(secret: string, grant: TokenGrant): Promise<StoredTokens> {
  return {
    token_enc: await encrypt(secret, grant.accessToken),
    refresh_enc: grant.refreshToken ? await encrypt(secret, grant.refreshToken) : null,
    token_expires_at: grant.expiresAt,
    refresh_expires_at: grant.refreshExpiresAt,
  }
}

const usable = (expiresAt: number | null, now: number) =>
  expiresAt == null || expiresAt - REFRESH_EARLY_MS > now

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Ends every session of this user, so the app shows the sign-in page, and says why. */
async function signOut(env: Bindings, userId: string, why: string): Promise<never> {
  await env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(userId).run()
  throw new HttpError(401, why)
}

async function decryptOrSignOut(env: Bindings, userId: string, enc: string): Promise<string> {
  try {
    return await decrypt(env.SESSION_SECRET, enc)
  } catch {
    return signOut(env, userId, UNREADABLE)
  }
}

/**
 * A working GitHub access token for this user, refreshing it first when it is about to expire.
 *
 * Only GitHub refusing the refresh ends the user's sessions. If GitHub can't be reached, this
 * throws a 502 and the session stays, so a GitHub outage never signs anyone out. Refresh tokens
 * are single-use, so when two requests refresh at once one is refused: before giving up it
 * re-reads the row for a couple of seconds, and uses the winner's new token once it is saved.
 * `wait` is the pause between those reads (tests pass their own).
 */
export async function githubToken(
  env: Bindings,
  row: TokenRow,
  wait: (ms: number) => Promise<void> = pause,
): Promise<string> {
  const now = Date.now()
  if (usable(row.token_expires_at, now)) {
    return decryptOrSignOut(env, row.id, row.token_enc)
  }
  const refreshExpired = row.refresh_expires_at != null && row.refresh_expires_at <= now
  if (row.refresh_enc == null || refreshExpired) {
    return signOut(env, row.id, EXPIRED)
  }

  const result = await requestGrant(env, {
    grant_type: 'refresh_token',
    refresh_token: await decryptOrSignOut(env, row.id, row.refresh_enc),
  })
  if (result.kind === 'granted') {
    const stored = await storedTokens(env.SESSION_SECRET, result.grant)
    const sets = TOKEN_COLUMNS.map((c, i) => `${c} = ?${i + 2}`).join(', ')
    await env.DB.prepare(`UPDATE users SET ${sets} WHERE id = ?1`)
      .bind(row.id, ...tokenValues(stored))
      .run()
    return result.grant.accessToken
  }
  if (result.kind === 'unavailable') {
    throw new HttpError(502, UNAVAILABLE)
  }

  for (let i = 0; i < RACE_CHECKS; i += 1) {
    const latest = await env.DB.prepare(
      `SELECT token_enc, token_expires_at FROM users WHERE id = ?1`,
    )
      .bind(row.id)
      .first<Pick<StoredTokens, 'token_enc' | 'token_expires_at'>>()
    if (latest && latest.token_enc !== row.token_enc && usable(latest.token_expires_at, now)) {
      return decryptOrSignOut(env, row.id, latest.token_enc)
    }
    await wait(RACE_PAUSE_MS)
  }
  return signOut(env, row.id, EXPIRED)
}
