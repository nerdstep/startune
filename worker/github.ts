import { z } from 'zod'

import type { Repo, Stargazer, Upkeep } from '../shared/schemas'
import { HttpError } from './env'

const UA = 'StarTune (+https://github.com)'

export class GitHubError extends HttpError {}

interface GqlErr {
  type?: string
  message: string
  path?: Array<string | number>
}

/** Run a GraphQL query against GitHub. Partial data with errors is returned when `allowPartial`. */
export async function gql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
  opts: { allowPartial?: boolean } = {},
): Promise<T> {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': UA,
    },
    body: JSON.stringify({ query, variables }),
  })
  if (res.status === 401) {
    throw new GitHubError(401, 'GitHub rejected the token. Sign in again.')
  }
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get('x-ratelimit-reset')
    const when = reset
      ? ` Try again after ${new Date(Number(reset) * 1000).toLocaleTimeString('en-US')}.`
      : ''
    throw new GitHubError(429, `GitHub rate limit hit.${when}`)
  }
  if (!res.ok) {
    throw new GitHubError(502, `GitHub returned ${res.status}`)
  }
  const body = (await res.json()) as { data?: T; errors?: GqlErr[] }
  if (body.errors?.length) {
    const scopes = body.errors.find((e) => e.type === 'INSUFFICIENT_SCOPES')
    if (scopes) {
      throw new GitHubError(403, `Missing GitHub permission: ${scopes.message}`)
    }
    if (!opts.allowPartial || !body.data) {
      throw new GitHubError(502, body.errors.map((e) => e.message).join('; '))
    }
  }
  if (!body.data) {
    throw new GitHubError(502, 'Empty response from GitHub')
  }
  return body.data
}

export async function rest(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': UA,
      ...init.headers,
    },
  })
}

/* ---------- Repository shape ---------- */

export const REPO_FIELDS = /* GraphQL */ `
  fragment RepoFields on Repository {
    id
    nameWithOwner
    name
    owner {
      login
      avatarUrl
    }
    description
    url
    homepageUrl
    primaryLanguage {
      name
      color
    }
    repositoryTopics(first: 12) {
      nodes {
        topic {
          name
        }
      }
    }
    stargazerCount
    forkCount
    isArchived
    isFork
    licenseInfo {
      spdxId
    }
    createdAt
    pushedAt
    latestRelease {
      publishedAt
      tagName
    }
  }
`

export const GqlRepo = z.object({
  id: z.string(),
  nameWithOwner: z.string(),
  name: z.string(),
  owner: z.object({ login: z.string(), avatarUrl: z.string().nullish() }),
  description: z.string().nullish(),
  url: z.string(),
  homepageUrl: z.string().nullish(),
  primaryLanguage: z.object({ name: z.string(), color: z.string().nullish() }).nullish(),
  repositoryTopics: z.object({
    nodes: z.array(z.object({ topic: z.object({ name: z.string() }) }).nullable()),
  }),
  stargazerCount: z.number(),
  forkCount: z.number(),
  isArchived: z.boolean(),
  isFork: z.boolean(),
  licenseInfo: z.object({ spdxId: z.string().nullish() }).nullish(),
  createdAt: z.string().nullish(),
  pushedAt: z.string().nullish(),
  latestRelease: z.object({ publishedAt: z.string().nullish(), tagName: z.string() }).nullish(),
})
export type GqlRepo = z.infer<typeof GqlRepo>

export function toRepo(r: GqlRepo): Repo {
  return {
    id: r.id,
    fullName: r.nameWithOwner,
    owner: r.owner.login,
    name: r.name,
    description: r.description ?? null,
    url: r.url,
    homepage: r.homepageUrl || null,
    language: r.primaryLanguage?.name ?? null,
    languageColor: r.primaryLanguage?.color ?? null,
    topics: r.repositoryTopics.nodes.flatMap((n) => (n ? [n.topic.name] : [])),
    stars: r.stargazerCount,
    forks: r.forkCount,
    isArchived: r.isArchived,
    isFork: r.isFork,
    license:
      r.licenseInfo?.spdxId && r.licenseInfo.spdxId !== 'NOASSERTION' ? r.licenseInfo.spdxId : null,
    ownerAvatar: r.owner.avatarUrl ?? null,
    createdAt: r.createdAt ?? null,
    pushedAt: r.pushedAt ?? null,
    latestReleaseAt: r.latestRelease?.publishedAt ?? null,
    latestReleaseTag: r.latestRelease?.tagName ?? null,
  }
}

