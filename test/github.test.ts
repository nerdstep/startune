import { afterEach, describe, expect, it, vi } from 'vitest'

import { reposByIds, toRepo, type GqlRepo } from '../worker/github'

const base: GqlRepo = {
  id: 'R_1',
  nameWithOwner: 'acme/widget',
  name: 'widget',
  owner: { login: 'acme', avatarUrl: null },
  description: null,
  url: 'https://github.com/acme/widget',
  homepageUrl: null,
  primaryLanguage: null,
  repositoryTopics: { nodes: [] },
  stargazerCount: 10,
  forkCount: 1,
  isArchived: false,
  isFork: false,
  licenseInfo: null,
  createdAt: '2018-01-01T00:00:00Z',
  pushedAt: '2023-01-07T00:00:00Z',
  defaultBranchRef: null,
  latestRelease: null,
}

describe('toRepo pushedAt', () => {
  it("uses the default branch's last commit, not a bot push to another branch", () => {
    const r = toRepo({
      ...base,
      defaultBranchRef: { target: { committedDate: '2019-09-11T00:00:00Z' } },
    })
    expect(r.pushedAt).toBe('2019-09-11T00:00:00Z')
  })

  it("falls back to GitHub's pushedAt for a repo with no commits", () => {
    expect(toRepo(base).pushedAt).toBe('2023-01-07T00:00:00Z')
  })
})

describe('reposByIds', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("splits 100 ids into queries of 25 (under GitHub's time limit) and keeps their order", async () => {
    const asked: string[][] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const { variables } = JSON.parse(String(init.body)) as { variables: { ids: string[] } }
        asked.push(variables.ids)
        // A deleted repo comes back as null.
        const nodes = variables.ids.map((id) => (id === 'R_7' ? null : { ...base, id }))
        return Response.json({ data: { nodes } })
      }),
    )
    const ids = Array.from({ length: 100 }, (_, i) => `R_${i}`)
    const repos = await reposByIds('token', ids)
    expect(asked.map((batch) => batch.length)).toEqual([25, 25, 25, 25])
    expect(repos.map((r) => r?.id ?? null)).toEqual(ids.map((id) => (id === 'R_7' ? null : id)))
  })
})
