import { afterEach, describe, expect, it, vi } from 'vitest'

import { decrypt, encrypt } from '../worker/crypto'
import type { Bindings } from '../worker/env'
import {
  githubToken,
  readGrant,
  REFRESH_EARLY_MS,
  TOKEN_COLUMNS,
  type TokenRow,
} from '../worker/tokens'

const SECRET = 'test-secret-for-token-refresh'
const HOUR = 3_600_000
const noWait = async () => {}

/** A users row with the given token state, encrypted as the Worker stores it. */
async function userRow(over: {
  access?: string
  refresh?: string | null
  expiresIn?: number | null
  refreshExpiresIn?: number | null
}): Promise<TokenRow> {
  const now = Date.now()
  return {
    id: 'U_1',
    token_enc: await encrypt(SECRET, over.access ?? 'ghu_old'),
    refresh_enc: over.refresh === null ? null : await encrypt(SECRET, over.refresh ?? 'ghr_old'),
    token_expires_at: over.expiresIn == null ? null : now + over.expiresIn,
    refresh_expires_at: over.refreshExpiresIn == null ? null : now + over.refreshExpiresIn,
  }
}

/**
 * Just enough D1 for githubToken: the stored users row (updated in place, re-read on demand) and
 * whether the user's sessions were deleted.
 */
function fakeEnv(stored: TokenRow) {
  let sessionsDeleted = false
  const DB = {
    prepare: (q: string) => ({
      bind: (...args: unknown[]) => ({
        run: async () => {
          if (q.startsWith('UPDATE users')) {
            // ?1 is the id, then the token columns in TOKEN_COLUMNS order.
            for (const [i, col] of TOKEN_COLUMNS.entries()) {
              Object.assign(stored, { [col]: args[i + 1] })
            }
          }
          if (q.startsWith('DELETE FROM sessions')) {
            sessionsDeleted = true
          }
          return {}
        },
        first: async () => ({ ...stored }),
      }),
    }),
  }
  const env = {
    DB,
    SESSION_SECRET: SECRET,
    GITHUB_CLIENT_ID: 'cid',
    GITHUB_CLIENT_SECRET: 'csecret',
  } as unknown as Bindings
  return { env, sessionsDeleted: () => sessionsDeleted }
}

function stubGitHub(respond: () => Response | Promise<Response>) {
  const fetch = vi.fn(async () => respond())
  vi.stubGlobal('fetch', fetch)
  return fetch
}

const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status })

/** An expired access token with a live refresh token: the case that needs a refresh. */
const needsRefresh = () => userRow({ expiresIn: -1000, refreshExpiresIn: HOUR })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readGrant', () => {
  it('turns lifetimes into expiry times, and reads a token that never expires', () => {
    const now = 1_000_000
    expect(
      readGrant(
        { access_token: 'a', refresh_token: 'r', expires_in: 28800, refresh_token_expires_in: 60 },
        now,
      ),
    ).toEqual({
      accessToken: 'a',
      scopes: null,
      refreshToken: 'r',
      expiresAt: now + 28_800_000,
      refreshExpiresAt: now + 60_000,
    })
    expect(readGrant({ access_token: 'a', scope: 'read:user' }, now)).toMatchObject({
      refreshToken: null,
      expiresAt: null,
    })
  })

  it('is null for a refusal (GitHub answers 200 with no token)', () => {
    expect(readGrant({})).toBeNull()
  })
})

