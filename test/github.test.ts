import { describe, expect, it } from 'vitest'

import { toRepo, type GqlRepo } from '../worker/github'

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
