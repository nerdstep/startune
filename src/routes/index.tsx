import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRightIcon, BrainCircuitIcon, FlameIcon, LayersIcon, ShuffleIcon, SparklesIcon, StarIcon, TelescopeIcon, TriangleAlertIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { GrowthBadge, PageHeader, SectionTitle } from "@/components/bits";
import { HealthBar, YearChart } from "@/components/charts";
import { RepoTile, useOpenRepo } from "@/components/repo";
import { SyncButton } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useDerived, type EStar } from "@/lib/queries";
import { useSyncContext } from "@/lib/sync-context";
import { ago, cn, fmtNum } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Overview });

function Overview() {
  const { data, isLoading } = useDerived();
  const navigate = useNavigate();
  const open = useOpenRepo();
  const [shuffle, setShuffle] = useState(0);

  const stats = useMemo(() => {
    if (!data) return null;
    const s = data.stars;
    const listed = s.filter((x) => x.listIds.length > 0).length;
    const cruft = s.filter((x) => x.isCruft).length;
    const growing = s.filter((x) => (x.g.d7 ?? 0) > 0).length;
    const oldest = s.reduce((a, b) => (a && a.starredAt < b.starredAt ? a : b), s[0] as EStar | undefined);
    return { total: s.length, listed, unlisted: s.length - listed, cruft, growing, oldest };
  }, [data]);

  const gems = useMemo(() => {
    if (!data) return [];
    const pool = data.stars.filter((s) => s.rediscover > 0 && !s.snoozed).sort((a, b) => b.rediscover - a.rediscover).slice(0, 36);
    // Rotate through the pool on shuffle
    const start = (shuffle * 6) % Math.max(pool.length, 1);
    return [...pool.slice(start), ...pool.slice(0, start)].slice(0, 6);
  }, [data, shuffle]);

  const hot = useMemo(() => {
    if (!data) return [];
    const key = (s: EStar) => (data.hasHistory ? (s.g.d7 ?? 0) : s.momentum);
    return [...data.stars].filter((s) => !s.isArchived).sort((a, b) => key(b) - key(a)).slice(0, 5);
  }, [data]);

  if (isLoading || !data || !stats) return <OverviewSkeleton />;
  if (stats.total === 0) return <FirstRun />;

  const listedPct = Math.round((stats.listed / stats.total) * 100);

  return (
    <>
      <PageHeader
        title="Your constellation"
        sub={
          <>
            {stats.total.toLocaleString()} stars since {stats.oldest ? new Date(stats.oldest.starredAt).getFullYear() : "—"} · synced {ago(data.library.lastSyncedAt)}
          </>
        }
      >
        <Button variant="magenta" nativeButton={false} render={<Link to="/triage" search={{ mode: "cruft" }} />}>
          <SparklesIcon /> Start triage
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={StarIcon} label="Stars" value={fmtNum(stats.total)} accent="cyan" to="/stars" />
        <Stat
          icon={LayersIcon}
          label="In lists"
          value={`${listedPct}%`}
          sub={`${stats.unlisted.toLocaleString()} unlisted`}
          accent="violet"
          to="/stars"
          search={{ list: "none" }}
          meter={listedPct}
        />
        <Stat icon={TriangleAlertIcon} label="Likely cruft" value={fmtNum(stats.cruft)} sub="archived, stale or deprecated" accent="amber" to="/triage" search={{ mode: "cruft" }} />
        <Stat
          icon={FlameIcon}
          label={data.hasHistory ? "Growing this week" : "Growing"}
          value={data.hasHistory ? fmtNum(stats.growing) : "—"}
          sub={data.hasHistory ? "gained stars in 7 days" : "needs a few days of history"}
          accent="magenta"
          to="/trending"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div>
              <CardTitle>Starring history</CardTitle>
              <CardDescription>Stars added per year, colored by how alive each repo is today</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <YearChart stars={data.stars} onPick={(year) => void navigate({ to: "/stars", search: { year } })} />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Health of your stars</CardTitle>
              <CardDescription>Based on last push and archive status</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-5">
            <HealthBar stars={data.stars} onPick={(health) => void navigate({ to: "/stars", search: { health } })} />
            <AiCallout />
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <SectionTitle
          hint="Starred long ago, still alive, never revisited"
          right={
            <Button size="sm" variant="ghost" onClick={() => setShuffle((n) => n + 1)}>
              <ShuffleIcon /> Shuffle
            </Button>
          }
        >
          <TelescopeIcon className="mr-2 inline size-4 text-neon-violet" />
          Forgotten gems
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gems.map((s) => (
            <RepoTile
              key={s.id}
              s={s}
              onClick={() => open(s.id)}
              footer={<div className="text-[11px] tracking-wide text-neon-violet uppercase">Starred {ago(s.starredAt)}</div>}
            />
          ))}
        </div>
        <div className="mt-3 text-right">
          <Link to="/triage" search={{ mode: "rediscover" }} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            Rediscover them one by one <ArrowRightIcon className="size-4" />
          </Link>
        </div>
      </section>

      <section className="mt-8">
        <SectionTitle hint={data.hasHistory ? "Most new stars in the last 7 days" : "Fastest-growing since creation (history builds daily)"}>
          <FlameIcon className="mr-2 inline size-4 text-neon-magenta" />
          Hot in your stars
        </SectionTitle>
        <Card spotlight={false} className="gap-0 py-2">
          {hot.map((s, i) => (
            <button key={s.id} onClick={() => open(s.id)} className="flex items-center gap-4 px-5 py-2.5 text-left transition hover:bg-white/[0.03]">
              <span className="w-5 font-mono text-sm text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="text-muted-foreground">{s.owner}/</span>
                <span className="font-medium">{s.name}</span>
              </span>
              {data.hasHistory ? (
                <GrowthBadge d={s.g.d7} estimated={s.g.estimated} />
              ) : (
                <span className="font-mono text-xs text-neon-magenta">{s.momentum.toFixed(1)}★/day</span>
              )}
              <span className="hidden w-16 text-right font-mono text-xs text-muted-foreground sm:block">{fmtNum(s.stars)}★</span>
            </button>
          ))}
        </Card>
      </section>
    </>
  );
}

