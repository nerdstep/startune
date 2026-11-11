import { z } from "zod";
import type { Repo } from "../shared/schemas";
import { HttpError } from "./env";

const UA = "StarTune (+https://github.com)";

export class GitHubError extends HttpError {}

interface GqlErr {
  type?: string;
  message: string;
  path?: Array<string | number>;
}

/** Run a GraphQL query against GitHub. Partial data with errors is returned when `allowPartial`. */
export async function gql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
  opts: { allowPartial?: boolean } = {},
): Promise<T> {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": UA,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (res.status === 401) throw new GitHubError(401, "GitHub rejected the token. Sign in again.");
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get("x-ratelimit-reset");
    const when = reset ? ` Try again after ${new Date(Number(reset) * 1000).toLocaleTimeString("en-US")}.` : "";
    throw new GitHubError(429, `GitHub rate limit hit.${when}`);
  }
  if (!res.ok) throw new GitHubError(502, `GitHub returned ${res.status}`);
  const body = (await res.json()) as { data?: T; errors?: GqlErr[] };
  if (body.errors?.length) {
    const scopes = body.errors.find((e) => e.type === "INSUFFICIENT_SCOPES");
    if (scopes) throw new GitHubError(403, `Missing GitHub permission: ${scopes.message}`);
    if (!opts.allowPartial || !body.data) throw new GitHubError(502, body.errors.map((e) => e.message).join("; "));
  }
  if (!body.data) throw new GitHubError(502, "Empty response from GitHub");
  return body.data;
}

export async function rest(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": UA,
      ...init.headers,
    },
  });
}

/* ---------- Repository shape ---------- */

export const REPO_FIELDS = /* GraphQL */ `
  fragment RepoFields on Repository {
    id
    nameWithOwner
    name
    owner { login avatarUrl }
    description
    url
    homepageUrl
    primaryLanguage { name color }
    repositoryTopics(first: 12) { nodes { topic { name } } }
    stargazerCount
    forkCount
    isArchived
    isFork
    licenseInfo { spdxId }
    createdAt
    pushedAt
    latestRelease { publishedAt tagName }
  }
`;

export const GqlRepo = z.object({
  id: z.string(),
  nameWithOwner: z.string(),
  name: z.string(),
  owner: z.object({ login: z.string(), avatarUrl: z.string().nullish() }),
  description: z.string().nullish(),
  url: z.string(),
  homepageUrl: z.string().nullish(),
  primaryLanguage: z.object({ name: z.string(), color: z.string().nullish() }).nullish(),
  repositoryTopics: z.object({ nodes: z.array(z.object({ topic: z.object({ name: z.string() }) }).nullable()) }),
  stargazerCount: z.number(),
  forkCount: z.number(),
  isArchived: z.boolean(),
  isFork: z.boolean(),
  licenseInfo: z.object({ spdxId: z.string().nullish() }).nullish(),
  createdAt: z.string().nullish(),
  pushedAt: z.string().nullish(),
  latestRelease: z.object({ publishedAt: z.string().nullish(), tagName: z.string() }).nullish(),
});
export type GqlRepo = z.infer<typeof GqlRepo>;

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
    license: r.licenseInfo?.spdxId && r.licenseInfo.spdxId !== "NOASSERTION" ? r.licenseInfo.spdxId : null,
    ownerAvatar: r.owner.avatarUrl ?? null,
    createdAt: r.createdAt ?? null,
    pushedAt: r.pushedAt ?? null,
    latestReleaseAt: r.latestRelease?.publishedAt ?? null,
    latestReleaseTag: r.latestRelease?.tagName ?? null,
  };
}

/* ---------- Queries ---------- */

export async function viewer(token: string) {
  const data = await gql<{ viewer: { id: string; login: string; name: string | null; avatarUrl: string } }>(
    token,
    `query { viewer { id login name avatarUrl } }`,
  );
  return data.viewer;
}

const StarPage = z.object({
  viewer: z.object({
    starredRepositories: z.object({
      totalCount: z.number(),
      pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
      edges: z.array(z.object({ starredAt: z.string(), node: GqlRepo })),
    }),
  }),
});

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
  );
  return StarPage.parse(data).viewer.starredRepositories;
}

const ItemsConn = z.object({
  totalCount: z.number(),
  pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
  nodes: z.array(z.object({ id: z.string().optional() }).nullable()),
});

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
});

export interface GhList {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPrivate: boolean;
  repoIds: string[];
}

