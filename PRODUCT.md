# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** a developer with hundreds to thousands of GitHub stars who opens StarTune in occasional sessions (roughly weekly) to clean up dead stars, sort repos into GitHub Lists, and rediscover forgotten ones. Personal and self-hosted: one owner per install (optionally a few allowed logins), not a team product.
- **Secondary (confirmed):** people evaluating the project from its GitHub repo or Deploy button who open the demo (`/?demo=1`) or the sign-in screen. Those surfaces double as the public showcase and have to make the product's value obvious in seconds.

## Product Purpose

Tune your GitHub stars: organize them into Lists, prune cruft (archived, abandoned, deprecated), see what's growing, and resurface old stars that are still alive. Success means a library the owner actually uses again: sorted, trimmed, and remembered.

## Positioning

Runs entirely on the owner's own Cloudflare account (one Worker, D1, Workers AI, daily cron), so tokens and data never leave their account. Uses Cloudflare's Clef decision models to suggest a List and a cruft probability per repo, cheaply enough to classify thousands of stars. Every unstar is reversible, and the repo's lists come back too.

## Operating Context

- Session-style use: sync from GitHub, then work through queues (Triage: Cruft / Unlisted / Rediscover) with swipe or keyboard (`←` unstar, `→` keep, `A` accept Clef's list, `S` snooze, `J` skip).
- Library browsing with search, filters, shift-click range selection and bulk actions over a virtualized list of up to ~10k stars.
- Star map: every star plotted by when it was starred and how popular it is, with zoom and pan.
- Trending from daily star-count snapshots (falls back to stars per day before history exists).
- Demo mode uses generated sample data and never touches GitHub.

## Capabilities and Constraints

- Stack: React 19, TanStack Router/Query/Virtual, Base UI (shadcn-style components), Tailwind v4, Hono on Workers, D1, Workers AI. Geist and Geist Mono are installed as fontsource packages.
- Health vocabulary: thriving, active, quiet, dormant, archived. Chart colors come from a palette validated for color-vision deficiency (`src/lib/palette.ts`); color is never the only signal.
- Cron refreshes up to 3,000 repos per run; client-driven sync pages 400 stars per request.
- Lists scope: GitHub doesn't document which OAuth scope UserList mutations need; the UI surfaces GitHub's message.

## Brand Commitments

- Name **StarTune**, tagline "Bring your stars into focus." Logo mark: the scanned star, a solid five-point star inside scanner corners (a star caught in the instrument).
- The user wants the design to be unique, modern, interactive-feeling and to play to the star theme, while avoiding: gimmicky or slow interaction, another near-black/samey dark dashboard, and theme that makes data hard to read. (Earlier neon/glass styling was rejected as generic.)

## Evidence on Hand

- Generated demo data (`src/lib/demo.ts`), clearly synthetic. No real users, testimonials, metrics or press exist; never fabricate them.
- README feature table and the "how cruft is scored" / "how Clef is used" explanations are factual copy.

## Product Principles

1. The owner's data stays theirs: self-hosted, reversible, transparent about why a repo is flagged.
2. Sessions should feel rewarding: clearing a queue or resurfacing a gem is the payoff.
3. Speed over spectacle in repetitive work; spectacle belongs where it explains something.
4. Data first: counts, names and health must stay legible in every treatment.

## Accessibility & Inclusion

Keyboard-complete triage; color never the only signal in charts; respect reduced motion.
