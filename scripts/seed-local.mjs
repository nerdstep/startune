import { webcrypto as crypto } from 'node:crypto'
// Seeds the local D1 with a fake signed-in user so the API can be exercised without GitHub.
// Usage: node scripts/seed-local.mjs > /tmp/seed.sql && wrangler d1 execute DB --local --file /tmp/seed.sql
import { readFileSync } from 'node:fs'

const secret = readFileSync('.dev.vars', 'utf8')
  .match(/^SESSION_SECRET=(.*)$/m)[1]
  .trim()
const enc = new TextEncoder()
const b64url = (b) => Buffer.from(b).toString('base64url')
const base = await crypto.subtle.importKey('raw', enc.encode(secret), 'HKDF', false, ['deriveKey'])
const key = await crypto.subtle.deriveKey(
  {
    name: 'HKDF',
    hash: 'SHA-256',
    salt: enc.encode('startune/v1'),
    info: enc.encode('github-token'),
  },
  base,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
)
const iv = crypto.getRandomValues(new Uint8Array(12))
const ct = new Uint8Array(
  await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode('ghp_fake_token_for_local_testing'),
  ),
)
const tokenEnc = `${b64url(iv)}.${b64url(ct)}`
const cookie = 'local-test-session-cookie'
const sid = Buffer.from(await crypto.subtle.digest('SHA-256', enc.encode(cookie))).toString('hex')
const q = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`)
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
const out = [
  `DELETE FROM users; DELETE FROM sessions; DELETE FROM repos; DELETE FROM stars; DELETE FROM lists; DELETE FROM list_items; DELETE FROM snapshots; DELETE FROM suggestions;`,
  `INSERT INTO users (id, login, name, token_enc) VALUES ('U_1', 'tester', 'Tester', ${q(tokenEnc)});`,
  `INSERT INTO sessions (id, user_id, expires_at) VALUES (${q(sid)}, 'U_1', ${Date.now() + 86400000});`,
  `INSERT INTO lists (id, user_id, name, slug, description, is_private) VALUES ('L_1','U_1','CLI','cli','Terminal tools',0);`,
]
for (let i = 0; i < 5; i += 1) {
  out.push(`INSERT INTO repos (id, full_name, owner, name, description, url, language, topics, stars, forks, is_archived, is_fork, pushed_at, created_at, fetched_at)
    VALUES ('R_${i}', 'o/r${i}', 'o', 'r${i}', ${q(i === 2 ? 'Deprecated, use r3' : 'A tool')}, 'https://github.com/o/r${i}', 'Rust', '["cli","rust"]', ${100 * (i + 1)}, 3, ${i === 4 ? 1 : 0}, 0, '2019-01-01T00:00:00Z', '2018-01-01T00:00:00Z', '2026-01-01T00:00:00Z');`)
  out.push(
    `INSERT INTO stars (user_id, repo_id, starred_at) VALUES ('U_1','R_${i}','202${i}-05-01T00:00:00Z');`,
  )
  out.push(
    `INSERT INTO snapshots (repo_id, day, stars) VALUES ('R_${i}', ${q(day(40))}, ${100 * (i + 1) - 20}), ('R_${i}', ${q(day(8))}, ${100 * (i + 1) - 5});`,
  )
}
out.push(`INSERT INTO list_items VALUES ('L_1','R_0'), ('L_1','R_1');`)
out.push(
  `INSERT INTO suggestions VALUES ('U_1','R_2','L_1',0.91,0.8,'clef-flash','2026-01-01T00:00:00Z');`,
)
console.log(out.join('\n'))
console.error(`cookie: st_session=${cookie}`)
