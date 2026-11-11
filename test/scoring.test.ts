import { describe, expect, it } from "vitest";
import { cruftRules, cruftScore, growth, health, listIdeas, rediscoverScore, topTopics } from "../shared/scoring";
import type { Star } from "../shared/schemas";

const now = new Date("2026-11-11T00:00:00Z");
const yearsAgo = (n: number) => new Date(now.getTime() - n * 365 * 86_400_000).toISOString();

function star(p: Partial<Star> = {}): Star {
  return {
    id: "R_1", fullName: "o/r", owner: "o", name: "r", description: "A tool", url: "", homepage: null,
    language: "Rust", languageColor: null, topics: [], stars: 1000, forks: 10, isArchived: false, isFork: false,
    license: null, ownerAvatar: null, createdAt: yearsAgo(6), pushedAt: yearsAgo(0.1), latestReleaseAt: null,
    latestReleaseTag: null, starredAt: yearsAgo(4), reviewedAt: null, snoozedUntil: null, listIds: [], suggestion: null,
    growth: { base7: null, base30: null, earliestDay: null, earliestStars: null }, ...p,
  };
}

describe("health", () => {
  it("buckets by last push", () => {
    expect(health(star({ pushedAt: yearsAgo(0.1) }), now)).toBe("thriving");
    expect(health(star({ pushedAt: yearsAgo(0.5) }), now)).toBe("active");
    expect(health(star({ pushedAt: yearsAgo(2) }), now)).toBe("quiet");
    expect(health(star({ pushedAt: yearsAgo(4) }), now)).toBe("dormant");
    expect(health(star({ isArchived: true }), now)).toBe("archived");
    expect(health(star({ pushedAt: null }), now)).toBe("dormant");
  });
});

describe("cruftRules", () => {
  it("is low for a fresh, popular repo", () => {
    expect(cruftRules(star(), now).score).toBe(0);
  });
  it("is high for archived + deprecated + stale", () => {
    const r = cruftRules(star({ isArchived: true, description: "Deprecated, use foo instead", pushedAt: yearsAgo(6) }), now);
    expect(r.score).toBeGreaterThan(0.85);
    expect(r.reasons).toContain("Archived");
  });
  it("discounts stale repos that still ship releases", () => {
    const stale = cruftRules(star({ pushedAt: yearsAgo(4) }), now).score;
    const releasing = cruftRules(star({ pushedAt: yearsAgo(4), latestReleaseAt: yearsAgo(0.2) }), now).score;
    expect(releasing).toBeLessThan(stale);
  });
  it("blends with the AI score", () => {
    expect(cruftScore(0.2, null)).toBe(0.2);
    expect(cruftScore(0, 1)).toBeCloseTo(0.55);
  });
});

describe("growth", () => {
  it("uses exact bases when present", () => {
    const g = growth(1100, { base7: 1050, base30: 1000, earliestDay: "2026-01-01", earliestStars: 900 }, "2026-11-11");
    expect(g).toMatchObject({ d7: 50, d30: 100, pct30: 0.1, estimated: false });
  });
  it("extrapolates from a short history", () => {
    const g = growth(1040, { base7: null, base30: null, earliestDay: "2026-11-07", earliestStars: 1000 }, "2026-11-11");
    expect(g.d7).toBe(70);
    expect(g.estimated).toBe(true);
  });
  it("returns null with under 2 days of history", () => {
    expect(growth(10, { base7: null, base30: null, earliestDay: "2026-11-11", earliestStars: 10 }, "2026-11-11").d7).toBeNull();
  });
});

describe("rediscover / ideas / topics", () => {
  it("ignores recent or reviewed stars", () => {
    expect(rediscoverScore(star({ starredAt: yearsAgo(0.2) }), 0, now, "x")).toBe(0);
    expect(rediscoverScore(star({ reviewedAt: yearsAgo(0.1) }), 0, now, "x")).toBe(0);
    expect(rediscoverScore(star(), 0, now, "x")).toBeGreaterThan(0);
  });
  it("suggests topics without lists, skipping language names", () => {
    const stars = Array.from({ length: 5 }, (_, i) => star({ id: `R${i}`, topics: ["cli", "rust"] }));
    const ideas = listIdeas(stars, [{ id: "L", name: "Other", slug: "other", description: null, isPrivate: false }]);
    expect(ideas.map((i) => i.topic)).toEqual(["cli"]);
    expect(listIdeas(stars, [{ id: "L", name: "CLI", slug: "cli", description: null, isPrivate: false }])).toEqual([]);
  });
  it("weights recent topics", () => {
    const t = topTopics([star({ topics: ["old"], starredAt: yearsAgo(8) }), star({ topics: ["new"], starredAt: yearsAgo(0.1) })], now, 1);
    expect(t).toEqual(["new"]);
  });
});
