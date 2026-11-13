import { z } from 'zod'

/* ---------- Data returned by the API ---------- */

export const RepoSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  owner: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  url: z.string(),
  homepage: z.string().nullable(),
  language: z.string().nullable(),
  languageColor: z.string().nullable(),
  topics: z.array(z.string()),
  stars: z.number(),
  forks: z.number(),
  isArchived: z.boolean(),
  isFork: z.boolean(),
  license: z.string().nullable(),
  ownerAvatar: z.string().nullable(),
  createdAt: z.string().nullable(),
  pushedAt: z.string().nullable(),
  latestReleaseAt: z.string().nullable(),
  latestReleaseTag: z.string().nullable(),
})
export type Repo = z.infer<typeof RepoSchema>

export const SuggestionSchema = z.object({
  listId: z.string().nullable(),
  listConfidence: z.number(),
  cruft: z.number(),
  model: z.string(),
})
export type Suggestion = z.infer<typeof SuggestionSchema>

/** Star history points used to compute growth. */
export const GrowthBasisSchema = z.object({
  base7: z.number().nullable(),
  base30: z.number().nullable(),
  earliestDay: z.string().nullable(),
  earliestStars: z.number().nullable(),
})
export type GrowthBasis = z.infer<typeof GrowthBasisSchema>

export const StarSchema = RepoSchema.extend({
  starredAt: z.string(),
  reviewedAt: z.string().nullable(),
  snoozedUntil: z.string().nullable(),
  listIds: z.array(z.string()),
  suggestion: SuggestionSchema.nullable(),
  growth: GrowthBasisSchema,
})
export type Star = z.infer<typeof StarSchema>

export const ListSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  isPrivate: z.boolean(),
})
export type StarList = z.infer<typeof ListSchema>

export const UnstarredSchema = z.object({
  repoId: z.string(),
  fullName: z.string(),
  unstarredAt: z.string(),
})
export type Unstarred = z.infer<typeof UnstarredSchema>

export const LibrarySchema = z.object({
  stars: z.array(StarSchema),
  lists: z.array(ListSchema),
  recentlyUnstarred: z.array(UnstarredSchema),
  lastSyncedAt: z.string().nullable(),
  today: z.string(),
})
export type Library = z.infer<typeof LibrarySchema>

export const MeSchema = z.object({
  user: z
    .object({ login: z.string(), name: z.string().nullable(), avatarUrl: z.string().nullable() })
    .nullable(),
  oauthEnabled: z.boolean(),
  aiModel: z.string(),
})
export type Me = z.infer<typeof MeSchema>

export const SyncStepSchema = z.object({
  phase: z.enum(['stars', 'lists', 'done']),
  cursor: z.string().nullable(),
  processed: z.number(),
  total: z.number(),
})
export type SyncStep = z.infer<typeof SyncStepSchema>

export const ClassifyResultSchema = z.object({
  processed: z.number(),
  remaining: z.number(),
})
export type ClassifyResult = z.infer<typeof ClassifyResultSchema>

export const DiscoverSchema = z.object({
  groups: z.array(z.object({ topic: z.string(), repos: z.array(RepoSchema) })),
})
export type Discover = z.infer<typeof DiscoverSchema>

export const BulkResultSchema = z.object({
  ok: z.array(z.string()),
  failed: z.array(z.object({ repoId: z.string(), error: z.string() })),
})
export type BulkResult = z.infer<typeof BulkResultSchema>

/* ---------- Your repos ---------- */

export const StargazerSchema = z.object({
  login: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  followers: z.number(),
  starredAt: z.string(),
})
export type Stargazer = z.infer<typeof StargazerSchema>

/** Maintenance facts read from GitHub alongside the repo. "Waiting" counts only other people's work. */
export const UpkeepSchema = z.object({
  openIssues: z.number(),
  openPrs: z.number(),
  /** Open, non-draft PRs opened by someone else (from the 10 oldest). */
  waitingPrs: z.number(),
  oldestWaitingPrAt: z.string().nullable(),
  /** Issues opened by someone else with no comments yet (from the 10 newest). */
  unanswered: z.number(),
  oldestUnansweredAt: z.string().nullable(),
  watchers: z.number(),
})
export type Upkeep = z.infer<typeof UpkeepSchema>

export const OwnRepoSchema = RepoSchema.extend({
  upkeep: UpkeepSchema,
  /** Current stargazers by when they starred: [unix ms, cumulative count], ascending. Null until charted. */
  history: z.array(z.tuple([z.number(), z.number()])).nullable(),
  /** History is exact from this time on (individual star dates); before it, points are sampled. */
  exactSince: z.number().nullable(),
  /** Most recent stargazers, newest first. */
  recent: z.array(StargazerSchema),
  chartedAt: z.string().nullable(),
})
export type OwnRepo = z.infer<typeof OwnRepoSchema>

export const MineSchema = z.object({
  login: z.string(),
  repos: z.array(OwnRepoSchema),
  syncedAt: z.string().nullable(),
})
export type Mine = z.infer<typeof MineSchema>

export const ChartResultSchema = z.object({
  repos: z.array(OwnRepoSchema),
  failed: z.array(z.object({ repoId: z.string(), error: z.string() })),
})
export type ChartResult = z.infer<typeof ChartResultSchema>

export const AudienceSchema = z.object({
  /** How many recent stargazers were sampled. */
  sampled: z.number(),
  alsoStarred: z.array(z.object({ repo: RepoSchema, by: z.number(), youStarred: z.boolean() })),
})
export type Audience = z.infer<typeof AudienceSchema>

/* ---------- Request bodies ---------- */

const repoIds = z.array(z.string().min(1)).min(1).max(40)

export const SyncStepInput = z.object({
  runId: z.string().min(8).max(64),
  phase: z.enum(['stars', 'lists', 'finish']),
  cursor: z.string().nullable().default(null),
})

export const UpdateListsInput = z.object({
  repoIds,
  add: z.array(z.string()).default([]),
  remove: z.array(z.string()).default([]),
})
export type UpdateListsInput = z.infer<typeof UpdateListsInput>

export const RepoIdsInput = z.object({ repoIds })

export const CreateListInput = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  isPrivate: z.boolean().default(false),
})
export type CreateListInput = z.infer<typeof CreateListInput>

export const UpdateListInput = CreateListInput.partial()

export const ReviewInput = z.object({
  repoIds: z.array(z.string()).min(1).max(500),
  action: z.enum(['keep', 'snooze', 'clear']),
  days: z.number().int().min(1).max(730).optional(),
})
export type ReviewInput = z.infer<typeof ReviewInput>

export const ClassifyInput = z.object({
  scope: z.enum(['unlisted', 'unclassified', 'all']),
  /** Only used by scope "all": repos classified before this ISO time get redone. */
  before: z.string().optional(),
})
export type ClassifyInput = z.infer<typeof ClassifyInput>

export const TokenLoginInput = z.object({ token: z.string().trim().min(20).max(255) })

export const ChartInput = z.object({ repoIds: z.array(z.string().min(1)).min(1).max(3) })
