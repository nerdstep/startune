import { createContext, useContext } from "react";
import { useClassify, useSync } from "./queries";

type Ctx = { sync: ReturnType<typeof useSync>; classify: ReturnType<typeof useClassify> };
const SyncCtx = createContext<Ctx | null>(null);

/** Keeps sync / AI progress alive while you move between pages. */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const sync = useSync();
  const classify = useClassify();
  return <SyncCtx.Provider value={{ sync, classify }}>{children}</SyncCtx.Provider>;
}

export function useSyncContext(): Ctx {
  const c = useContext(SyncCtx);
  if (!c) throw new Error("SyncProvider missing");
  return c;
}