/* ---------- Queries ---------- */

export async function viewer(token: string) {
  const data = await gql<{
    viewer: { id: string; login: string; name: string | null; avatarUrl: string }
  }>(token, `query { viewer { id login name avatarUrl } }`)
  return data.viewer
}

const StarPage = z.object({
  viewer: z.object({
    starredRepositories: z.object({
      totalCount: z.number(),
      pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
      edges: z.array(z.object({ starredAt: z.string(), node: GqlRepo })),
    }),
  }),
})

export async function starPage(token: string, after: string | null) {
  const data = await gql<unknown>(
    token,
    `query($after: String) {
      viewer {
        starredRepositories(first: 100, after: $after, orderBy: { field: STARRED_AT, direction: DESC }) {
          totalCount
          pageInfo { hasNextPage endCursor }
          edges { starredAt node { ...RepoFields } }
        }
      }
    }
    ${REPO_FIELDS}`,
    { after },
  )
  return StarPage.parse(data).viewer.starredRepositories
}

const ItemsConn = z.object({
  totalCount: z.number(),
  pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
  nodes: z.array(z.object({ id: z.string().optional() }).nullable()),
})

const ListsPage = z.object({
  viewer: z.object({
    lists: z.object({
      pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
      nodes: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          slug: z.string(),
          description: z.string().nullish(),
          isPrivate: z.boolean(),
          items: ItemsConn,
        }),
      ),
    }),
  }),
})

export interface GhList {
  id: string
  name: string
  slug: string
  description: string | null
  isPrivate: boolean
  repoIds: string[]
}

/** Fetch all of the viewer's lists with every item. Costs 1 + extra pages for big lists. */
export async function allLists(token: string): Promise<GhList[]> {
  const out: GhList[] = []
  let after: string | null = null
  do {
    const raw: unknown = await gql<unknown>(
      token,
      `query($after: String) {
        viewer {
          lists(first: 30, after: $after) {
            pageInfo { hasNextPage endCursor }
            nodes {
              id name slug description isPrivate
              items(first: 100) {
                totalCount
                pageInfo { hasNextPage endCursor }
                nodes { ... on Repository { id } }
              }
            }
          }
        }
      }`,
      { after },
    )
    const page = ListsPage.parse(raw).viewer.lists
    for (const l of page.nodes) {
      const repoIds = l.items.nodes.flatMap((n) => (n?.id ? [n.id] : []))
      let cursor = l.items.pageInfo.hasNextPage ? l.items.pageInfo.endCursor : null
      while (cursor) {
        const more = await listItemsPage(token, l.id, cursor)
        repoIds.push(...more.ids)
        cursor = more.next
      }
      out.push({
        id: l.id,
        name: l.name,
        slug: l.slug,
        description: l.description ?? null,
        isPrivate: l.isPrivate,
        repoIds,
      })
    }
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null
  } while (after)
  return out
}

async function listItemsPage(token: string, listId: string, after: string) {
  const raw = await gql<{ node: { items: unknown } | null }>(
    token,
    `query($id: ID!, $after: String) {
      node(id: $id) {
        ... on UserList {
          items(first: 100, after: $after) {
            totalCount
            pageInfo { hasNextPage endCursor }
            nodes { ... on Repository { id } }
          }
        }
      }
    }`,
    { id: listId, after },
  )
  const items = ItemsConn.parse(raw.node?.items)
  return {
    ids: items.nodes.flatMap((n) => (n?.id ? [n.id] : [])),
    next: items.pageInfo.hasNextPage ? items.pageInfo.endCursor : null,
  }
}

/** Refresh up to 100 repos by node id. Missing (deleted/private) repos come back as null. */
export async function reposByIds(token: string, ids: string[]): Promise<Array<Repo | null>> {
  const data = await gql<{ nodes: unknown[] }>(
    token,
    `query($ids: [ID!]!) { nodes(ids: $ids) { ...RepoFields } } ${REPO_FIELDS}`,
    { ids },
    { allowPartial: true },
  )
  return data.nodes.map((n) => {
    const parsed = GqlRepo.safeParse(n)
    return parsed.success ? toRepo(parsed.data) : null
  })
}

