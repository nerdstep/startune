import type { BulkResult, Library, Repo, Star, StarList } from "@shared/schemas";
import { cruftRules } from "@shared/scoring";
import type { Backend } from "./api";

/* A self-contained fake backend so anyone can try StarTune before deploying. */

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LANG: Record<string, string> = {
  TypeScript: "#3178c6",
  Rust: "#dea584",
  Go: "#00ADD8",
  Python: "#3572A5",
  "C++": "#f34b7d",
  C: "#555555",
  Zig: "#ec915c",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  CSS: "#663399",
  JavaScript: "#f1e05a",
  Shell: "#89e051",
  Lua: "#000080",
};

interface Category {
  key: string;
  list: string | null;
  langs: string[];
  topics: string[];
  nouns: string[];
}

const CATEGORIES: Category[] = [
  { key: "cli", list: "CLI & Terminal", langs: ["Rust", "Go", "Zig"], topics: ["cli", "terminal", "tui", "developer-tools"], nouns: ["terminal file manager", "shell prompt", "grep alternative", "TUI dashboard", "git client", "fuzzy finder"] },
  { key: "ui", list: "React & UI", langs: ["TypeScript", "TypeScript", "JavaScript"], topics: ["react", "ui", "components", "design-system"], nouns: ["headless component library", "animation library", "data grid", "form toolkit", "icon set", "drag and drop kit"] },
  { key: "ai", list: "AI / LLM", langs: ["Python", "TypeScript", "Rust"], topics: ["llm", "ai", "machine-learning", "agents"], nouns: ["agent framework", "local inference server", "prompt evaluation harness", "RAG toolkit", "embedding store", "speech model"] },
  { key: "edge", list: "Edge & Workers", langs: ["TypeScript", "Rust"], topics: ["cloudflare-workers", "serverless", "edge", "wasm"], nouns: ["edge router", "Workers starter", "KV cache layer", "Durable Objects toolkit", "WASM runtime"] },
  { key: "db", list: "Databases", langs: ["Rust", "Go", "C", "TypeScript"], topics: ["database", "sql", "sqlite", "local-first"], nouns: ["embedded SQL database", "CRDT sync engine", "query builder", "time-series store", "SQLite extension"] },
  { key: "self", list: "Self-hosted", langs: ["Go", "TypeScript", "Python"], topics: ["self-hosted", "homelab", "docker"], nouns: ["photo library", "media server", "password manager", "home dashboard", "RSS reader", "recipe manager"] },
  { key: "css", list: null, langs: ["CSS", "TypeScript"], topics: ["css", "tailwindcss", "design"], nouns: ["utility CSS framework", "color palette generator", "CSS reset", "gradient tool"] },
  { key: "game", list: "Inspiration", langs: ["C++", "Lua", "Rust", "C"], topics: ["game-engine", "graphics", "shaders", "creative-coding"], nouns: ["2D game engine", "shader playground", "pixel art editor", "physics engine", "generative art toolkit"] },
  { key: "mobile", list: null, langs: ["Swift", "Kotlin", "TypeScript"], topics: ["ios", "android", "mobile", "react-native"], nouns: ["navigation library", "offline storage kit", "camera module", "gesture handler"] },
  { key: "devops", list: null, langs: ["Go", "Shell", "Python"], topics: ["kubernetes", "devops", "observability"], nouns: ["deployment tool", "log shipper", "metrics agent", "dotfiles manager", "container builder"] },
];

const PREFIX = ["nova", "quark", "flux", "echo", "pixel", "orbit", "hyper", "lumen", "vortex", "neon", "drift", "sonic", "atlas", "comet", "prism", "tide", "ember", "cipher", "zephyr", "halo", "rift", "pulse", "lyra", "astro", "vapor", "glint", "nimbus", "kite", "shard", "mosaic"];
const SUFFIX = ["", "", "-cli", "js", "db", "kit", "ui", "-rs", "ly", "hub", "flow", "stack", "box", "lab", "core", "x", "-go"];
const OWNERS = ["voidlabs", "neonforge", "starkiss", "quietbyte", "hexgarden", "lumacorp", "driftwood-dev", "polarnight", "cosmo-oss", "tinyfactory", "aurora-hq", "mkdev", "zeta-io", "parallax", "byteorchard", "kitsune-labs"];
const ADJ = ["Blazing fast", "Tiny", "Modern", "Type-safe", "Minimal", "Batteries-included", "Zero-config", "Composable", "Delightful", "Lightweight"];

