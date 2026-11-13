import type { Audience, OwnRepo, Repo, Stargazer, Upkeep } from '@shared/schemas'

/* Demo "Your repos": a dozen-odd repos for the demo account, each with a believable star history. */

const DAY = 86_400_000

function rng(seed: number) {
  let s = seed
  return () => {
    s |= 0
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Spec {
  name: string
  description: string | null
  language: string
  color: string
  topics: string[]
  stars: number
  /** Days ago. */
  created: number
  pushed: number
  release?: { ago: number; tag: string }
  /** Star bursts: days ago, share of all stars, width in days. Whatever is left accrues steadily. */
  bursts: Array<[number, number, number]>
  archived?: boolean
  fork?: boolean
  license?: string | null
  upkeep?: Partial<Upkeep>
}

const SPECS: Spec[] = [
  {
    name: 'lumen-grep',
    description: 'A grep that understands code structure. Search by syntax, not just text.',
    language: 'Rust',
    color: '#dea584',
    topics: ['cli', 'search', 'tree-sitter', 'developer-tools'],
    stars: 4870,
    created: 820,
    pushed: 2,
    release: { ago: 19, tag: 'v2.4.0' },
    bursts: [
      [760, 0.42, 3],
      [410, 0.12, 4],
      [24, 0.07, 2],
    ],
    license: 'MIT',
    upkeep: {
      openIssues: 38,
      openPrs: 6,
      waitingPrs: 2,
      oldestWaitingPrAt: ago(23),
      unanswered: 3,
      oldestUnansweredAt: ago(9),
      watchers: 41,
    },
  },
  {
    name: 'tidepool',
    description: 'Local-first sync engine for SQLite. CRDTs without the ceremony.',
    language: 'TypeScript',
    color: '#3178c6',
    topics: ['local-first', 'sqlite', 'crdt', 'sync'],
    stars: 1260,
    created: 1180,
    pushed: 5,
    release: { ago: 140, tag: 'v0.9.2' },
    bursts: [[1100, 0.1, 6]],
    license: 'Apache-2.0',
    upkeep: {
      openIssues: 14,
      openPrs: 2,
      waitingPrs: 1,
      oldestWaitingPrAt: ago(6),
      unanswered: 1,
      oldestUnansweredAt: ago(2),
      watchers: 18,
    },
  },
  {
    name: 'orbit-ui',
    description: 'Headless radial menus and orbit pickers for React.',
    language: 'TypeScript',
    color: '#3178c6',
    topics: ['react', 'ui', 'components'],
    stars: 214,
    created: 46,
    pushed: 1,
    bursts: [
      [38, 0.55, 1.5],
      [9, 0.25, 1.5],
    ],
    license: 'MIT',
    upkeep: {
      openIssues: 7,
      openPrs: 1,
      waitingPrs: 1,
      oldestWaitingPrAt: ago(3),
      unanswered: 2,
      oldestUnansweredAt: ago(4),
      watchers: 6,
    },
  },
  {
    name: 'pixel-forge',
    description: 'Tiny pixel art editor that runs in a single HTML file.',
    language: 'JavaScript',
    color: '#f1e05a',
    topics: ['pixel-art', 'editor', 'creative-coding'],
    stars: 655,
    created: 2300,
    pushed: 1560,
    release: { ago: 1600, tag: 'v1.3.0' },
    bursts: [[2200, 0.5, 4]],
    license: 'MIT',
    upkeep: { openIssues: 22, openPrs: 0, watchers: 12 },
  },
  {
    name: 'dotfiles',
    description: 'My shell, editor and terminal setup.',
    language: 'Shell',
    color: '#89e051',
    topics: [],
    stars: 88,
    created: 2900,
    pushed: 12,
    bursts: [],
    license: null,
    upkeep: { openIssues: 1, watchers: 3 },
  },
  {
    name: 'kite-router',
    description: 'Edge router for Cloudflare Workers with typed params.',
    language: 'TypeScript',
    color: '#3178c6',
    topics: ['cloudflare-workers', 'router', 'edge'],
    stars: 342,
    created: 640,
    pushed: 160,
    release: { ago: 300, tag: 'v1.1.0' },
    bursts: [[600, 0.3, 3]],
    license: 'MIT',
    upkeep: {
      openIssues: 5,
      openPrs: 1,
      waitingPrs: 1,
      oldestWaitingPrAt: ago(61),
      unanswered: 0,
      watchers: 7,
    },
  },
  {
    name: 'nimbus-notes',
    description: 'Deprecated: use tidepool instead.',
    language: 'TypeScript',
    color: '#3178c6',
    topics: ['notes', 'markdown'],
    stars: 131,
    created: 1900,
    pushed: 1300,
    bursts: [[1850, 0.4, 5]],
    license: 'MIT',
    upkeep: { openIssues: 3, watchers: 4 },
  },
  {
    name: 'shader-sketches',
    description: 'Daily GLSL sketches, one file each.',
    language: 'GLSL',
    color: '#5686a5',
    topics: ['shaders', 'creative-coding', 'glsl'],
    stars: 57,
    created: 1400,
    pushed: 980,
    bursts: [[1350, 0.3, 4]],
    archived: true,
    license: 'CC0-1.0',
  },
  {
    name: 'advent-2025',
    description: 'Advent of Code 2025 in Zig.',
    language: 'Zig',
    color: '#ec915c',
    topics: ['advent-of-code', 'zig'],
    stars: 23,
    created: 345,
    pushed: 320,
    bursts: [[340, 0.6, 8]],
    license: null,
  },
  {
    name: 'wasm-playground',
    description: null,
    language: 'Rust',
    color: '#dea584',
    topics: [],
    stars: 9,
    created: 500,
    pushed: 410,
    bursts: [],
    license: null,
  },
  {
    name: 'tree-sitter-kdl',
    description: 'KDL grammar for tree-sitter (fork with fixes).',
    language: 'C',
    color: '#555555',
    topics: [],
    stars: 2,
    created: 700,
    pushed: 690,
    bursts: [],
    fork: true,
    license: 'MIT',
  },
  {
    name: 'workers-sdk',
    description: 'Cloudflare Workers SDK (fork for a PR).',
    language: 'TypeScript',
    color: '#3178c6',
    topics: [],
    stars: 0,
    created: 210,
    pushed: 205,
    bursts: [],
    fork: true,
    license: 'Apache-2.0',
  },
  {
    name: 'blog',
    description: 'Source for my blog.',
    language: 'Astro',
    color: '#ff5a03',
    topics: ['blog'],
    stars: 4,
    created: 1200,
    pushed: 33,
    bursts: [],
    license: null,
  },
]

function ago(days: number) {
  return new Date(Date.now() - days * DAY).toISOString()
}

/** Repos the demo audience stars that the demo account hasn't. */
const UNSTARRED: Array<[string, string, string, string, number]> = [
  [
    'hexgarden/ast-lens',
    'Structural code search as a library: queries over tree-sitter ASTs.',
    'Rust',
    '#dea584',
    2140,
  ],
  [
    'polarnight/syntax-diff',
    "Diffs that understand your language's syntax.",
    'Rust',
    '#dea584',
    8900,
  ],
  ['byteorchard/term-canvas', 'Draw to the terminal with a canvas-like API.', 'Go', '#00ADD8', 760],
  ['zeta-io/codeowners-lint', 'Lint and explain CODEOWNERS files.', 'TypeScript', '#3178c6', 410],
]

const FIRST = [
  'ari',
  'mika',
  'jo',
  'sam',
  'lena',
  'theo',
  'nova',
  'kai',
  'ivy',
  'remy',
  'zoe',
  'eli',
  'maya',
  'otto',
  'sana',
  'felix',
  'rin',
  'noor',
  'leo',
  'tess',
]
const LAST = [
  'dev',
  'codes',
  'k',
  'builds',
  'hq',
  '_',
  'rs',
  'js',
  'labs',
  'x',
  'io',
  's',
  'm',
  'w',
]

/** Cumulative stars at each time, shaped by the spec's bursts plus steady accrual, ending exactly at spec.stars. */
function shape(s: Spec, now: number) {
  const t0 = now - s.created * DAY
  const tEnd = s.archived ? now - s.pushed * DAY : now
  const burstShare = s.bursts.reduce((n, b) => n + b[1], 0)
  const raw = (t: number) => {
    if (t <= t0) {
      return 0
    }
    let v = (1 - burstShare) * Math.min(1, (t - t0) / (tEnd - t0)) ** 1.15
    for (const [at, share, w] of s.bursts) {
      v += share / (1 + Math.exp(-(t - (now - at * DAY)) / (w * DAY)))
    }
    // Subtract each burst's value at creation so the curve starts at zero.
    for (const [at, share, w] of s.bursts) {
      v -= share / (1 + Math.exp(-(t0 - (now - at * DAY)) / (w * DAY)))
    }
    return v
  }
  const end = raw(now)
  return (t: number) => (end > 0 ? Math.round((raw(t) / end) * s.stars) : 0)
}

function build(): {
  repos: OwnRepo[]
  charts: Map<string, Pick<OwnRepo, 'history' | 'exactSince' | 'recent'>>
} {
  const r = rng(99)
  const now = Date.now()
  const repos: OwnRepo[] = []
  const charts = new Map<string, Pick<OwnRepo, 'history' | 'exactSince' | 'recent'>>()
  for (const s of SPECS) {
    const id = `O_${s.name}`
    const repo: Repo = {
      id,
      fullName: `demo/${s.name}`,
      owner: 'demo',
      name: s.name,
      description: s.description,
      url: `https://github.com/demo/${s.name}`,
      homepage: null,
      language: s.language,
      languageColor: s.color,
      topics: s.topics,
      stars: s.stars,
      forks: Math.round(s.stars * (0.04 + r() * 0.08)),
      isArchived: Boolean(s.archived),
      isFork: Boolean(s.fork),
      license: s.license === undefined ? 'MIT' : s.license,
      ownerAvatar: null,
      createdAt: ago(s.created),
      pushedAt: ago(s.pushed),
      latestReleaseAt: s.release ? ago(s.release.ago) : null,
      latestReleaseTag: s.release?.tag ?? null,
    }
    const upkeep: Upkeep = {
      openIssues: 0,
      openPrs: 0,
      waitingPrs: 0,
      oldestWaitingPrAt: null,
      unanswered: 0,
      oldestUnansweredAt: null,
      watchers: 1,
      ...s.upkeep,
    }
    repos.push({ ...repo, upkeep, history: null, exactSince: null, recent: [], chartedAt: null })

    const f = shape(s, now)
    const t0 = now - s.created * DAY
    const n = 260
    const history: Array<[number, number]> = []
    for (let i = 0; i <= n; i += 1) {
      // Denser sampling near the present, where the exact window would be.
      const t = t0 + (now - t0) * (1 - (1 - i / n) ** 1.6)
      const c = f(t)
      const last = history.at(-1)
      if (!last || c !== last[1] || i === n) {
        history.push([Math.round(t), c])
      }
    }
    // When star number `target` arrived: invert the curve.
    const timeOf = (target: number) => {
      let lo = t0
      let hi = now
      for (let it = 0; it < 40; it += 1) {
        const mid = (lo + hi) / 2
        if (f(mid) >= target) {
          hi = mid
        } else {
          lo = mid
        }
      }
      return hi
    }
    // The last 30 stargazers: star numbers total..total-29.
    const recent: Stargazer[] = []
    for (let k = 0; k < Math.min(30, s.stars); k += 1) {
      const hi = timeOf(s.stars - k)
      const notable = r() < 0.08
      recent.push({
        login: `${FIRST[Math.floor(r() * FIRST.length)]}${LAST[Math.floor(r() * LAST.length)]}${r() < 0.4 ? Math.floor(r() * 90) : ''}`,
        name: null,
        avatarUrl: null,
        followers: notable ? Math.round(2000 + r() * 14000) : Math.round(Math.exp(r() * 5.5)),
        starredAt: new Date(hi).toISOString(),
      })
    }
    // As on the real backend: past 1,000 stars, history is exact only from the 100th-newest star.
    charts.set(id, {
      history: s.stars ? history : [],
      exactSince: s.stars > 1000 ? timeOf(s.stars - 99) : 0,
      recent,
    })
  }
  return { repos, charts }
}

export function createDemoOwn(libraryRepos: () => Repo[]) {
  const { repos, charts } = build()
  const charted = new Set<string>()
  const wait = (ms: number) => new Promise((res) => setTimeout(res, ms))
  const view = (r: OwnRepo): OwnRepo => {
    const chart = charted.has(r.id) ? charts.get(r.id) : undefined
    return chart ? { ...r, ...chart, chartedAt: new Date().toISOString() } : r
  }
  return {
    mine: async () => {
      await wait(300)
      return {
        login: 'demo',
        repos: structuredClone(repos.map(view)),
        syncedAt: new Date().toISOString(),
      }
    },
    chartMine: async (ids: string[]) => {
      await wait(380)
      for (const id of ids) {
        charted.add(id)
      }
      return {
        repos: structuredClone(repos.filter((r) => ids.includes(r.id)).map(view)),
        failed: [],
      }
    },
    audience: async (): Promise<Audience> => {
      await wait(500)
      const r = rng(5)
      const pool = libraryRepos()
        .filter((x) => !x.isArchived)
        .sort((a, b) => b.stars - a.stars)
        .slice(0, 60)
      const starred = [...pool].sort(() => r() - 0.5).slice(0, 8)
      const fresh: Repo[] = UNSTARRED.map(([fullName, description, language, color, stars], i) => {
        const [owner, name] = fullName.split('/') as [string, string]
        return {
          id: `A_${i}`,
          fullName,
          owner,
          name,
          description,
          url: `https://github.com/${fullName}`,
          homepage: null,
          language,
          languageColor: color,
          topics: [],
          stars,
          forks: Math.round(stars * 0.06),
          isArchived: false,
          isFork: false,
          license: 'MIT',
          ownerAvatar: null,
          createdAt: ago(200 + i * 90),
          pushedAt: ago(3 + i),
          latestReleaseAt: null,
          latestReleaseTag: null,
        }
      })
      // Interleave, so "not in your stars" ones show up through the ranking.
      const mixed = starred
        .flatMap((s, i) => {
          const f = i % 2 === 0 ? fresh[i / 2] : undefined
          return f ? [f, s] : [s]
        })
        .slice(0, 12)
      return {
        sampled: 40,
        alsoStarred: mixed.map((repo, i) => ({
          repo,
          by: Math.max(2, 12 - i - Math.floor(r() * 2)),
          youStarred: !repo.id.startsWith('A_'),
        })),
      }
    },
  }
}
