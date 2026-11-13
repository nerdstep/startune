import { z } from 'zod'

import type { Repo, StarList } from '../shared/schemas'
import { clefModel, HttpError, type Bindings } from './env'

/** Clef allows 64 questions per request; we ask up to 2 per repo. */
export const MAX_QUESTIONS = 64

export interface ClefQuestion {
  type: 'noul' | 'choice' | 'score'
  instructions: string
  criteria?: Record<string, string | null> | string[]
}

export interface ClefRequest {
  model: 'clef' | 'clef-flash'
  state: unknown
  questions: Record<string, ClefQuestion>
}

export interface Classification {
  repoId: string
  listId: string | null
  listConfidence: number
  cruft: number
}

type RepoForAI = Pick<
  Repo,
  | 'id'
  | 'fullName'
  | 'description'
  | 'topics'
  | 'language'
  | 'stars'
  | 'isArchived'
  | 'isFork'
  | 'pushedAt'
  | 'latestReleaseAt'
> & {
  starredAt: string
}

export function batchSize(listCount: number): number {
  return listCount > 0 ? Math.floor(MAX_QUESTIONS / 2) : MAX_QUESTIONS
}

/** Build one Clef request covering several repos. Pure, so it's unit-tested. */
export function buildRequest(
  model: ClefRequest['model'],
  repos: RepoForAI[],
  lists: Pick<StarList, 'id' | 'name' | 'description'>[],
  today: string,
): { request: ClefRequest; listKeys: Map<string, string> } {
  const listKeys = new Map<string, string>() // key -> list id
  const criteria: Record<string, string | null> = {}
  for (const [i, l] of lists.slice(0, 254).entries()) {
    const key = `list_${i}`
    listKeys.set(key, l.id)
    criteria[key] = l.description ? `${l.name}: ${l.description}` : l.name
  }
  criteria.none = 'None of these lists is a clear fit'

  const state = {
    today,
    lists: Object.fromEntries([...listKeys.keys()].map((k) => [k, criteria[k]])),
    repos: Object.fromEntries(
      repos.map((r, i) => [
        `r${i}`,
        {
          name: r.fullName,
          description: r.description ?? '(no description)',
          topics: r.topics,
          language: r.language,
          stars: r.stars,
          archived: r.isArchived,
          fork: r.isFork,
          last_push: r.pushedAt?.slice(0, 10) ?? 'unknown',
          latest_release: r.latestReleaseAt?.slice(0, 10) ?? 'none',
          starred_on: r.starredAt.slice(0, 10),
        },
      ]),
    ),
  }

  const questions: Record<string, ClefQuestion> = {}
  for (const i of repos.keys()) {
    if (listKeys.size > 0) {
      questions[`list_r${i}`] = {
        type: 'choice',
        instructions: `Which of the user's GitHub star lists is the best home for \`repos.r${i}\`? Judge by what the project is for (description, topics, language). Pick "none" unless one list clearly fits.`,
        criteria,
      }
    }
    questions[`cruft_r${i}`] = {
      type: 'noul',
      instructions: `Is \`repos.r${i}\` probably no longer worth keeping as a GitHub star because it is abandoned, deprecated, superseded by another project, or a stale fork? Compare last_push and latest_release with today. Popular, still-maintained projects are not cruft.`,
    }
  }

  return { request: { model, state, questions }, listKeys }
}

const Answer = z.object({
  noul: z.number().optional(),
  choice: z.string().optional(),
  confidence: z.number().optional(),
})
const ClefResponse = z.object({ answers: z.record(z.string(), Answer) })

export function parseResponse(
  raw: unknown,
  repos: Array<{ id: string }>,
  listKeys: Map<string, string>,
): Classification[] {
  const parsed = ClefResponse.safeParse(raw)
  if (!parsed.success) {
    throw new HttpError(502, 'Unexpected response from Clef')
  }
  const a = parsed.data.answers
  return repos.map((r, i) => {
    const list = a[`list_r${i}`]
    const cruft = a[`cruft_r${i}`]
    const choice = list?.choice
    return {
      repoId: r.id,
      listId: choice && choice !== 'none' ? (listKeys.get(choice) ?? null) : null,
      listConfidence: list?.confidence ?? 0,
      cruft: cruft?.noul ?? 0,
    }
  })
}

export async function classify(
  env: Bindings,
  repos: RepoForAI[],
  lists: Pick<StarList, 'id' | 'name' | 'description'>[],
  today: string,
): Promise<Classification[]> {
  const model = clefModel(env)
  const { request, listKeys } = buildRequest(model, repos, lists, today)
  // Generated Workers AI types don't know about Clef yet.
  const ai = env.AI as unknown as { run(model: string, input: unknown): Promise<unknown> }
  let raw: unknown
  try {
    raw = await ai.run(`@cf/cloudflare/${model}`, request)
  } catch (e) {
    throw new HttpError(502, `Workers AI error: ${e instanceof Error ? e.message : String(e)}`)
  }
  return parseResponse(raw, repos, listKeys)
}