const DAY = 86_400_000;

function generate(): { stars: Star[]; lists: StarList[]; catOf: Map<string, Category> } {
  const r = rng(42);
  const pick = <T,>(a: T[]): T => a[Math.floor(r() * a.length)]!;
  const now = Date.now();
  const lists: StarList[] = [];
  const listByName = new Map<string, StarList>();
  for (const c of CATEGORIES) {
    if (!c.list || listByName.has(c.list)) continue;
    const l: StarList = { id: `UL_${c.key}`, name: c.list, slug: c.key, description: `${c.topics.slice(0, 3).join(", ")}`, isPrivate: false };
    lists.push(l);
    listByName.set(c.list, l);
  }

  const used = new Set<string>();
  const stars: Star[] = [];
  const catOf = new Map<string, Category>();
  for (let i = 0; i < 420; i++) {
    const cat = pick(CATEGORIES);
    let name = "";
    do name = pick(PREFIX) + pick(SUFFIX);
    while (used.has(name));
    used.add(name);
    const owner = pick(OWNERS);
    const lang = pick(cat.langs);
    // Star dates skew recent, but plenty from years ago
    const starredAgo = Math.pow(r(), 1.6) * 12.5 * 365 * DAY;
    const starredAt = new Date(now - starredAgo);
    const createdAt = new Date(starredAt.getTime() - r() * 3 * 365 * DAY);
    const oldStar = starredAgo > 4 * 365 * DAY;
    const dormant = r() < (oldStar ? 0.45 : 0.12);
    const archived = r() < (oldStar ? 0.14 : 0.03);
    const pushedAgo = dormant ? (2 + r() * 7) * 365 * DAY : Math.pow(r(), 2.2) * 330 * DAY;
    const pushedAt = new Date(Math.max(createdAt.getTime(), now - pushedAgo));
    const deprecated = (dormant || archived) && r() < 0.25;
    const popular = Math.round(Math.exp(2 + r() * 9.5));
    const hot = !dormant && !archived && r() < 0.09;
    const g30 = hot ? Math.round(popular * (0.08 + r() * 0.35)) : Math.round(popular * r() * (dormant ? 0.002 : 0.02));
    const g7 = hot ? Math.round(g30 * (0.35 + r() * 0.4)) : Math.round(g30 * r() * 0.3);
    const release = !dormant && r() < 0.6 ? new Date(now - Math.pow(r(), 1.5) * 200 * DAY) : null;
    const topics = [...new Set([...cat.topics.filter(() => r() < 0.7), lang.toLowerCase().replace("++", "pp")])].slice(0, 5);
    const noun = pick(cat.nouns);
    const description = deprecated
      ? pick([`Deprecated — use ${pick(PREFIX)}${pick(SUFFIX)} instead.`, `No longer maintained. ${noun} for ${lang}.`, `[archived] Moved to ${pick(OWNERS)}/${name}.`])
      : `${pick(ADJ)} ${noun}${r() < 0.5 ? ` written in ${lang}` : ""}.`;

    const repo: Repo = {
      id: `R_${i.toString(36)}${name}`,
      fullName: `${owner}/${name}`,
      owner,
      name,
      description,
      url: `https://github.com/${owner}/${name}`,
      homepage: r() < 0.3 ? `https://${name}.dev` : null,
      language: lang,
      languageColor: LANG[lang] ?? null,
      topics,
      stars: popular,
      forks: Math.round(popular * (0.03 + r() * 0.12)),
      isArchived: archived,
      isFork: r() < 0.05,
      license: pick(["MIT", "Apache-2.0", "MIT", "BSD-3-Clause", "GPL-3.0", null]),
      ownerAvatar: null,
      createdAt: createdAt.toISOString(),
      pushedAt: pushedAt.toISOString(),
      latestReleaseAt: release?.toISOString() ?? null,
      latestReleaseTag: release ? `v${1 + Math.floor(r() * 5)}.${Math.floor(r() * 20)}.${Math.floor(r() * 10)}` : null,
    };
    const list = cat.list ? listByName.get(cat.list) : undefined;
    const inList = list && r() < (oldStar ? 0.35 : 0.6);
    const extra = r() < 0.06 ? listByName.get("Inspiration") : undefined;
    const listIds = [...new Set([inList ? list.id : null, extra?.id ?? null].filter((x): x is string => !!x))];
    stars.push({
      ...repo,
      starredAt: starredAt.toISOString(),
      reviewedAt: null,
      snoozedUntil: null,
      listIds,
      suggestion: null,
      growth: {
        base7: popular - g7,
        base30: popular - g30,
        earliestDay: new Date(now - 60 * DAY).toISOString().slice(0, 10),
        earliestStars: popular - g30 * 2,
      },
    });
    catOf.set(repo.id, cat);
  }
  stars.sort((a, b) => b.starredAt.localeCompare(a.starredAt));
  return { stars, lists, catOf };
}

