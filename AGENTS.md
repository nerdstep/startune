# Instructions for StarTune

A self-hosted Cloudflare Worker (Hono, `worker/`) serving a React app (`src/`) that helps a GitHub user organise their stars and watch their own repos. `shared/` is imported by both sides, so it stays free of Worker and DOM APIs.

- **Product decisions and copy:** read `PRODUCT.md`.
- **UI changes:** read `DESIGN.md` first, and update it in the same change when you add or alter a component or pattern.

## Data

- The client parses every API response with its schema in `shared/schemas.ts`. Change a route and its schema together.
- Each `Backend` method (`src/lib/api.ts`) also has a demo version in `src/lib/demo.ts` or `demo-own.ts`. It returns plausible generated data and never calls GitHub.
- Each schema change is a new file in `migrations/`; applied migrations stay unchanged.
- The cron cleanup in `worker/cron.ts` deletes repos no table references. A new table that references repos joins its exemption list.

## Verifying

- Check UI changes in a browser in demo mode (`/?demo=1`, no GitHub login needed) at 1440 and 390 wide. Signed-in paths need a real token; say when one went untested.
- Screenshots for docs and PRs come from demo mode only.
- If the dev server serves a blank page after a `vite.config.ts` change, restart it.

## Conventions

- Allow a deliberate lint exception with a file override in `.oxlintrc.json` whose comment gives the reason.
- `vite.config.ts` resolves its root and aliases to the on-disk path so a build started from `c:\` or `C:\` bundles each module once (otherwise two React Query copies and "No QueryClient set" on every page).
- The logo mark is defined in `src/components/shell.tsx`, `public/favicon.svg` and `brand/make_logo.py`. Change all three, then regenerate `brand/`.
