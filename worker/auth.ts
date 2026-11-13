import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import { TokenLoginInput } from '../shared/schemas'
import { randomToken, sha256Hex } from './crypto'
import { HttpError, oauthEnabled, type AppEnv, type Bindings } from './env'
import { rest, viewer } from './github'
import {
  githubToken,
  requestGrant,
  storedTokens,
  TOKEN_COLUMNS,
  tokenColumnList,
  tokenValues,
  type TokenGrant,
  type TokenRow,
} from './tokens'
import { valid } from './validate'

/** Why OAuth sign-in failed, as passed to the sign-in page (src/components/login.tsx). */
export type AuthError = 'denied' | 'expired' | 'no_token' | 'not_allowed' | 'no_owner' | 'failed'

const SESSION_COOKIE = 'st_session'
const STATE_COOKIE = 'st_oauth_state'
const SESSION_DAYS = 30

function secure(c: Context) {
  return new URL(c.req.url).protocol === 'https:'
}

/** The GitHub logins in ALLOWED_USERS, lower-cased. */
function allowList(env: Bindings): string[] {
  return (env.ALLOWED_USERS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

function isLocal(c: Context) {
  const host = new URL(c.req.url).hostname
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
}

/**
 * Who may sign in: the logins in ALLOWED_USERS. Without it, nobody (outside local development):
 * a fresh install's URL can be found before its owner signs in, so it never goes to whoever
 * arrives first.
 */
function canSignIn(c: Context<AppEnv>, login: string): boolean {
  const allow = allowList(c.env)
  return allow.length > 0 ? allow.includes(login.toLowerCase()) : isLocal(c)
}

async function signIn(c: Context<AppEnv>, grant: TokenGrant) {
  const v = await viewer(grant.accessToken)
  if (!canSignIn(c, v.login)) {
    throw new HttpError(
      403,
      allowList(c.env).length > 0
        ? `@${v.login} isn't allowed on this StarTune install. Ask the owner to add you to ALLOWED_USERS.`
        : "This StarTune install doesn't have an owner yet. Set ALLOWED_USERS to your GitHub username, then sign in.",
    )
  }
  const tokens = await storedTokens(c.env.SESSION_SECRET, grant)
  const sid = randomToken()
  const updateTokens = TOKEN_COLUMNS.map((col) => `${col}=excluded.${col}`).join(', ')
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO users (id, login, name, avatar_url, scopes, ${tokenColumnList()})
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(id) DO UPDATE SET login=excluded.login, name=excluded.name,
         avatar_url=excluded.avatar_url, scopes=excluded.scopes, ${updateTokens}`,
    ).bind(v.id, v.login, v.name, v.avatarUrl, grant.scopes, ...tokenValues(tokens)),
    c.env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?1, ?2, ?3)`).bind(
      await sha256Hex(sid),
      v.id,
      Date.now() + SESSION_DAYS * 86_400_000,
    ),
  ])
  setCookie(c, SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: secure(c),
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  })
}

/** Token sign-in makes the Worker call GitHub for anyone who asks, so it is rate limited per IP. */
const limitSignIn: MiddlewareHandler<AppEnv> = async (c, next) => {
  const limiter = c.env.SIGN_IN_LIMIT
  if (limiter) {
    const { success } = await limiter.limit({ key: c.req.header('cf-connecting-ip') ?? 'local' })
    if (!success) {
      throw new HttpError(429, 'Too many sign-in attempts. Wait a minute and try again.')
    }
  }
  await next()
}

export const auth = new Hono<AppEnv>()
  .get('/login', (c) => {
    const clientId = c.env.GITHUB_CLIENT_ID
    if (!oauthEnabled(c.env) || !clientId) {
      return c.redirect('/?auth=token')
    }
    const state = randomToken(16)
    setCookie(c, STATE_COOKIE, state, {
      httpOnly: true,
      secure: secure(c),
      sameSite: 'Lax',
      path: '/auth',
      maxAge: 600,
    })
    const url = new URL('https://github.com/login/oauth/authorize')
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', new URL('/auth/callback', c.req.url).toString())
    // `user` for Lists (GitHub's UserList mutations require it), `public_repo` for starring.
    url.searchParams.set('scope', c.env.GITHUB_SCOPES || 'user public_repo')
    url.searchParams.set('state', state)
    return c.redirect(url.toString())
  })
  .get('/callback', async (c) => {
    const { code, state, error } = c.req.query()
    const expected = getCookie(c, STATE_COOKIE)
    deleteCookie(c, STATE_COOKIE, { path: '/auth' })
    // Only fixed codes go back in the URL (the sign-in page maps them to messages), so a crafted
    // link can't put its own text on this domain.
    const fail = (why: AuthError) => c.redirect(`/?auth_error=${why}`)
    if (error) {
      return fail('denied')
    }
    if (!code || !state || state !== expected) {
      return fail('expired')
    }

    const grant = await requestGrant(c.env, {
      code,
      redirect_uri: new URL('/auth/callback', c.req.url).toString(),
    })
    if (grant.kind !== 'granted') {
      return fail(grant.kind === 'refused' ? 'no_token' : 'failed')
    }
    try {
      await signIn(c, grant.grant)
    } catch (e) {
      if (e instanceof HttpError && e.status === 403) {
        return fail(allowList(c.env).length > 0 ? 'not_allowed' : 'no_owner')
      }
      return fail('failed')
    }
    return c.redirect('/')
  })
  /** Sign in with a personal access token (for installs without an OAuth app). */
  .post('/token', limitSignIn, valid('json', TokenLoginInput), async (c) => {
    const { token } = c.req.valid('json')
    const check = await rest(token, '/user')
    if (check.status === 401) {
      throw new HttpError(401, 'GitHub rejected that token.')
    }
    await signIn(c, {
      accessToken: token,
      scopes: check.headers.get('x-oauth-scopes'),
      refreshToken: null,
      expiresAt: null,
      refreshExpiresAt: null,
    })
    return c.json({ ok: true })
  })
  .post('/logout', async (c) => {
    const sid = getCookie(c, SESSION_COOKIE)
    if (sid) {
      await c.env.DB.prepare(`DELETE FROM sessions WHERE id = ?1`)
        .bind(await sha256Hex(sid))
        .run()
    }
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.json({ ok: true })
  })

export async function currentUser(c: Context<AppEnv>) {
  const sid = getCookie(c, SESSION_COOKIE)
  if (!sid) {
    return null
  }
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.login, u.name, u.avatar_url, ${tokenColumnList('u')}, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?1`,
  )
    .bind(await sha256Hex(sid))
    .first<
      TokenRow & {
        login: string
        name: string | null
        avatar_url: string | null
        expires_at: number
      }
    >()
  if (!row || row.expires_at < Date.now()) {
    return null
  }
  // Taking a login off ALLOWED_USERS ends its sessions on their next request.
  const allow = allowList(c.env)
  if (allow.length > 0 && !allow.includes(row.login.toLowerCase())) {
    await c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(row.id).run()
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return null
  }
  return row
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const row = await currentUser(c)
  if (!row) {
    throw new HttpError(401, 'Not signed in')
  }
  // Refreshes an expiring token first. Throws 401 (and ends the sessions) when the user has to
  // sign in again, or 502 when GitHub can't be reached.
  const token = await githubToken(c.env, row)
  c.set('user', { id: row.id, login: row.login, token })
  await next()
}