describe('githubToken', () => {
  it("uses a token that doesn't expire without calling GitHub", async () => {
    const fetch = stubGitHub(() => json({}))
    const row = await userRow({ access: 'ghp_classic', refresh: null, expiresIn: null })
    expect(await githubToken(fakeEnv(row).env, row, noWait)).toBe('ghp_classic')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('uses an expiring token that still has time left', async () => {
    const fetch = stubGitHub(() => json({}))
    const row = await userRow({ access: 'ghu_live', expiresIn: HOUR, refreshExpiresIn: 24 * HOUR })
    expect(await githubToken(fakeEnv(row).env, row, noWait)).toBe('ghu_live')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('refreshes a token about to expire, and stores the rotated pair encrypted', async () => {
    const fetch = stubGitHub(() =>
      json({
        access_token: 'ghu_new',
        refresh_token: 'ghr_new',
        expires_in: 28800,
        refresh_token_expires_in: 15897600,
      }),
    )
    const row = await userRow({ expiresIn: REFRESH_EARLY_MS - 1000, refreshExpiresIn: HOUR })
    const { env } = fakeEnv(row)

    expect(await githubToken(env, { ...row }, noWait)).toBe('ghu_new')
    const sent = JSON.parse(
      (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body as string,
    )
    expect(sent).toMatchObject({
      grant_type: 'refresh_token',
      refresh_token: 'ghr_old',
      client_id: 'cid',
    })
    expect(await decrypt(SECRET, row.token_enc)).toBe('ghu_new')
    expect(await decrypt(SECRET, row.refresh_enc ?? '')).toBe('ghr_new')
    expect(row.token_expires_at).toBeGreaterThan(Date.now() + 7 * HOUR)
  })

  it('waits for a concurrent refresh to save, then uses its token instead of signing out', async () => {
    stubGitHub(() => json({ error: 'bad_refresh_token' }))
    const stored = await needsRefresh()
    const mine = { ...stored }
    const { env, sessionsDeleted } = fakeEnv(stored)
    // The winning request saves its new pair only after this request's first re-read.
    const newToken = await encrypt(SECRET, 'ghu_from_other_request')
    let waits = 0
    const wait = async () => {
      waits += 1
      if (waits === 2) {
        stored.token_enc = newToken
        stored.token_expires_at = Date.now() + 8 * HOUR
      }
    }

    expect(await githubToken(env, mine, wait)).toBe('ghu_from_other_request')
    expect(sessionsDeleted()).toBe(false)
  })

  it('signs out once GitHub refuses the refresh and no other request has refreshed', async () => {
    stubGitHub(() => json({ error: 'bad_refresh_token' }))
    const row = await needsRefresh()
    const { env, sessionsDeleted } = fakeEnv(row)
    await expect(githubToken(env, { ...row }, noWait)).rejects.toMatchObject({ status: 401 })
    expect(sessionsDeleted()).toBe(true)
  })

  it('keeps the session when GitHub is unavailable (5xx or rate limited)', async () => {
    for (const status of [503, 429]) {
      stubGitHub(() => json({ message: 'unavailable' }, status))
      const row = await needsRefresh()
      const { env, sessionsDeleted } = fakeEnv(row)
      await expect(githubToken(env, { ...row }, noWait)).rejects.toMatchObject({ status: 502 })
      expect(sessionsDeleted()).toBe(false)
    }
  })

  it('keeps the session when GitHub cannot be reached at all', async () => {
    stubGitHub(() => {
      throw new TypeError('fetch failed')
    })
    const row = await needsRefresh()
    const { env, sessionsDeleted } = fakeEnv(row)
    await expect(githubToken(env, { ...row }, noWait)).rejects.toMatchObject({ status: 502 })
    expect(sessionsDeleted()).toBe(false)
  })

  it('signs out when the stored token cannot be decrypted (SESSION_SECRET changed)', async () => {
    const row = await userRow({ refresh: null, expiresIn: null })
    const { env, sessionsDeleted } = fakeEnv(row)
    const otherSecret = { ...env, SESSION_SECRET: 'a-different-secret' } as Bindings
    await expect(githubToken(otherSecret, row, noWait)).rejects.toMatchObject({ status: 401 })
    expect(sessionsDeleted()).toBe(true)
  })

  it("doesn't try a refresh token that has itself expired", async () => {
    const fetch = stubGitHub(() => json({}))
    const row = await userRow({ expiresIn: -1000, refreshExpiresIn: -1000 })
    const { env, sessionsDeleted } = fakeEnv(row)
    await expect(githubToken(env, row, noWait)).rejects.toMatchObject({ status: 401 })
    expect(fetch).not.toHaveBeenCalled()
    expect(sessionsDeleted()).toBe(true)
  })
})