/** Fetch all of the viewer's lists with every item. Costs 1 + extra pages for big lists. */
export async function allLists(token: string): Promise<GhList[]> {
  const out: GhList[] = [];
  let after: string | null = null;
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
    );
    const page = ListsPage.parse(raw).viewer.lists;
    for (const l of page.nodes) {
      const repoIds = l.items.nodes.flatMap((n) => (n?.id ? [n.id] : []));
      let cursor = l.items.pageInfo.hasNextPage ? l.items.pageInfo.endCursor : null;
      while (cursor) {
        const more = await listItemsPage(token, l.id, cursor);
        repoIds.push(...more.ids);
        cursor = more.next;
      }
      out.push({
        id: l.id,
        name: l.name,
        slug: l.slug,
        description: l.description ?? null,
        isPrivate: l.isPrivate,
        repoIds,
      });
    }
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return out;
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
  );
  const items = ItemsConn.parse(raw.node?.items);
  return {
    ids: items.nodes.flatMap((n) => (n?.id ? [n.id] : [])),
    next: items.pageInfo.hasNextPage ? items.pageInfo.endCursor : null,
  };
}

/** Refresh up to 100 repos by node id. Missing (deleted/private) repos come back as null. */
export async function reposByIds(token: string, ids: string[]): Promise<Array<Repo | null>> {
  const data = await gql<{ nodes: unknown[] }>(
    token,
    `query($ids: [ID!]!) { nodes(ids: $ids) { ...RepoFields } } ${REPO_FIELDS}`,
    { ids },
    { allowPartial: true },
  );
  return data.nodes.map((n) => {
    const parsed = GqlRepo.safeParse(n);
    return parsed.success ? toRepo(parsed.data) : null;
  });
}

/** Several topic searches in a single request using aliases. */
export async function searchTopics(token: string, queries: Array<{ key: string; q: string }>) {
  const fields = queries
    .map(
      (q, i) => `s${i}: search(type: REPOSITORY, query: ${JSON.stringify(q.q)}, first: 8) {
        nodes { ...RepoFields }
      }`,
    )
    .join("\n");
  const data = await gql<Record<string, { nodes: unknown[] }>>(token, `query { ${fields} } ${REPO_FIELDS}`, {}, { allowPartial: true });
  return queries.map((q, i) => ({
    key: q.key,
    repos: (data[`s${i}`]?.nodes ?? []).flatMap((n) => {
      const p = GqlRepo.safeParse(n);
      return p.success ? [toRepo(p.data)] : [];
    }),
  }));
}

/* ---------- Mutations ---------- */

export async function setListsForRepo(token: string, repoId: string, listIds: string[]) {
  await gql(
    token,
    `mutation($itemId: ID!, $listIds: [ID!]!) {
      updateUserListsForItem(input: { itemId: $itemId, listIds: $listIds }) { clientMutationId }
    }`,
    { itemId: repoId, listIds },
  );
}

export async function createList(token: string, input: { name: string; description?: string; isPrivate: boolean }) {
  const data = await gql<{ createUserList: { list: { id: string; name: string; slug: string; description: string | null; isPrivate: boolean } } }>(
    token,
    `mutation($name: String!, $description: String, $isPrivate: Boolean) {
      createUserList(input: { name: $name, description: $description, isPrivate: $isPrivate }) {
        list { id name slug description isPrivate }
      }
    }`,
    input,
  );
  return data.createUserList.list;
}

export async function updateList(
  token: string,
  listId: string,
  input: { name?: string; description?: string; isPrivate?: boolean },
) {
  const data = await gql<{ updateUserList: { list: { id: string; name: string; slug: string; description: string | null; isPrivate: boolean } } }>(
    token,
    `mutation($listId: ID!, $name: String, $description: String, $isPrivate: Boolean) {
      updateUserList(input: { listId: $listId, name: $name, description: $description, isPrivate: $isPrivate }) {
        list { id name slug description isPrivate }
      }
    }`,
    { listId, ...input },
  );
  return data.updateUserList.list;
}

export async function deleteList(token: string, listId: string) {
  await gql(token, `mutation($listId: ID!) { deleteUserList(input: { listId: $listId }) { clientMutationId } }`, { listId });
}

export async function removeStar(token: string, repoId: string) {
  await gql(token, `mutation($id: ID!) { removeStar(input: { starrableId: $id }) { clientMutationId } }`, { id: repoId });
}

export async function addStar(token: string, repoId: string) {
  await gql(token, `mutation($id: ID!) { addStar(input: { starrableId: $id }) { clientMutationId } }`, { id: repoId });
}
