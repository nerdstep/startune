import { z } from "zod";
import {
  BulkResultSchema,
  ClassifyResultSchema,
  DiscoverSchema,
  LibrarySchema,
  ListSchema,
  MeSchema,
  SyncStepSchema,
  type BulkResult,
  type ClassifyInput,
  type ClassifyResult,
  type CreateListInput,
  type Discover,
  type Library,
  type Me,
  type ReviewInput,
  type StarList,
  type SyncStep,
  type UpdateListsInput,
} from "@shared/schemas";
import { createDemoBackend } from "./demo";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Backend {
  demo: boolean;
  me(): Promise<Me>;
  library(): Promise<Library>;
  sync(input: { runId: string; phase: "stars" | "lists" | "finish"; cursor: string | null }): Promise<SyncStep>;
  updateLists(input: UpdateListsInput): Promise<BulkResult>;
  unstar(repoIds: string[]): Promise<BulkResult>;
  star(repoIds: string[]): Promise<BulkResult>;
  review(input: ReviewInput): Promise<void>;
  createList(input: CreateListInput): Promise<StarList>;
  updateList(id: string, input: Partial<CreateListInput>): Promise<StarList>;
  deleteList(id: string): Promise<void>;
  classify(input: ClassifyInput): Promise<ClassifyResult>;
  discover(): Promise<Discover>;
  tokenLogin(token: string): Promise<void>;
  logout(): Promise<void>;
  exportBackup(): Promise<void>;
}

async function call<S extends z.ZodType>(path: string, schema: S, init?: RequestInit): Promise<z.infer<S>> {
  const res = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`);
  }
  return schema.parse(await res.json());
}

const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });
const Ok = z.object({ ok: z.boolean() }).passthrough();

const remote: Backend = {
  demo: false,
  me: () => call("/api/me", MeSchema),
  library: () => call("/api/library", LibrarySchema),
  sync: (input) => call("/api/sync", SyncStepSchema, post(input)),
  updateLists: (input) => call("/api/stars/lists", BulkResultSchema, post(input)),
  unstar: (repoIds) => call("/api/stars/unstar", BulkResultSchema, post({ repoIds })),
  star: (repoIds) => call("/api/stars/star", BulkResultSchema, post({ repoIds })),
  review: async (input) => void (await call("/api/stars/review", Ok, post(input))),
  createList: (input) => call("/api/lists", ListSchema, post(input)),
  updateList: (id, input) => call(`/api/lists/${encodeURIComponent(id)}`, ListSchema, { method: "PATCH", body: JSON.stringify(input) }),
  deleteList: async (id) => void (await call(`/api/lists/${encodeURIComponent(id)}`, Ok, { method: "DELETE" })),
  classify: (input) => call("/api/ai/classify", ClassifyResultSchema, post(input)),
  discover: () => call("/api/discover", DiscoverSchema),
  tokenLogin: async (token) => void (await call("/auth/token", Ok, post({ token }))),
  logout: async () => void (await call("/auth/logout", Ok, { method: "POST" })),
  exportBackup: async () => {
    window.location.href = "/api/export";
  },
};

const DEMO_KEY = "startune:demo";

export function isDemo(): boolean {
  if (typeof window === "undefined") return false;
  const url = new URL(window.location.href);
  if (url.searchParams.get("demo") === "1") localStorage.setItem(DEMO_KEY, "1");
  if (url.searchParams.get("demo") === "0") localStorage.removeItem(DEMO_KEY);
  return localStorage.getItem(DEMO_KEY) === "1";
}

export function setDemo(on: boolean) {
  if (on) localStorage.setItem(DEMO_KEY, "1");
  else localStorage.removeItem(DEMO_KEY);
  sessionStorage.removeItem("startune:demo-state");
  window.location.assign("/");
}

export const backend: Backend = isDemo() ? createDemoBackend() : remote;