/** Several topic searches in a single request using aliases. */
export async function searchTopics(token: string, queries: Array<{ key: string; q: string }>) {
  const fields = queries
    .map(
      (q, i) => `s${i}: search(type: REPOSITORY, query: ${JSON.stringify(q.q)}, first: 8) {
        nodes { ...RepoFields }
      }`,
    )
    .join('\n')
  const data = await gql<Record<string, { nodes: unknown[] }>>(
    token,
    `query { ${fields} } ${REPO_FIELDS}`,
    {},
    { allowPartial: true },
  )
  return queries.map((q, i) => ({
    key: q.key,
    repos: (data[`s${i}`]?.nodes ?? []).flatMap((n) => {
      const p = GqlRepo.safeParse(n)
      return p.success ? [toRepo(p.data)] : []
    }),
  }))
}

/* ---------- Your repos ---------- */

const Who = z.object({ login: z.string() }).nullish()
const OwnNode = GqlRepo.extend({
  watchers: z.object({ totalCount: z.number() }),
  issues: z.object({ totalCount: z.number() }),
  pullRequests: z.object({ totalCount: z.number() }),
  oldPrs: z.object({
    nodes: z.array(
      z.object({ createdAt: z.string(), isDraft: z.boolean(), author: Who }).nullable(),
    ),
  }),
  newIssues: z.object({
    nodes: z.array(
      z
        .object({
          createdAt: z.string(),
          author: Who,
          comments: z.object({ totalCount: z.number() }),
        })
        .nullable(),
    ),
  }),
})

const OwnPage = z.object({
  viewer: z.object({
    repositories: z.object({
      pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
      nodes: z.array(z.unknown()),
    }),
  }),
})

/** Public repos the viewer owns (forks included), most-starred first, with what's waiting on them. Up to 300. */
export async function ownRepos(
  token: string,
  login: string,
): Promise<Array<{ repo: Repo; upkeep: Upkeep }>> {
  const out: Array<{ repo: Repo; upkeep: Upkeep }> = []
  let after: string | null = null
  const me = login.toLowerCase()
  const byOther = (a: { login: string } | null | undefined) =>
    a != null && a.login.toLowerCase() !== me
  for (let page = 0; page < 3; page += 1) {
    const raw: unknown = await gql<unknown>(
      token,
      `query($after: String) {
        viewer {
          repositories(first: 100, after: $after, ownerAffiliations: OWNER, privacy: PUBLIC, orderBy: { field: STARGAZERS, direction: DESC }) {
            pageInfo { hasNextPage endCursor }
            nodes {
              ...RepoFields
              watchers { totalCount }
              issues(states: OPEN) { totalCount }
              pullRequests(states: OPEN) { totalCount }
              oldPrs: pullRequests(states: OPEN, first: 10, orderBy: { field: CREATED_AT, direction: ASC }) { nodes { createdAt isDraft author { login } } }
              newIssues: issues(states: OPEN, first: 10, orderBy: { field: CREATED_AT, direction: DESC }) { nodes { createdAt author { login } comments { totalCount } } }
            }
          }
        }
      }
      ${REPO_FIELDS}`,
      { after },
      { allowPartial: true },
    )
    const conn = OwnPage.parse(raw).viewer.repositories
    for (const n of conn.nodes) {
      const p = OwnNode.safeParse(n)
      if (!p.success) {
        continue
      }
      const r = p.data
      const prs = r.oldPrs.nodes.filter(
        (x): x is NonNullable<typeof x> => x != null && !x.isDraft && byOther(x.author),
      )
      const quiet = r.newIssues.nodes.filter(
        (x): x is NonNullable<typeof x> =>
          x != null && x.comments.totalCount === 0 && byOther(x.author),
      )
      out.push({
        repo: toRepo(r),
        upkeep: {
          openIssues: r.issues.totalCount,
          openPrs: r.pullRequests.totalCount,
          waitingPrs: prs.length,
          oldestWaitingPrAt: prs[0]?.createdAt ?? null,
          unanswered: quiet.length,
          oldestUnansweredAt: quiet.at(-1)?.createdAt ?? null,
          watchers: r.watchers.totalCount,
        },
      })
    }
    after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null
    if (!after) {
      break
    }
  }
  return out
}

