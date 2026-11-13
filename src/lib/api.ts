import type {
  Audience,
  BulkResult,
  ChartResult,
  ClassifyInput,
  ClassifyResult,
  CreateListInput,
  Discover,
  Library,
  Me,
  Mine,
  ReviewInput,
  StarList,
  SyncStep,
  UpdateListsInput,
} from '@shared/schemas'
import { hc } from 'hono/client'

import type { AppType } from '../../worker/index'
import { createDemoBackend } from './demo'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export interface Backend {
  demo: boolean
  me(): Promise<Me>
  library(): Promise<Library>
  sync(input: {
    runId: string
    phase: 'stars' | 'lists' | 'finish'
    cursor: string | null
  }): Promise<SyncStep>
  updateLists(input: UpdateListsInput): Promise<BulkResult>
  unstar(repoIds: string[]): Promise<BulkResult>
  star(repoIds: string[]): Promise<BulkResult>
  review(input: ReviewInput): Promise<void>
  createList(input: CreateListInput): Promise<StarList>
  updateList(id: string, input: Partial<CreateListInput>): Promise<StarList>
  deleteList(id: string): Promise<void>
  classify(input: ClassifyInput): Promise<ClassifyResult>
  discover(): Promise<Discover>
  /** Your public repos; refresh forces a re-read from GitHub. */
  mine(refresh?: boolean): Promise<Mine>
  /** Chart star history for up to 3 of your repos. */
  chartMine(repoIds: string[]): Promise<ChartResult>
  audience(): Promise<Audience>
  tokenLogin(token: string): Promise<void>
  logout(): Promise<void>
  exportBackup(): Promise<void>
}

/** Typed client for the Worker's routes (Hono RPC): paths, inputs and outputs come from the server. */
const client = hc<AppType>('/', { init: { credentials: 'same-origin' } })

/** A response's JSON, or an ApiError carrying the server's `{ error }` message. */
async function data<R extends { ok: boolean; status: number; json(): Promise<unknown> }>(
  request: Promise<R>,
): Promise<Awaited<ReturnType<R['json']>>> {
  const res = await request
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`)
  }
  return (await res.json()) as Awaited<ReturnType<R['json']>>
}

const { api, auth } = client

const remote: Backend = {
  demo: false,
  me: () => data(api.me.$get()),
  library: () => data(api.library.$get()),
  sync: (input) => data(api.sync.$post({ json: input })),
  updateLists: (input) => data(api.stars.lists.$post({ json: input })),
  unstar: (repoIds) => data(api.stars.unstar.$post({ json: { repoIds } })),
  star: (repoIds) => data(api.stars.star.$post({ json: { repoIds } })),
  review: async (input) => void (await data(api.stars.review.$post({ json: input }))),
  createList: (input) => data(api.lists.$post({ json: input })),
  updateList: (id, input) => data(api.lists[':id'].$patch({ param: { id }, json: input })),
  deleteList: async (id) => void (await data(api.lists[':id'].$delete({ param: { id } }))),
  classify: (input) => data(api.ai.classify.$post({ json: input })),
  discover: () => data(api.discover.$get()),
  mine: (refresh) => data(api.mine.$get({ query: refresh ? { refresh: '1' } : {} })),
  chartMine: (repoIds) => data(api.mine.chart.$post({ json: { repoIds } })),
  audience: () => data(api.mine.audience.$get()),
  tokenLogin: async (token) => void (await data(auth.token.$post({ json: { token } }))),
  logout: async () => void (await data(auth.logout.$post())),
  exportBackup: async () => {
    window.location.href = '/api/export'
  },
}

const DEMO_KEY = 'startune:demo'

export function isDemo(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  const url = new URL(window.location.href)
  if (url.searchParams.get('demo') === '1') {
    localStorage.setItem(DEMO_KEY, '1')
  }
  if (url.searchParams.get('demo') === '0') {
    localStorage.removeItem(DEMO_KEY)
  }
  return localStorage.getItem(DEMO_KEY) === '1'
}

export function setDemo(on: boolean) {
  if (on) {
    localStorage.setItem(DEMO_KEY, '1')
  } else {
    localStorage.removeItem(DEMO_KEY)
  }
  sessionStorage.removeItem('startune:demo-state')
  window.location.assign('/')
}

export const backend: Backend = isDemo() ? createDemoBackend() : remote
