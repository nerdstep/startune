import { describe, expect, it } from "vitest";
import { countAt, ownGrowth, signals, weekly } from "../shared/own";
import type { OwnRepo } from "../shared/schemas";
import { health } from "../shared/scoring";

const DAY = 86_400_000;
const now = new Date("2026-11-11T00:00:00Z").getTime();
const ago = (d: number) => new Date(now - d * DAY).toISOString();

function own(p: Partial<OwnRepo> = {}): OwnRepo {
  return {
    id: "R_1",
    fullName: "me/r",
    owner: "me",
    name: "r",
    description: "A tool",
    url: "https://github.com/me/r",
    homepage: null,
    language: "Rust",
    languageColor: null,
    topics: ["cli"],
    stars: 100,
    forks: 1,
    isArchived: false,
    isFork: false,
    license: "MIT",
    ownerAvatar: null,
    createdAt: ago(800),
    pushedAt: ago(3),
    latestReleaseAt: null,
    latestReleaseTag: null,
    upkeep: { openIssues: 0, openPrs: 0, waitingPrs: 0, oldestWaitingPrAt: null, unanswered: 0, oldestUnansweredAt: null, watchers: 1 },
    history: null,
    exactSince: 0,
    recent: [],
    chartedAt: null,
    ...p,
  };
}

describe("countAt", () => {
  const h: Array<[number, number]> = [
    [now - 100 * DAY, 1],
    [now - 50 * DAY, 51],
    [now, 101],
  ];
  it("is 0 before the first star and the total after the last", () => {
    expect(countAt(h, now - 200 * DAY)).toBe(0);
    expect(countAt(h, now + DAY)).toBe(101);
  });
  it("interpolates between points", () => {
    expect(countAt(h, now - 75 * DAY)).toBe(26);
    expect(countAt(h, now - 25 * DAY)).toBe(76);
  });
});

describe("ownGrowth", () => {
  const history: Array<[number, number]> = [
    [now - 100 * DAY, 1],
    [now - 30 * DAY, 60],
    [now - 7 * DAY, 90],
    [now, 100],
  ];
  it("reads 7 and 30 day gains off the history", () => {
    const g = ownGrowth(own({ history, exactSince: 0 }), now);
    expect(g.d7).toBe(10);
    expect(g.d30).toBe(40);
    expect(g.estimated).toBe(false);
  });
  it("is estimated when the 30-day window starts in the sampled part", () => {
    expect(ownGrowth(own({ history, exactSince: now - 10 * DAY }), now).estimated).toBe(true);
  });
  it("is empty until charted", () => {
    expect(ownGrowth(own({ history: null }), now).d30).toBeNull();
  });
});

describe("weekly", () => {
  it("splits gains into weeks, oldest first", () => {
    const w = weekly(
      [
        [now - 14 * DAY, 0],
        [now, 14],
      ],
      now,
      2,
    );
    expect(w).toEqual([7, 7]);
  });
});

describe("signals", () => {
  const sig = (r: OwnRepo, d30 = 0) => signals(r, health(r, new Date(now)), { d7: 0, d30, pct30: null, estimated: false }, now);

  it("puts other people's waiting work first, by age", () => {
    const r = own({ upkeep: { ...own().upkeep, waitingPrs: 2, oldestWaitingPrAt: ago(20), unanswered: 1, oldestUnansweredAt: ago(2) } });
    const s = sig(r);
    expect(s.find((x) => x.key === "prs")).toMatchObject({ level: 2, label: "2 PRs waiting", href: "https://github.com/me/r/pulls" });
    expect(s.find((x) => x.key === "issues")).toMatchObject({ level: 1, label: "1 issue without a reply" });
  });

  it("calls a dormant repo still gaining stars 'still being found', not an archive candidate", () => {
    const dormant = own({ pushedAt: ago(4 * 365) });
    expect(sig(dormant, 8).map((x) => x.key)).toContain("revive");
    expect(sig(dormant, 0).map((x) => x.key)).toContain("archive");
  });

  it("flags unreleased work and missing basics", () => {
    const r = own({ latestReleaseAt: ago(200), latestReleaseTag: "v1.0.0", pushedAt: ago(5), license: null, topics: [] });
    const s = sig(r);
    expect(s.find((x) => x.key === "release")?.detail).toContain("after v1.0.0");
    expect(s.find((x) => x.key === "hygiene")?.label).toBe("No license or topics");
  });

  it("skips upkeep advice for forks and archived repos", () => {
    expect(sig(own({ isFork: true, license: null, pushedAt: ago(2000) }))).toEqual([]);
    expect(sig(own({ isArchived: true, license: null }))).toEqual([]);
  });
});

describe("capped counts", () => {
  it("marks PR counts past the scanned 10 as a lower bound, and issue counts as among the newest", () => {
    const r = own({ upkeep: { ...own().upkeep, openPrs: 40, waitingPrs: 10, oldestWaitingPrAt: ago(30), openIssues: 50, unanswered: 4, oldestUnansweredAt: ago(9) } });
    const s = signals(r, health(r, new Date(now)), { d7: 0, d30: 0, pct30: null, estimated: false }, now);
    expect(s.find((x) => x.key === "prs")?.label).toBe("10+ PRs waiting");
    expect(s.find((x) => x.key === "issues")?.detail).toBe("among the 10 newest · oldest 9d");
  });

  it("keeps weekly gains whole and summing to the real total", () => {
    const w = weekly(
      [
        [now - 30 * 7 * DAY, 0],
        [now, 3],
      ],
      now,
      26,
    );
    expect(w.every((v) => Number.isInteger(v))).toBe(true);
    expect(w.reduce((a, b) => a + b, 0)).toBe(3);
  });
});