const RecentGazers = z.object({
  node: z
    .object({
      stargazers: z.object({
        totalCount: z.number(),
        edges: z.array(
          z.object({
            starredAt: z.string(),
            node: z.object({
              login: z.string(),
              name: z.string().nullish(),
              avatarUrl: z.string().nullish(),
              followers: z.object({ totalCount: z.number() }),
            }),
          }),
        ),
      }),
    })
    .nullable(),
})

/** Older stars are read in full up to this many pages of 100; beyond it, this many pages are sampled. */
const EXACT_PAGES = 9
const SAMPLE_PAGES = 9

/**
 * Rebuild a repo's star history: the newest 100 stargazers exactly (GraphQL), and the older ones from
 * GitHub's dated stargazer pages, read in full for small repos and sampled evenly for big ones.
 * GitHub serves at most 400 pages, so stars past 40,000 are only covered by the recent window.
 */
export async function chartRepo(
  token: string,
  fullName: string,
  id: string,
  /** The last chart, if under a week old: when the new stars fit in the newest 100, only that call is made. */
  prev?: { history: Array<[number, number]>; exactSince: number | null } | null,
) {
  const raw = await gql<unknown>(
    token,
    `query($id: ID!) {
      node(id: $id) {
        ... on Repository {
          stargazers(first: 100, orderBy: { field: STARRED_AT, direction: DESC }) {
            totalCount
            edges { starredAt node { login name avatarUrl followers { totalCount } } }
          }
        }
      }
    }`,
    { id },
  )
  const sg = RecentGazers.parse(raw).node?.stargazers
  if (!sg) {
    return null
  }
  const total = sg.totalCount
  const recent: Stargazer[] = sg.edges.map((e) => ({
    login: e.node.login,
    name: e.node.name ?? null,
    avatarUrl: e.node.avatarUrl ?? null,
    followers: e.node.followers.totalCount,
    starredAt: e.starredAt,
  }))
  const now = Date.now()
  const pts: Array<[number, number]> = []
  // Recent window, oldest first: the k-th of n is star number total - n + k + 1.
  const asc = [...recent].reverse()
  for (const [k, g] of asc.entries()) {
    pts.push([new Date(g.starredAt).getTime(), total - asc.length + k + 1])
  }
  let exactSince = 0
  const first = asc[0]
  const oldestRecent = first ? new Date(first.starredAt).getTime() : now

  const older = total - asc.length
  const prevTotal = prev?.history.at(-1)?.[1] ?? null
  if (prev && prevTotal != null && older > 0 && prevTotal >= older && prevTotal <= total) {
    // Incremental: the earlier chart covers everything before the newest 100 stars.
    for (const pt of prev.history) {
      if (pt[0] < oldestRecent) {
        pts.push([pt[0], Math.min(pt[1], older)])
      }
    }
    exactSince = prev.exactSince == null ? oldestRecent : Math.min(prev.exactSince, oldestRecent)
  } else if (older > 0) {
    const olderPages = Math.ceil(older / 100)
    const exact = olderPages <= EXACT_PAGES
    const last = Math.min(400, olderPages)
    const pages = exact
      ? Array.from({ length: olderPages }, (_, i) => i + 1)
      : [
          ...new Set(
            Array.from(
              { length: SAMPLE_PAGES },
              (_, i) => 1 + Math.round((i * (last - 1)) / (SAMPLE_PAGES - 1)),
            ),
          ),
        ]
    const got = await Promise.all(
      pages.map(async (p) => {
        const res = await rest(token, `/repos/${fullName}/stargazers?per_page=100&page=${p}`, {
          headers: { Accept: 'application/vnd.github.star+json' },
        })
        if (!res.ok) {
          return { p, rows: [] as Array<{ starred_at: string }>, failed: true }
        }
        return { p, rows: (await res.json()) as Array<{ starred_at: string }>, failed: false }
      }),
    )
    for (const { p, rows } of got) {
      const base = (p - 1) * 100
      // The last row that is still older than the recent window (the final page overlaps it).
      const lastOlder = Math.min(rows.length - 1, older - base - 1)
      const take = exact ? rows.map((_, i) => i) : [0, lastOlder]
      for (const i of new Set(take)) {
        const row = rows[i]
        if (row && base + i < older) {
          pts.push([new Date(row.starred_at).getTime(), base + i + 1])
        }
      }
    }
    // A missing page leaves a gap that is interpolated, so the history is only exact from the recent window.
    if (!exact || got.some((g) => g.failed)) {
      exactSince = oldestRecent
    }
  }

  pts.sort((a, b) => a[0] - b[0])
  // Unstars can make sampled counts disagree slightly; keep the curve monotonic.
  let floor = -Infinity
  for (const pt of pts) {
    if (pt[1] < floor) {
      pt[1] = floor
    }
    floor = pt[1]
  }
  pts.push([now, total])
  return { history: thin(pts, 320), exactSince, recent: recent.slice(0, 30), total }
}

