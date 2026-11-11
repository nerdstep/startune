import { Link, useRouterState } from "@tanstack/react-router";
import { useId } from "react";
import {
  FlameIcon,
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
] as const;

const MOBILE = ["/", "/stars", "/triage", "/trending", "/lists"];

export function Logo({ className }: { className?: string }) {
  // Unique gradient id: a hidden copy of the logo would otherwise own "#lg".
  const gid = useId();
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative grid size-8 place-items-center">
        <span className="absolute inset-0 rounded-full bg-neon-cyan/30 blur-md" />
        <svg viewBox="0 0 32 32" className="relative size-8 drop-shadow-[0_0_6px_var(--neon-cyan)]">
          <defs>
            <linearGradient id={gid} x1="0" x2="1" y1="0" y2="1">
              <stop offset="0" stopColor="var(--neon-cyan)" />
              <stop offset="1" stopColor="var(--neon-magenta)" />
            </linearGradient>
          </defs>
          <path d="M16 3l3.4 8.2 8.6.7-6.6 5.6 2 8.5L16 21.4 8.6 26l2-8.5L4 11.9l8.6-.7z" fill="none" stroke={`url(#${gid})`} strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9 16.5c2.3-2 4.6 2 7 0s4.7 2 7 0" fill="none" stroke={`url(#${gid})`} strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <span className="text-lg font-bold tracking-tight">
        Star<span className="neon-text">Tune</span>
      </span>
    </div>
  );
}

export function SyncBar({ progress }: { progress: P }) {
  if (!progress.running) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-50">
      <Progress value={progress.pct} className="h-0.5 rounded-none" />
      <div className="mx-auto mt-2 w-fit rounded-full border border-primary/30 bg-popover px-3 py-1 text-xs text-primary shadow-[0_0_24px_-8px_var(--neon-cyan)] backdrop-blur-xl">
        {progress.label}
      </div>
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
      <DropdownMenuTrigger asChild>
        <button className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <RepoAvatar owner={u.login} src={u.avatarUrl} className="size-8 rounded-full" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          {u.name ?? u.login}
          <div className="font-normal">@{u.login}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/map">
            <OrbitIcon /> Star map
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <SettingsIcon /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
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
  return (
    <div className="min-h-dvh md:pl-60">
      <SyncBar progress={sync.progress} />
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-background/40 p-4 backdrop-blur-xl md:flex">
        <Logo className="mb-8 px-2 pt-1" />
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-all hover:bg-white/[0.04] hover:text-foreground",
                active(n.to) &&
                  "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_oklch(0.86_0.15_195/30%),0_0_24px_-10px_var(--neon-cyan)] before:absolute before:top-2 before:bottom-2 before:-left-4 before:w-0.5 before:rounded-full before:bg-primary before:shadow-[0_0_10px_var(--neon-cyan)]",
              )}
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          {backend.demo && (
            <div className="rounded-xl border border-neon-magenta/30 bg-neon-magenta/10 p-3 text-xs text-neon-magenta">
              Demo mode — sample data, nothing touches GitHub.
            </div>
          )}
          <Link
            to="/settings"
            className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:text-foreground", active("/settings") && "text-primary")}
          >
            <SettingsIcon className="size-4" /> Settings
          </Link>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/50 px-4 backdrop-blur-xl md:px-8">
        <Logo className="md:hidden" />
        <div className="hidden text-xs text-muted-foreground md:block">
          {backend.demo ? <span className="text-neon-magenta">● Demo data</span> : <span className="text-neon-lime">● Connected to GitHub</span>}
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

      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 md:px-8 md:pb-12">{children}</main>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-3 bottom-3 z-30 flex justify-around rounded-2xl border border-border bg-background/70 p-1.5 shadow-[0_10px_40px_-10px_black] backdrop-blur-xl md:hidden">
        {NAV.filter((n) => MOBILE.includes(n.to)).map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10px] text-muted-foreground",
              active(n.to) && "bg-primary/10 text-primary [&_svg]:drop-shadow-[0_0_6px_var(--neon-cyan)]",
            )}
          >
            <n.icon className="size-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
