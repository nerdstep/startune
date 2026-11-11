import { createFileRoute } from "@tanstack/react-router";
import { FlameIcon, PackageIcon, RefreshCwIcon, StarIcon, TelescopeIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { GrowthBadge, PageHeader } from "@/components/bits";
import { RepoTile, useOpenRepo } from "@/components/repo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDerived, useDiscover, useStar, type EStar } from "@/lib/queries";
import { ago, cn, fmtNum, fmtPct } from "@/lib/utils";

const Tab = z.enum(["rising", "releases", "discover"]);
type Tab = z.infer<typeof Tab>;

export const Route = createFileRoute("/trending")({
  validateSearch: z.object({ tab: Tab.optional().catch(undefined) }),
  component: Trending,
});

function Trending() {
  const { tab = "rising" } = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <>
      <PageHeader title="Trending" sub="What's moving in your stars, and what's new in the topics you care about." />
      <Tabs value={tab} onValueChange={(v) => void navigate({ search: { tab: v as Tab } })}>
        <TabsList>
          <TabsTrigger value="rising">
            <FlameIcon /> Rising
          </TabsTrigger>
          <TabsTrigger value="releases">
            <PackageIcon /> Fresh releases
          </TabsTrigger>
          <TabsTrigger value="discover">
            <TelescopeIcon /> Discover
          </TabsTrigger>
        </TabsList>
        <TabsContent value="rising">
          <Rising />
        </TabsContent>
        <TabsContent value="releases">
          <Releases />
        </TabsContent>
        <TabsContent value="discover">
          <DiscoverTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Rising() {
  const { data, isLoading } = useDerived();
  const open = useOpenRepo();
  const [window, setWindow] = useState<"d7" | "d30">("d7");
  const [relative, setRelative] = useState(false);

  const rows = useMemo(() => {
    if (!data) return [];
    const val = (s: EStar) => {
      if (!data.hasHistory) return s.momentum;
      const d = s.g[window] ?? 0;
      if (!relative) return d;
      const base = s.stars - d;
      return base > 50 ? d / base : 0;
    };
    return data.stars
      .filter((s) => !s.isArchived)
      .map((s) => ({ s, v: val(s) }))
      .filter((r) => r.v > 0)
      .sort((a, b) => b.v - a.v)
      .slice(0, 40);
  }, [data, window, relative]);

  if (isLoading || !data) return <Skeleton className="h-96" />;
  const max = rows[0]?.v ?? 1;

  return (
    <div className="space-y-3">
      {!data.hasHistory && (
        <div className="rounded-xl border border-neon-amber/30 bg-neon-amber/5 p-3 text-sm text-muted-foreground">
          StarTune records star counts every day. Until it has a week of history, this ranks by average stars per day since each repo was created.
        </div>
      )}
      {data.hasHistory && (
        <div className="flex flex-wrap gap-2">
          <Tabs value={window} onValueChange={(v) => setWindow(v as "d7" | "d30")}>
            <TabsList className="h-9">
              <TabsTrigger value="d7">7 days</TabsTrigger>
              <TabsTrigger value="d30">30 days</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs value={relative ? "pct" : "abs"} onValueChange={(v) => setRelative(v === "pct")}>
            <TabsList className="h-9">
              <TabsTrigger value="abs">New stars</TabsTrigger>
              <TabsTrigger value="pct">% growth</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}
      <Card spotlight={false} className="gap-0 py-2">
        {rows.map(({ s, v }, i) => (
          <button key={s.id} onClick={() => open(s.id)} className="group grid grid-cols-[2rem_1fr_auto] items-center gap-3 px-4 py-2.5 text-left transition hover:bg-white/[0.03] md:grid-cols-[2rem_1fr_14rem_5rem]">
            <span className={cn("font-mono text-sm", i < 3 ? "text-glow text-neon-magenta" : "text-muted-foreground")}>{i + 1}</span>
            <span className="min-w-0">
              <span className="block truncate">
                <span className="text-muted-foreground">{s.owner}/</span>
                <span className="font-medium group-hover:text-primary">{s.name}</span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">{s.description}</span>
            </span>
            {/* magnitude bar, value labeled */}
            <span className="hidden items-center gap-2 md:flex">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
                <span
                  className="block h-full rounded-full bg-neon-magenta shadow-[0_0_10px_var(--neon-magenta)]"
                  style={{ width: `${Math.max(3, (v / max) * 100)}%` }}
                />
              </span>
            </span>
            <span className="text-right font-mono text-sm">
              {!data.hasHistory ? (
                <span className="text-neon-magenta">{v.toFixed(1)}/day</span>
              ) : relative ? (
                <span className="text-neon-magenta">{fmtPct(v)}</span>
              ) : (
                <GrowthBadge d={v} estimated={s.g.estimated} label={window === "d7" ? "7d" : "30d"} />
              )}
            </span>
          </button>
        ))}
        {rows.length === 0 && <p className="p-6 text-center text-muted-foreground">Nothing is growing yet.</p>}
      </Card>
    </div>
  );
}

function Releases() {
  const { data, isLoading } = useDerived();
  const open = useOpenRepo();
  const rows = useMemo(
    () =>
      (data?.stars ?? [])
        .filter((s) => s.latestReleaseAt && Date.now() - new Date(s.latestReleaseAt).getTime() < 45 * 86_400_000)
        .sort((a, b) => b.latestReleaseAt!.localeCompare(a.latestReleaseAt!)),
    [data],
  );
  if (isLoading) return <Skeleton className="h-96" />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((s) => (
        <RepoTile
          key={s.id}
          s={s}
          onClick={() => open(s.id)}
          footer={
            <div className="flex items-center gap-2">
              <Badge variant="lime" className="font-mono">
                <PackageIcon /> {s.latestReleaseTag}
              </Badge>
              <span className="text-xs text-muted-foreground">{ago(s.latestReleaseAt)}</span>
            </div>
          }
        />
      ))}
      {rows.length === 0 && <p className="text-muted-foreground">No releases in the last 45 days.</p>}
    </div>
  );
}

function DiscoverTab() {
  const q = useDiscover();
  const star = useStar();
  const [starred, setStarred] = useState<Set<string>>(new Set());
  if (q.isLoading)
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );
  if (q.error)
    return (
      <div className="glass rounded-2xl p-6 text-center text-muted-foreground">
        Couldn't search GitHub right now.{" "}
        <Button variant="link" onClick={() => void q.refetch()}>
          <RefreshCwIcon /> Retry
        </Button>
      </div>
    );
  const groups = q.data?.groups ?? [];
  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">New repos (last 4 months, 50+ stars) in your most-starred topics, skipping ones you already starred.</p>
      {groups.map((g) => (
        <section key={g.topic}>
          <h3 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold tracking-[0.18em] uppercase">
            <span className="size-1.5 rounded-full bg-neon-cyan shadow-[0_0_8px_var(--neon-cyan)]" />
            {g.topic}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.repos.map((r) => (
              <RepoTile
                key={r.id}
                s={r}
                onClick={() => window.open(r.url, "_blank", "noopener")}
                footer={
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">created {ago(r.createdAt)}</span>
                    <Button
                      size="sm"
                      variant={starred.has(r.id) ? "outline" : "default"}
                      disabled={starred.has(r.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        star.mutate([r.id]);
                        setStarred((s) => new Set(s).add(r.id));
                      }}
                    >
                      <StarIcon /> {starred.has(r.id) ? "Starred" : `Star · ${fmtNum(r.stars)}`}
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
        </section>
      ))}
      {groups.length === 0 && <p className="text-muted-foreground">Add topics to your stars (sync first) to get recommendations.</p>}
    </div>
  );
}
