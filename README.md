# ✦ StarTune

**Tune your GitHub stars.** Sort them into GitHub Lists, clear out the dead ones, see what's taking off, and find the gems you forgot about.

StarTune runs entirely on **your own Cloudflare account**: a single Worker with D1 for storage, Workers AI ([Clef](https://blog.cloudflare.com/clef-decision-models/)) for suggestions, and a daily cron for trending data.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/nerdstep/startune)

> Want to look around first? Run it locally and pick **Explore with demo data**, or open `/?demo=1`. The demo uses generated sample data and never touches GitHub.

## What it does

| | |
|---|---|
| **Overview** | Starring history by year, colored by how alive each repo is today; health mix; forgotten gems; what's hot. |
| **Stars** | Fast, virtualized library with search, list, language, health, and year filters. Shift-click range selection; bulk add to lists, keep, or unstar. |
| **Triage** | A swipeable, keyboard-driven card deck (`←` unstar · `→` keep · `A` accept Clef's list · `S` snooze · `J` skip). Three queues: **Cruft**, **Unlisted**, and **Rediscover**. |
| **Star map** | Every star you've given, plotted by when you starred it and how popular it is. Zoom, pan, filter by health or language, and click a dot to open it. |
| **Trending** | Your stars ranked by 7- or 30-day growth (from daily snapshots), fresh releases, and **Discover**: new repos in your most-starred topics. |
| **Lists** | Create, edit, and delete GitHub Lists. **List ideas** come from topics shared by unlisted repos. **Sort with Clef** classifies unlisted repos and lets you apply its confident picks in bulk. |
| **Safety** | Every unstar can be undone (from the toast or Settings), and the repo's lists come back too. JSON export is available. |

### How cruft is scored
Rules (archived; description says deprecated or moved; years since the last push; fork; small and inactive) give a probability, which is discounted when the repo still ships releases. When Clef has looked at a repo, its yes/no probability is blended in (55%). You can see the reasons on every card.

### How Clef is used
Each Workers AI request asks Clef up to 64 typed questions. For each of ~32 repos it asks two:
- a `choice` question: which of your lists fits (or `none`);
- a `noul` (yes/no) question: is this repo likely cruft?

Output tokens aren't billed, so classifying a thousand stars costs very little and often fits in the Workers AI free tier. Set `CLEF_MODEL=clef` to use the larger model.

## Deploy

### One click
1. Create a **GitHub OAuth app** at [github.com/settings/developers](https://github.com/settings/developers).
   - Homepage URL: `https://startune.<your-subdomain>.workers.dev`
   - Callback URL: `https://startune.<your-subdomain>.workers.dev/auth/callback`
2. Click **Deploy to Cloudflare** above. It forks the repo, creates the D1 database, and asks for:
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: from step 1. If you'd rather sign in with a personal access token, enter `none` for both.
   - `SESSION_SECRET`: any long random string (`openssl rand -base64 32`).
3. Open the Worker URL and sign in. **The first person to sign in owns the install.** To let other people in, set `ALLOWED_USERS=alice,bob`.

### Manually
```bash
npm install
npx wrangler login
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
npm run deploy   # build → deploy (auto-provisions D1) → apply migrations
```

### Signing in with a token
If you sign in with a classic personal access token, it needs the `read:user` and `public_repo` scopes. `public_repo` is what GitHub requires for starring and unstarring.

> **About the Lists scope:** GitHub doesn't document which OAuth scope its `UserList` mutations need. If creating a list or adding a repo to one fails, StarTune shows GitHub's "missing permission" message, which names the scope it wants. Add that scope to `GITHUB_SCOPES` (for an OAuth app) or to your token, then sign in again.

## Configuration

| Name | Kind | Default | |
|---|---|---|---|
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | secret | — | OAuth app credentials, or `none` |
| `SESSION_SECRET` | secret | — | Encrypts GitHub tokens at rest (AES-GCM, HKDF). Changing it signs everyone out. |
| `ALLOWED_USERS` | var | *(empty)* | Comma-separated logins. Empty means the first sign-in claims the install. |
| `CLEF_MODEL` | var | `clef-flash` | `clef-flash` or `clef` |
| `GITHUB_SCOPES` | var | `read:user public_repo` | OAuth scopes requested at sign-in |

The cron (`17 9 * * *` UTC) refreshes repo metadata and records a star-count snapshot for up to 3,000 repos per run, oldest-fetched first. That keeps it under the Workers free-plan subrequest limit. Trending starts working once there are a few days of snapshots; until then, it falls back to stars per day since each repo was created.

## Local development

```bash
cp .dev.vars.example .dev.vars          # set SESSION_SECRET; "none" for OAuth is fine locally
npm run db:migrate:local
npm run dev                              # Workers AI is remote, so this needs `wrangler login`
CF_LOCAL_ONLY=1 npm run dev              # fully offline (Clef calls will fail)
npm run seed:local                       # fake signed-in user; cookie st_session=local-test-session-cookie
npm test                                 # vitest: scoring, Clef request building, crypto
```

## Architecture

```
worker/        Hono API on Workers
  auth.ts      GitHub OAuth + PAT sign-in, sessions (hashed ids), encrypted tokens
  github.ts    GraphQL: stars, lists (UserList), mutations, topic search
  api.ts       /api/*: library, client-driven sync, lists, unstar/restar, review, Clef, discover, export
  ai.ts        Clef request builder/parser (64-question batches)
  cron.ts      daily metadata refresh + snapshots + cleanup
  db.ts        D1 queries
shared/        zod schemas + pure scoring (health, cruft, growth, rediscover, list ideas)
src/           React 19 + TanStack Router/Query/Virtual + shadcn/ui on Base UI + Tailwind v4
migrations/    D1 schema
```

Sync is driven by the client: the browser calls `/api/sync` page by page, 400 stars per request. That way even a library of 10k stars never runs into Worker CPU or subrequest limits, and you get a live progress bar. A star that GitHub no longer reports is removed at the end of a full sync.

Chart colors come from a palette validated for color-vision deficiency on the dark surface (see `src/lib/palette.ts`). Colors are never the only signal: every chart has a legend, labels, and hover tooltips, and the star map also uses hollow and faded marks.

## License

MIT
