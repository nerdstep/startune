import { Link, useRouterState } from "@tanstack/react-router";
import {
  FlameIcon,
  FolderGit2Icon,
  GaugeIcon,
  LayersIcon,
  LogOutIcon,
  OrbitIcon,
  RefreshCwIcon,
  SettingsIcon,
  SparklesIcon,
  StarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { backend, setDemo } from "@/lib/api";
import { useDerived, useMe, type Progress as P } from "@/lib/queries";
import { useSyncContext } from "@/lib/sync-context";
import { ago, cn } from "@/lib/utils";
import { RepoAvatar } from "./bits";

const NAV = [
  { to: "/", label: "Overview", icon: GaugeIcon },
  { to: "/stars", label: "Stars", icon: StarIcon },
  { to: "/triage", label: "Triage", icon: SparklesIcon },
  { to: "/map", label: "Star map", icon: OrbitIcon },
  { to: "/trending", label: "Trending", icon: FlameIcon },
  { to: "/lists", label: "Lists", icon: LayersIcon },
  { to: "/mine", label: "Your repos", icon: FolderGit2Icon },
] as const;

const MOBILE = ["/", "/stars", "/triage", "/trending", "/lists"];

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg viewBox="0 0 32 32" aria-hidden className="size-6">
        <path d="M16 3l3.4 8.2 8.6.7-6.6 5.6 2 8.5L16 21.4 8.6 26l2-8.5L4 11.9l8.6-.7z" fill="var(--primary)" />
        <path d="M10 16.5c2-1.7 4 1.7 6 0s4 1.7 6 0" fill="none" stroke="var(--background)" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight">StarTune</span>
    </div>
  );
}

export function SyncBar({ progress }: { progress: P }) {
  if (!progress.running) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50" role="status">
      <Progress value={progress.pct} thin />
      <div className="mx-auto mt-2 w-fit rounded-full border bg-popover px-3 py-1 text-xs text-foreground tabular-nums shadow-lg shadow-black/40">{progress.label}</div>
    </div>
  );
}

export function SyncButton({ compact }: { compact?: boolean }) {
  const { sync } = useSyncContext();
  const { data } = useDerived();
  return (
    <Button variant="outline" size={compact ? "icon-sm" : "sm"} onClick={() => void sync.run()} disabled={sync.progress.running} aria-label="Sync with GitHub">
      <RefreshCwIcon className={cn(sync.progress.running && "animate-spin")} />
      {!compact && (sync.progress.running ? "Syncing…" : `Synced ${ago(data?.library.lastSyncedAt)}`)}
    </Button>
  );
}

function UserMenu() {
  const me = useMe();
  const u = me.data?.user;
  if (!u) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background" aria-label="Account menu">
        <RepoAvatar owner={u.login} src={u.avatarUrl} className="size-7 rounded-full" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          {u.name ?? u.login}
          <div className="font-normal text-muted-foreground">@{u.login}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLinkItem render={<Link to="/map" />}>
          <OrbitIcon /> Star map
        </DropdownMenuLinkItem>
        <DropdownMenuLinkItem render={<Link to="/mine" />}>
          <FolderGit2Icon /> Your repos
        </DropdownMenuLinkItem>
        <DropdownMenuLinkItem render={<Link to="/settings" />}>
          <SettingsIcon /> Settings
        </DropdownMenuLinkItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            if (backend.demo) return setDemo(false);
            await backend.logout();
            window.location.assign("/");
          }}
        >
          <LogOutIcon /> {backend.demo ? "Leave demo" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { sync } = useSyncContext();
  const active = (to: string) => (to === "/" ? path === "/" : path.startsWith(to));
  const item = (on: boolean) =>
    cn(
      "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-100",
      on ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
    );
  return (
    <div className="min-h-dvh md:pl-56">
      <SyncBar progress={sync.progress} />
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r bg-background px-3 pb-3 md:flex">
        <Logo className="h-14 px-2.5" />
        <nav className="mt-2 flex flex-col gap-0.5" aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={item(active(n.to))} aria-current={active(n.to) ? "page" : undefined}>
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          {backend.demo && (
            <div className="rounded-lg border px-3 py-2.5 text-xs text-muted-foreground">
              <div className="mb-0.5 flex items-center gap-1.5 font-medium text-foreground">
                <span className="size-1.5 rounded-full bg-warning" /> Demo mode
              </div>
              Sample data. Nothing touches GitHub.
            </div>
          )}
          <Link to="/settings" className={item(active("/settings"))}>
            <SettingsIcon className="size-4" /> Settings
          </Link>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur-sm md:px-8">
        <Logo className="md:hidden" />
        <div className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex">
          <span className={cn("size-1.5 rounded-full", backend.demo ? "bg-warning" : "bg-primary")} />
          {backend.demo ? "Demo data" : "Connected to GitHub"}
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <SyncButton />
          </div>
          <div className="sm:hidden">
            <SyncButton compact />
          </div>
          <UserMenu />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pt-8 pb-28 md:px-8 md:pb-16">{children}</main>

      {/* Mobile tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t bg-background/95 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur-sm md:hidden"
        aria-label="Main"
      >
        {NAV.filter((n) => MOBILE.includes(n.to)).map((n) => (
          <Link
            key={n.to}
            to={n.to}
            aria-current={active(n.to) ? "page" : undefined}
            className={cn("flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-[11px] text-muted-foreground", active(n.to) && "text-foreground")}
          >
            <n.icon className="size-5" strokeWidth={active(n.to) ? 2.25 : 1.75} />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
