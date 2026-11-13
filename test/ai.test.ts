import { describe, expect, it } from 'vitest'

import { batchSize, buildRequest, MAX_QUESTIONS, parseResponse } from '../worker/ai'

const repo = (i: number) => ({
  id: `R_${i}`,
  fullName: `o/r${i}`,
  description: 'Fast grep',
  topics: ['cli'],
  language: 'Rust',
  stars: 10,
  isArchived: false,
  isFork: false,
  pushedAt: '2026-01-01T00:00:00Z',
  latestReleaseAt: null,
  starredAt: '2020-01-01T00:00:00Z',
})
const lists = [
  { id: 'UL_a', name: 'CLI', description: 'Terminal tools' },
  { id: 'UL_b', name: 'Web', description: null },
]

describe('Clef request', () => {
  it('stays within the question limit', () => {
    const n = batchSize(lists.length)
    const { request } = buildRequest(
      'clef-flash',
      Array.from({ length: n }, (_, i) => repo(i)),
      lists,
      '2026-11-11',
    )
    expect(Object.keys(request.questions).length).toBeLessThanOrEqual(MAX_QUESTIONS)
    expect(request.questions.list_r0?.criteria).toMatchObject({
      list_0: 'CLI: Terminal tools',
      list_1: 'Web',
      none: expect.any(String),
    })
  })
  it('skips list questions when there are no lists', () => {
    const { request } = buildRequest('clef', [repo(0)], [], '2026-11-11')
    expect(Object.keys(request.questions)).toEqual(['cruft_r0'])
    expect(batchSize(0)).toBe(64)
  })
  it('maps answers back to list ids', () => {
    const { listKeys } = buildRequest('clef-flash', [repo(0), repo(1)], lists, '2026-11-11')
    const out = parseResponse(
      {
        answers: {
          list_r0: { choice: 'list_0', confidence: 0.9 },
          cruft_r0: { noul: 0.1 },
          list_r1: { choice: 'none', confidence: 0.6 },
          cruft_r1: { noul: 0.8 },
        },
      },
      [{ id: 'R_0' }, { id: 'R_1' }],
      listKeys,
    )
    expect(out).toEqual([
      { repoId: 'R_0', listId: 'UL_a', listConfidence: 0.9, cruft: 0.1 },
      { repoId: 'R_1', listId: null, listConfidence: 0.6, cruft: 0.8 },
    ])
  })
  it('rejects malformed responses', () => {
    expect(() => parseResponse({ nope: 1 }, [], new Map())).toThrow()
  })
})
