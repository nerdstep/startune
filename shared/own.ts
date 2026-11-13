import type { OwnRepo } from "./schemas";
import { daysBetween, type Growth, type Health } from "./scoring";
import { DEPRECATION } from "./scoring";

const DAY = 86_400_000;
/** How many open PRs and issues GitHub is asked for per repo. */
const SCANNED = 10;

type History = Array<[number, number]>;

/** Stargazers at time t, interpolated linearly between history points (0 before the first star). */
export function countAt(h: History, t: number): number {
  if (h.length === 0 || t < h[0]![0]) return 0;
  const last = h[h.length - 1]!;
  if (t >= last[0]) return last[1];
  let lo = 0;
  let hi = h.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (h[mid]![0] <= t) lo = mid;
    else hi = mid;
  }
  const [t0, c0] = h[lo]!;
  const [t1, c1] = h[hi]!;
  return t1 === t0 ? c1 : c0 + ((c1 - c0) * (t - t0)) / (t1 - t0);
}

/** New stars over 7 and 30 days from the star history. Estimated when a window starts in the sampled part. */
export function ownGrowth(r: Pick<OwnRepo, "history" | "exactSince">, now: number): Growth {
  const h = r.history;
  if (!h) return { d7: null, d30: null, pct30: null, estimated: false };
  const total = h.length ? h[h.length - 1]![1] : 0;
  const t30 = now - 30 * DAY;
  const d7 = Math.round(total - countAt(h, now - 7 * DAY));
  const start30 = countAt(h, t30);
  const d30 = Math.round(total - start30);
  const estimated = r.exactSince == null ? h.length > 0 : t30 < r.exactSince && start30 > 0;
  return { d7, d30, pct30: start30 > 0 ? Math.round((d30 / start30) * 1000) / 1000 : null, estimated };
}

/** Stars gained in each of the last `weeks` weeks, oldest first. */
export function weekly(h: History | null, now: number, weeks = 26): number[] {
  if (!h || h.length === 0) return Array.from({ length: weeks }, () => 0);
  const out: number[] = [];
  // Differences of rounded cumulative counts, so whole stars land in some week and the weeks sum to the real gain.
  for (let i = weeks; i > 0; i -= 1) {
    const a = Math.round(countAt(h, now - i * 7 * DAY));
    const b = Math.round(countAt(h, now - (i - 1) * 7 * DAY));
    out.push(Math.max(0, b - a));
  }
  return out;
}

/* ---------- Upkeep signals ---------- */

/** 2 = someone is waiting on you, 1 = worth a look, 0 = housekeeping. */
export type Level = 0 | 1 | 2;

export interface Signal {
  key: "prs" | "issues" | "revive" | "release" | "archive" | "hygiene";
  level: Level;
  label: string;
  detail: string;
  href: string;
}

const days = (iso: string, now: number) => Math.max(0, Math.floor(daysBetween(iso, new Date(now))));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const span = (d: number) => (d >= 730 ? `${Math.floor(d / 365)}y` : d >= 60 ? `${Math.floor(d / 30)}mo` : `${d}d`);

/** Transparent rules, like cruft: each signal says why it fired and links to the place to act. */
export function signals(r: OwnRepo, h: Health, g: Growth, now: number): Signal[] {
  const out: Signal[] = [];
  const u = r.upkeep;
  // GitHub is asked for the 10 oldest open PRs and the 10 newest open issues (worker/github.ts), so counts
  // past that are lower bounds and say so.
  if (u.waitingPrs > 0) {
    const age = u.oldestWaitingPrAt ? days(u.oldestWaitingPrAt, now) : 0;
    const more = u.openPrs > SCANNED;
    out.push({
      key: "prs",
      level: age > 14 ? 2 : 1,
      label: `${u.waitingPrs}${more ? "+" : ""} PR${u.waitingPrs === 1 && !more ? "" : "s"} waiting`,
      detail: `oldest ${span(age)}`,
      href: `${r.url}/pulls`,
    });
  }
  if (u.unanswered > 0) {
    const age = u.oldestUnansweredAt ? days(u.oldestUnansweredAt, now) : 0;
    const more = u.openIssues > SCANNED;
    out.push({
      key: "issues",
      level: age > 7 ? 2 : 1,
      label: `${plural(u.unanswered, "issue")} without a reply`,
      detail: more ? `among the ${SCANNED} newest · oldest ${span(age)}` : `oldest ${span(age)}`,
      href: `${r.url}/issues`,
    });
  }
  if (r.isArchived || r.isFork) return out;

  const idle = r.pushedAt ? days(r.pushedAt, now) : Infinity;
  const deprecated = !!r.description && DEPRECATION.test(r.description);
  if (h === "dormant" && (g.d30 ?? 0) >= 3) {
    out.push({ key: "revive", level: 1, label: "Still being found", detail: `+${g.d30} stars this month, no push in ${span(idle)}`, href: r.url });
  } else if ((h === "dormant" || deprecated) && u.waitingPrs === 0) {
    out.push({
      key: "archive",
      level: 0,
      label: "Archive candidate",
      detail: deprecated ? "description says it's deprecated" : `no push in ${span(idle)}`,
      href: `${r.url}/settings`,
    });
  }
  if (r.latestReleaseAt && r.pushedAt && (h === "thriving" || h === "active")) {
    const gap = daysBetween(r.latestReleaseAt, r.pushedAt);
    if (gap > 45)
      out.push({
        key: "release",
        level: 0,
        label: "Unreleased work",
        detail: `pushed ${span(Math.floor(gap))} after ${r.latestReleaseTag ?? "the last release"}`,
        href: `${r.url}/releases/new`,
      });
  }
  if (r.stars >= 5) {
    const missing = [!r.description && "description", !r.license && "license", r.topics.length === 0 && "topics"].filter((x): x is string => !!x);
    if (missing.length)
      out.push({
        key: "hygiene",
        level: 0,
        label: `No ${missing.length > 1 ? `${missing.slice(0, -1).join(", ")} or ${missing.at(-1)}` : missing[0]}`,
        detail: "helps people find and use it",
        href: missing.includes("license") ? `${r.url}/community` : r.url,
      });
  }
  return out;
}

export const LEVEL_WEIGHT: Record<Level, number> = { 2: 4, 1: 2, 0: 1 };
export const attentionScore = (s: Signal[]) => s.reduce((n, x) => n + LEVEL_WEIGHT[x.level], 0);
