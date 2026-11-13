export interface Bindings {
  DB: D1Database
  AI: Ai
  ASSETS?: Fetcher
  SESSION_SECRET: string
  GITHUB_CLIENT_ID?: string
  GITHUB_CLIENT_SECRET?: string
  /** Comma-separated GitHub logins. Empty = the first person to sign in owns the install. */
  ALLOWED_USERS?: string
  /** "clef-flash" (default, fast/cheap) or "clef" */
  CLEF_MODEL?: string
  GITHUB_SCOPES?: string
}

export interface SessionUser {
  id: string
  login: string
  token: string
}

export type AppEnv = { Bindings: Bindings; Variables: { user: SessionUser } }

export function oauthEnabled(env: Bindings): boolean {
  const id = env.GITHUB_CLIENT_ID?.trim()
  return (
    id !== undefined &&
    id !== '' &&
    id.toLowerCase() !== 'none' &&
    Boolean(env.GITHUB_CLIENT_SECRET)
  )
}

export function clefModel(env: Bindings): 'clef' | 'clef-flash' {
  return env.CLEF_MODEL === 'clef' ? 'clef' : 'clef-flash'
}

export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502,
    message: string,
  ) {
    super(message)
  }
}

export function today(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export function daysAgo(n: number, d = new Date()): string {
  return today(new Date(d.getTime() - n * 86_400_000))
}
