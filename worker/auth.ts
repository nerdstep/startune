import { Hono, type Context, type MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { TokenLoginInput } from "../shared/schemas";
import { decrypt, encrypt, randomToken, sha256Hex } from "./crypto";
import { HttpError, oauthEnabled, type AppEnv, type Bindings } from "./env";
import { rest, viewer } from "./github";
import { parseBody } from "./validate";

const SESSION_COOKIE = "st_session";
const STATE_COOKIE = "st_oauth_state";
const SESSION_DAYS = 30;

function secure(c: Context) {
  return new URL(c.req.url).protocol === "https:";
}

async function isAllowed(env: Bindings, login: string): Promise<boolean> {
  const allow = (env.ALLOWED_USERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length) return allow.includes(login.toLowerCase());
  // No allow-list: the first person to sign in claims this install.
  const row = await env.DB.prepare(`SELECT COUNT(*) AS n, SUM(login = ?1 COLLATE NOCASE) AS me FROM users`)
    .bind(login)
    .first<{ n: number; me: number | null }>();
  return !row || row.n === 0 || (row.me ?? 0) > 0;
}

async function signIn(c: Context<AppEnv>, token: string, scopes: string | null) {
  const v = await viewer(token);
  if (!(await isAllowed(c.env, v.login))) {
    throw new HttpError(403, `@${v.login} isn't allowed on this StarTune install. Ask the owner to add you to ALLOWED_USERS.`);
  }
  const tokenEnc = await encrypt(c.env.SESSION_SECRET, token);
  const sid = randomToken();
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO users (id, login, name, avatar_url, token_enc, scopes) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(id) DO UPDATE SET login=excluded.login, name=excluded.name, avatar_url=excluded.avatar_url,
         token_enc=excluded.token_enc, scopes=excluded.scopes`,
    ).bind(v.id, v.login, v.name, v.avatarUrl, tokenEnc, scopes),
    c.env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?1, ?2, ?3)`).bind(
      await sha256Hex(sid),
      v.id,
      Date.now() + SESSION_DAYS * 86_400_000,
    ),
  ]);
  setCookie(c, SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: secure(c),
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export const auth = new Hono<AppEnv>();

auth.get("/login", (c) => {
  if (!oauthEnabled(c.env)) return c.redirect("/?auth=token");
  const state = randomToken(16);
  setCookie(c, STATE_COOKIE, state, { httpOnly: true, secure: secure(c), sameSite: "Lax", path: "/auth", maxAge: 600 });
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", c.env.GITHUB_CLIENT_ID!);
  url.searchParams.set("redirect_uri", new URL("/auth/callback", c.req.url).toString());
  url.searchParams.set("scope", c.env.GITHUB_SCOPES || "read:user public_repo");
  url.searchParams.set("state", state);
  return c.redirect(url.toString());
});

auth.get("/callback", async (c) => {
  const { code, state, error_description } = c.req.query();
  const expected = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/auth" });
  const fail = (msg: string) => c.redirect(`/?auth_error=${encodeURIComponent(msg)}`);
  if (error_description) return fail(error_description);
  if (!code || !state || state !== expected) return fail("Sign-in expired. Please try again.");

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "User-Agent": "StarTune" },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: new URL("/auth/callback", c.req.url).toString(),
    }),
  });
  const body = (await res.json()) as { access_token?: string; scope?: string; error_description?: string };
  if (!body.access_token) return fail(body.error_description ?? "GitHub didn't return a token.");
  try {
    await signIn(c, body.access_token, body.scope ?? null);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Sign-in failed");
  }
  return c.redirect("/");
});

/** Sign in with a personal access token (for installs without an OAuth app). */
auth.post("/token", async (c) => {
  const { token } = await parseBody(c, TokenLoginInput);
  const check = await rest(token, "/user");
  if (check.status === 401) throw new HttpError(401, "GitHub rejected that token.");
  await signIn(c, token, check.headers.get("x-oauth-scopes"));
  return c.json({ ok: true });
});

auth.post("/logout", async (c) => {
  const sid = getCookie(c, SESSION_COOKIE);
  if (sid) await c.env.DB.prepare(`DELETE FROM sessions WHERE id = ?1`).bind(await sha256Hex(sid)).run();
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

export async function currentUser(c: Context<AppEnv>) {
  const sid = getCookie(c, SESSION_COOKIE);
  if (!sid) return null;
  const row = await c.env.DB.prepare(
    `SELECT u.id, u.login, u.name, u.avatar_url, u.token_enc, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?1`,
  )
    .bind(await sha256Hex(sid))
    .first<{ id: string; login: string; name: string | null; avatar_url: string | null; token_enc: string; expires_at: number }>();
  if (!row || row.expires_at < Date.now()) return null;
  return row;
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const row = await currentUser(c);
  if (!row) throw new HttpError(401, "Not signed in");
  let token: string;
  try {
    token = await decrypt(c.env.SESSION_SECRET, row.token_enc);
  } catch {
    throw new HttpError(401, "Session can't be decrypted (SESSION_SECRET changed?). Sign in again.");
  }
  c.set("user", { id: row.id, login: row.login, token });
  await next();
};