const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
const clone = <T,>(v: T): T => structuredClone(v);

const STORE = "startune:demo-state";

/** A fresh generated library for showcase surfaces (sign-in) that run before any backend exists. */
export function sampleLibrary(): Library {
  const { stars, lists } = generate();
  return { stars, lists, recentlyUnstarred: [], lastSyncedAt: new Date().toISOString(), today: new Date().toISOString().slice(0, 10) };
}

export function createDemoBackend(): Backend {
  const { stars, lists, catOf } = generate();
  let state: Library = { stars, lists, recentlyUnstarred: [], lastSyncedAt: new Date(Date.now() - 3 * 3600_000).toISOString(), today: new Date().toISOString().slice(0, 10) };
  const graveyard = new Map<string, Star>();
  // Keep demo edits across reloads in this tab
  try {
    const saved = sessionStorage.getItem(STORE);
    if (saved) {
      const parsed = JSON.parse(saved) as { state: Library; graveyard: Star[] };
      state = parsed.state;
      for (const g of parsed.graveyard) graveyard.set(g.id, g);
    }
  } catch {
    /* ignore */
  }
  const persist = () => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ state, graveyard: [...graveyard.values()] }));
    } catch {
      /* quota */
    }
  };
  const discovered = new Map<string, Repo>();
  const r = rng(7);

  const bulk = (ids: string[], fn: (s: Star) => void): BulkResult => {
    const ok: string[] = [];
    for (const id of ids) {
      const s = state.stars.find((x) => x.id === id);
      if (s) {
        fn(s);
        ok.push(id);
      }
    }
    return { ok, failed: [] };
  };

  const api: Backend = {
    demo: true,
    me: async () => ({ user: { login: "demo", name: "Demo Explorer", avatarUrl: null }, oauthEnabled: true, aiModel: "clef-flash" }),
    library: async () => {
      await wait(250);
      return clone(state);
    },
    sync: async ({ phase, cursor }) => {
      await wait(600);
      if (phase === "stars") {
        const n = cursor ? Number(cursor) : 0;
        const next = n + 1;
        return next >= 2
          ? { phase: "lists", cursor: null, processed: 210, total: state.stars.length }
          : { phase: "stars", cursor: String(next), processed: 210, total: state.stars.length };
      }
      if (phase === "lists") return { phase: "lists", cursor: null, processed: state.lists.length, total: state.lists.length };
      state = { ...state, lastSyncedAt: new Date().toISOString() };
      return { phase: "done", cursor: null, processed: 0, total: 0 };
    },
    updateLists: async ({ repoIds, add, remove }) => {
      await wait(200);
      return bulk(repoIds, (s) => {
        s.listIds = [...new Set([...s.listIds.filter((l) => !remove.includes(l)), ...add])];
      });
    },
    unstar: async (repoIds) => {
      await wait(250);
      const ok: string[] = [];
      for (const id of repoIds) {
        const s = state.stars.find((x) => x.id === id);
        if (!s) continue;
        graveyard.set(id, s);
        state.recentlyUnstarred.unshift({ repoId: id, fullName: s.fullName, unstarredAt: new Date().toISOString() });
        ok.push(id);
      }
      state.stars = state.stars.filter((s) => !ok.includes(s.id));
      return { ok, failed: [] };
    },
    star: async (repoIds) => {
      await wait(250);
      for (const id of repoIds) {
        const s = graveyard.get(id);
        const d = discovered.get(id);
        if (s) state.stars.unshift({ ...s, starredAt: new Date().toISOString() });
        else if (d)
          state.stars.unshift({
            ...d,
            starredAt: new Date().toISOString(),
            reviewedAt: null,
            snoozedUntil: null,
            listIds: [],
            suggestion: null,
            growth: { base7: null, base30: null, earliestDay: null, earliestStars: null },
          });
        state.recentlyUnstarred = state.recentlyUnstarred.filter((u) => u.repoId !== id);
      }
      return { ok: repoIds, failed: [] };
    },
    review: async ({ repoIds, action, days }) => {
      bulk(repoIds, (s) => {
        if (action === "keep") {
          s.reviewedAt = new Date().toISOString();
          s.snoozedUntil = null;
        } else if (action === "snooze") s.snoozedUntil = new Date(Date.now() + (days ?? 90) * DAY).toISOString();
        else s.reviewedAt = s.snoozedUntil = null;
      });
    },
    createList: async (input) => {
      await wait(200);
      const l: StarList = { id: `UL_${Math.random().toString(36).slice(2)}`, name: input.name, slug: input.name.toLowerCase().replace(/\W+/g, "-"), description: input.description ?? null, isPrivate: input.isPrivate };
      state.lists = [...state.lists, l].sort((a, b) => a.name.localeCompare(b.name));
      return l;
    },
    updateList: async (id, input) => {
      const l = state.lists.find((x) => x.id === id)!;
      Object.assign(l, { ...input, description: input.description ?? l.description });
      return clone(l);
    },
    deleteList: async (id) => {
      state.lists = state.lists.filter((l) => l.id !== id);
      for (const s of state.stars) s.listIds = s.listIds.filter((l) => l !== id);
    },
    classify: async ({ scope }) => {
      await wait(700);
      const todo = state.stars.filter((s) => !s.suggestion && (scope !== "unlisted" || s.listIds.length === 0));
      const now = new Date();
      for (const s of todo.slice(0, 64)) {
        const cat = catOf.get(s.id);
        const list = state.lists.find((l) => l.name === cat?.list);
        const fits = list && r() < 0.85;
        s.suggestion = {
          listId: fits ? list.id : null,
          listConfidence: fits ? 0.55 + r() * 0.43 : 0.3 + r() * 0.3,
          cruft: Math.min(1, Math.max(0, cruftRules(s, now).score + (r() - 0.5) * 0.3)),
          model: "clef-flash",
        };
      }
      return { processed: Math.min(64, todo.length), remaining: Math.max(0, todo.length - 64) };
    },
    discover: async () => {
      await wait(500);
      const g = generate();
      const fresh = g.stars.filter((s) => Date.now() - new Date(s.pushedAt ?? 0).getTime() < 90 * DAY).slice(0, 18);
      const groups = ["llm", "cli", "local-first"].map((topic, i) => ({
        topic,
        repos: fresh.slice(i * 6, i * 6 + 6).map(({ starredAt: _a, reviewedAt: _b, snoozedUntil: _c, listIds: _d, suggestion: _e, growth: _f, ...repo }) => ({
          ...repo,
          id: `D_${repo.id}`,
          createdAt: new Date(Date.now() - r() * 100 * DAY).toISOString(),
        })),
      }));
      for (const g of groups) for (const repo of g.repos) discovered.set(repo.id, repo);
      return { groups };
    },
    tokenLogin: async () => {},
    logout: async () => {},
    exportBackup: async () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "startune-demo-backup.json";
      a.click();
    },
  };
  for (const k of ["sync", "updateLists", "unstar", "star", "review", "createList", "updateList", "deleteList", "classify"] as const) {
    const fn = api[k] as (...args: unknown[]) => Promise<unknown>;
    (api as unknown as Record<string, unknown>)[k] = async (...args: unknown[]) => {
      const out = await fn(...args);
      persist();
      return out;
    };
  }
  return api;
}
