import { z } from "zod";

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
});
export type Repo = z.infer<typeof RepoSchema>;

export const SuggestionSchema = z.object({
  listId: z.string().nullable(),
  listConfidence: z.number(),
  cruft: z.number(),
  model: z.string(),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;

/** Star history points used to compute growth. */
export const GrowthBasisSchema = z.object({
  base7: z.number().nullable(),
  base30: z.number().nullable(),
  earliestDay: z.string().nullable(),
  earliestStars: z.number().nullable(),
});
export type GrowthBasis = z.infer<typeof GrowthBasisSchema>;

export const StarSchema = RepoSchema.extend({
  starredAt: z.string(),
  reviewedAt: z.string().nullable(),
  snoozedUntil: z.string().nullable(),
  listIds: z.array(z.string()),
  suggestion: SuggestionSchema.nullable(),
  growth: GrowthBasisSchema,
});
export type Star = z.infer<typeof StarSchema>;

export const ListSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  isPrivate: z.boolean(),
});
export type StarList = z.infer<typeof ListSchema>;

export const UnstarredSchema = z.object({
  repoId: z.string(),
  fullName: z.string(),
  unstarredAt: z.string(),
});
export type Unstarred = z.infer<typeof UnstarredSchema>;

export const LibrarySchema = z.object({
  stars: z.array(StarSchema),
  lists: z.array(ListSchema),
  recentlyUnstarred: z.array(UnstarredSchema),
  lastSyncedAt: z.string().nullable(),
  today: z.string(),
});
export type Library = z.infer<typeof LibrarySchema>;

export const MeSchema = z.object({
  user: z
    .object({ login: z.string(), name: z.string().nullable(), avatarUrl: z.string().nullable() })
    .nullable(),
  oauthEnabled: z.boolean(),
  aiModel: z.string(),
});
export type Me = z.infer<typeof MeSchema>;

export const SyncStepSchema = z.object({
  phase: z.enum(["stars", "lists", "done"]),
  cursor: z.string().nullable(),
  processed: z.number(),
  total: z.number(),
});
export type SyncStep = z.infer<typeof SyncStepSchema>;

export const ClassifyResultSchema = z.object({
  processed: z.number(),
  remaining: z.number(),
});
export type ClassifyResult = z.infer<typeof ClassifyResultSchema>;

export const DiscoverSchema = z.object({
  groups: z.array(z.object({ topic: z.string(), repos: z.array(RepoSchema) })),
});
export type Discover = z.infer<typeof DiscoverSchema>;

export const BulkResultSchema = z.object({
  ok: z.array(z.string()),
  failed: z.array(z.object({ repoId: z.string(), error: z.string() })),
});
export type BulkResult = z.infer<typeof BulkResultSchema>;

/* ---------- Request bodies ---------- */

const repoIds = z.array(z.string().min(1)).min(1).max(40);

export const SyncStepInput = z.object({
  runId: z.string().min(8).max(64),
  phase: z.enum(["stars", "lists", "finish"]),
  cursor: z.string().nullable().default(null),
});

export const UpdateListsInput = z.object({
  repoIds,
  add: z.array(z.string()).default([]),
  remove: z.array(z.string()).default([]),
});
export type UpdateListsInput = z.infer<typeof UpdateListsInput>;

export const RepoIdsInput = z.object({ repoIds });

export const CreateListInput = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  isPrivate: z.boolean().default(false),
});
export type CreateListInput = z.infer<typeof CreateListInput>;

export const UpdateListInput = CreateListInput.partial();

export const ReviewInput = z.object({
  repoIds: z.array(z.string()).min(1).max(500),
  action: z.enum(["keep", "snooze", "clear"]),
  days: z.number().int().min(1).max(730).optional(),
});
export type ReviewInput = z.infer<typeof ReviewInput>;

export const ClassifyInput = z.object({
  scope: z.enum(["unlisted", "unclassified", "all"]),
  /** Only used by scope "all": repos classified before this ISO time get redone. */
  before: z.string().optional(),
});
export type ClassifyInput = z.infer<typeof ClassifyInput>;

export const TokenLoginInput = z.object({ token: z.string().trim().min(20).max(255) });