const ACCENT = {
  cyan: "text-neon-cyan",
  violet: "text-neon-violet",
  amber: "text-neon-amber",
  magenta: "text-neon-magenta",
};

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  to,
  search,
  meter,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  accent: keyof typeof ACCENT;
  to: "/stars" | "/triage" | "/trending";
  search?: Record<string, string>;
  meter?: number;
}) {
  return (
    <Link to={to} search={search as never} className="block">
      <Card className="h-full gap-2 px-4 py-4 transition hover:-translate-y-0.5">
        <div className="flex items-center gap-2 text-xs tracking-wider text-muted-foreground uppercase">
          <Icon className={cn("size-4", ACCENT[accent])} /> {label}
        </div>
        <div className={cn("text-glow font-mono text-3xl font-semibold tracking-tight", ACCENT[accent])}>{value}</div>
        {meter != null && <Progress value={meter} />}
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </Card>
    </Link>
  );
}

function AiCallout() {
  const { data } = useDerived();
  const { classify } = useSyncContext();
  if (!data) return null;
  const unlisted = data.stars.filter((s) => s.listIds.length === 0);
  const pending = unlisted.filter((s) => !s.suggestion).length;
  const suggested = unlisted.filter((s) => s.suggestion?.listId).length;
  return (
    <div className="mt-auto rounded-xl border border-neon-violet/30 bg-gradient-to-br from-neon-violet/10 to-neon-magenta/5 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-neon-violet">
        <BrainCircuitIcon className="size-4" /> Clef suggestions
      </div>
      {classify.progress.running ? (
        <div className="mt-3 space-y-2">
          <Progress value={classify.progress.pct} />
          <p className="text-xs text-muted-foreground">{classify.progress.label}</p>
        </div>
      ) : pending > 0 ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Let Cloudflare's Clef model suggest a list and a cruft score for your {pending.toLocaleString()} unlisted repos.
          </p>
          <Button size="sm" className="mt-3" variant="outline" onClick={() => void classify.run("unlisted")} disabled={data.lists.length === 0}>
            <SparklesIcon /> {data.lists.length === 0 ? "Create a list first" : "Suggest lists"}
          </Button>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">{suggested.toLocaleString()} unlisted repos have a suggested list.</p>
          <Button size="sm" className="mt-3" variant="outline" nativeButton={false} render={<Link to="/triage" search={{ mode: "unlisted" }} />}>
            Review suggestions <ArrowRightIcon />
          </Button>
        </>
      )}
    </div>
  );
}

function FirstRun() {
  const { sync } = useSyncContext();
  return (
    <div className="grid min-h-[60dvh] place-items-center text-center">
      <div className="max-w-md">
        <div className="relative mx-auto mb-8 size-24">
          <span className="absolute inset-0 animate-[pulse-ring_2.4s_ease-out_infinite] rounded-full border border-primary/60" />
          <span className="absolute inset-0 animate-[pulse-ring_2.4s_ease-out_1.2s_infinite] rounded-full border border-neon-magenta/60" />
          <div className="glow-cyan grid size-24 place-items-center rounded-full bg-primary/10">
            <StarIcon className="size-10 text-primary" />
          </div>
        </div>
        <h1 className="neon-text text-3xl font-bold">Pull in your stars</h1>
        <p className="mt-2 text-muted-foreground">StarTune reads your stars and Lists from GitHub. A few thousand stars take under a minute.</p>
        <div className="mt-6 flex justify-center">{sync.progress.running ? <p className="text-sm text-primary">{sync.progress.label}</p> : <SyncButton />}</div>
      </div>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