/** Keep at most n points, always keeping the newest 100 and the ends. Thinned exact stretches interpolate
 * between kept stars; at chart scale (one point per few pixels) that is indistinguishable. */
function thin(pts: Array<[number, number]>, n: number): Array<[number, number]> {
  if (pts.length <= n) {
    return pts
  }
  const head = pts.slice(0, -101)
  const tail = pts.slice(-101)
  const step = Math.ceil(head.length / (n - tail.length))
  return [...head.filter((_, i) => i % step === 0), ...tail]
}

/** What a sample of people starred recently, in one aliased query. */
export async function alsoStarred(token: string, logins: string[]): Promise<Repo[][]> {
  if (logins.length === 0) {
    return []
  }
  const vars = Object.fromEntries(logins.map((l, i) => [`l${i}`, l]))
  const decl = logins.map((_, i) => `$l${i}: String!`).join(', ')
  const fields = logins
    .map(
      (_, i) =>
        `u${i}: user(login: $l${i}) { starredRepositories(first: 20, orderBy: { field: STARRED_AT, direction: DESC }) { nodes { ...RepoFields } } }`,
    )
    .join('\n')
  const data = await gql<Record<string, { starredRepositories: { nodes: unknown[] } } | null>>(
    token,
    `query(${decl}) { ${fields} } ${REPO_FIELDS}`,
    vars,
    {
      allowPartial: true,
    },
  )
  return logins.map((_, i) =>
    (data[`u${i}`]?.starredRepositories.nodes ?? []).flatMap((n) => {
      const p = GqlRepo.safeParse(n)
      return p.success ? [toRepo(p.data)] : []
    }),
  )
}

/* ---------- Mutations ---------- */

export async function setListsForRepo(token: string, repoId: string, listIds: string[]) {
  await gql(
    token,
    `mutation($itemId: ID!, $listIds: [ID!]!) {
      updateUserListsForItem(input: { itemId: $itemId, listIds: $listIds }) { clientMutationId }
    }`,
    { itemId: repoId, listIds },
  )
}

export async function createList(
  token: string,
  input: { name: string; description?: string; isPrivate: boolean },
) {
  const data = await gql<{
    createUserList: {
      list: {
        id: string
        name: string
        slug: string
        description: string | null
        isPrivate: boolean
      }
    }
  }>(
    token,
    `mutation($name: String!, $description: String, $isPrivate: Boolean) {
      createUserList(input: { name: $name, description: $description, isPrivate: $isPrivate }) {
        list { id name slug description isPrivate }
      }
    }`,
    input,
  )
  return data.createUserList.list
}

export async function updateList(
  token: string,
  listId: string,
  input: { name?: string; description?: string; isPrivate?: boolean },
) {
  const data = await gql<{
    updateUserList: {
      list: {
        id: string
        name: string
        slug: string
        description: string | null
        isPrivate: boolean
      }
    }
  }>(
    token,
    `mutation($listId: ID!, $name: String, $description: String, $isPrivate: Boolean) {
      updateUserList(input: { listId: $listId, name: $name, description: $description, isPrivate: $isPrivate }) {
        list { id name slug description isPrivate }
      }
    }`,
    { listId, ...input },
  )
  return data.updateUserList.list
}

export async function deleteList(token: string, listId: string) {
  await gql(
    token,
    `mutation($listId: ID!) { deleteUserList(input: { listId: $listId }) { clientMutationId } }`,
    { listId },
  )
}

export async function removeStar(token: string, repoId: string) {
  await gql(
    token,
    `mutation($id: ID!) { removeStar(input: { starrableId: $id }) { clientMutationId } }`,
    { id: repoId },
  )
}

export async function addStar(token: string, repoId: string) {
  await gql(
    token,
    `mutation($id: ID!) { addStar(input: { starrableId: $id }) { clientMutationId } }`,
    { id: repoId },
  )
}
