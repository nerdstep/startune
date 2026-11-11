import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  BrainCircuitIcon,
  RocketIcon,
  CheckIcon,
  ClockIcon,
  ExternalLinkIcon,
  GitForkIcon,
  ListPlusIcon,
  PartyPopperIcon,
  SkipForwardIcon,
  StarIcon,
  StarOffIcon,
  TelescopeIcon,
  TriangleAlertIcon,
  UndoIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { GrowthBadge, HealthBadge, LangDot, PageHeader, RepoAvatar } from "@/components/bits";
import { ListPicker } from "@/components/list-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDerived, useReview, useUnstar, useUpdateLists, type Derived, type EStar } from "@/lib/queries";
import { useSyncContext } from "@/lib/sync-context";
import { ago, cn, fmtNum } from "@/lib/utils";

const Mode = z.enum(["cruft", "unlisted", "rediscover"]);
type Mode = z.infer<typeof Mode>;

export const Route = createFileRoute("/triage")({
  validateSearch: z.object({ mode: Mode.optional().catch(undefined) }),
  component: Triage,
});

const MODES: Record<Mode, { label: string; icon: typeof StarIcon; hint: string }> = {
  cruft: { label: "Cruft", icon: TriangleAlertIcon, hint: "Archived, abandoned or deprecated repos. Keep or let go." },
  unlisted: { label: "Unlisted", icon: ListPlusIcon, hint: "Give every star a home. Clef's pick is one key away." },
  rediscover: { label: "Rediscover", icon: TelescopeIcon, hint: "Old stars that are still alive. Remember why you starred them?" },
};

function buildQueue(d: Derived, mode: Mode): string[] {
  const open = d.stars.filter((s) => !s.snoozed);
  if (mode === "cruft")
    return open
      .filter((s) => s.isCruft && !s.reviewedAt)
      .sort((a, b) => b.cruft - a.cruft)
      .map((s) => s.id);
  if (mode === "unlisted")
    return open
      .filter((s) => s.listIds.length === 0 && !s.reviewedAt)
      .sort((a, b) => (b.suggestion?.listId ? b.suggestion.listConfidence : -1) - (a.suggestion?.listId ? a.suggestion.listConfidence : -1) || b.starredAt.localeCompare(a.starredAt))
      .map((s) => s.id);
  return open
    .filter((s) => s.rediscover > 0)
    .sort((a, b) => b.rediscover - a.rediscover)
    .map((s) => s.id);
}

type Tally = { kept: number; unstarred: number; listed: number; skipped: number };

function Triage() {
  const { mode = "cruft" } = Route.useSearch();
  const navigate = useNavigate({ from: "/triage" });
  const { data, isLoading } = useDerived();
  const [queue, setQueue] = useState<{ mode: Mode; ids: string[] } | null>(null);
  const [i, setI] = useState(0);
  const [tally, setTally] = useState<Tally>({ kept: 0, unstarred: 0, listed: 0, skipped: 0 });
  const unstar = useUnstar();
  const review = useReview();
  const update = useUpdateLists();

  // Snapshot the queue when the mode changes so cards don't reshuffle as you act.
  useEffect(() => {
    if (data && queue?.mode !== mode) {
      setQueue({ mode, ids: buildQueue(data, mode) });
      setI(0);
    }
  }, [data, mode, queue?.mode]);

  const current: EStar | undefined = useMemo(() => {
    if (!data || !queue) return undefined;
    return data.byId.get(queue.ids[i] ?? "");
  }, [data, queue, i]);

  // Rebuild once Clef finishes so its picks float to the top
  const { classify } = useSyncContext();
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !classify.progress.running) setQueue(null);
    wasRunning.current = classify.progress.running;
  }, [classify.progress.running]);

  // Skip over repos unstarred elsewhere
  useEffect(() => {
    if (data && queue && i < queue.ids.length && !data.byId.get(queue.ids[i]!) && !unstar.isPending) setI((n) => n + 1);
  }, [data, queue, i, unstar.isPending]);

  const suggested = current?.suggestion?.listId && !current.listIds.includes(current.suggestion.listId) ? data?.listsById.get(current.suggestion.listId) : undefined;

  const next = useCallback((k: keyof Tally) => {
    setTally((t) => ({ ...t, [k]: t[k] + 1 }));
    setI((n) => n + 1);
  }, []);

  const act = useCallback(
    (a: "keep" | "unstar" | "skip" | "snooze" | "accept" | "back") => {
      if (a === "back") return setI((n) => Math.max(0, n - 1));
      if (!current) return;
      if (a === "keep") {
        review.mutate({ repoIds: [current.id], action: "keep" });
        next("kept");
      } else if (a === "unstar") {
        unstar.mutate([current.id]);
        next("unstarred");
      } else if (a === "snooze") {
        review.mutate({ repoIds: [current.id], action: "snooze", days: 90 });
        next("skipped");
      } else if (a === "accept" && suggested) {
        update.mutate({ repoIds: [current.id], add: [suggested.id] });
        review.mutate({ repoIds: [current.id], action: "keep" });
        next("listed");
      } else if (a === "skip") next("skipped");
    },
    [current, next, review, suggested, unstar, update],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || document.querySelector("[role=dialog]")) return;
      const map: Record<string, Parameters<typeof act>[0]> = {
        ArrowRight: "keep",
        k: "keep",
        ArrowLeft: "unstar",
        u: "unstar",
        a: "accept",
        s: "snooze",
        j: "skip",
        " ": "skip",
        Backspace: "back",
      };
      const a = map[e.key];
      if (a) {
        e.preventDefault();
        act(a);
      }
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [act]);

  const total = queue?.ids.length ?? 0;
  const done = Math.min(i, total);

  return (
    <>
      <PageHeader title="Triage" sub={MODES[mode].hint}>
        <Tabs value={mode} onValueChange={(m) => void navigate({ search: { mode: m as Mode } })}>
          <TabsList>
            {(Object.keys(MODES) as Mode[]).map((m) => {
              const M = MODES[m];
              return (
                <TabsTrigger key={m} value={m}>
                  <M.icon /> {M.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </PageHeader>

      {isLoading || !queue ? (
        <Skeleton className="mx-auto h-[28rem] max-w-2xl" />
      ) : (
        <div className="mx-auto max-w-2xl">
          <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-mono">
              {done} / {total}
            </span>
            <Progress value={total ? (done / total) * 100 : 100} className="flex-1" />
            <span className="font-mono text-neon-lime">{tally.kept} kept</span>
            <span className="font-mono text-neon-cyan">{tally.listed} listed</span>
            <span className="font-mono text-neon-red">{tally.unstarred} gone</span>
          </div>

          {mode === "unlisted" && <ClefNudge />}

          {current ? (
            <SwipeCard key={current.id} onSwipe={(dir) => act(dir === "right" ? "keep" : "unstar")}>
              <TriageCard s={current} derived={data!} />
            </SwipeCard>
          ) : (
            <Done tally={tally} mode={mode} onRestart={() => setQueue(null)} />
          )}

          {current && (
            <>
              <div className="sticky bottom-[5.25rem] z-20 -mx-2 mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-background/80 p-2 backdrop-blur-xl sm:grid-cols-4 md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
                <Button variant="destructive" size="lg" onClick={() => act("unstar")}>
                  <StarOffIcon /> Unstar <Kbd>←</Kbd>
                </Button>
                {suggested ? (
                  <Button size="lg" onClick={() => act("accept")} className="min-w-0 sm:col-span-2">
                    <BrainCircuitIcon /> <span className="truncate">{suggested.name}</span> <Kbd dark>A</Kbd>
                  </Button>
                ) : (
                  <ListPicker repoIds={[current.id]} align="center" onDone={() => next("listed")}>
                    <Button size="lg" variant="outline" className="sm:col-span-2">
                      <ListPlusIcon /> List…
                    </Button>
                  </ListPicker>
                )}
                <Button size="lg" variant="outline" className="border-neon-lime/40 text-neon-lime hover:border-neon-lime hover:text-neon-lime" onClick={() => act("keep")}>
                  <CheckIcon /> Keep <Kbd>→</Kbd>
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap justify-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => act("back")} disabled={i === 0}>
                  <UndoIcon /> Back
                </Button>
                <Button variant="ghost" size="sm" onClick={() => act("skip")}>
                  <SkipForwardIcon /> Skip <Kbd>J</Kbd>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => act("snooze")}>
                  <ClockIcon /> Snooze 90 days <Kbd>S</Kbd>
                </Button>
                {suggested && (
                  <ListPicker repoIds={[current.id]} align="center" onDone={() => next("listed")}>
                    <Button variant="ghost" size="sm">
                      <ListPlusIcon /> Other list…
                    </Button>
                  </ListPicker>
                )}
              </div>
              <p className="mt-3 hidden text-center text-xs text-muted-foreground md:block">Swipe or use the arrow keys. Unstars can be undone from the toast or Settings.</p>
            </>
          )}
        </div>
      )}
    </>
  );
}

function Kbd({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <kbd className={cn("ml-1 hidden rounded border px-1.5 font-mono text-[10px] sm:inline", dark ? "border-black/20 bg-black/10" : "border-white/15 bg-white/5")}>{children}</kbd>
  );
}

function ClefNudge() {
  const { data } = useDerived();
  const { classify } = useSyncContext();
  if (!data) return null;
  const pending = data.stars.filter((s) => s.listIds.length === 0 && !s.suggestion).length;
  if (!pending && !classify.progress.running) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-neon-violet/30 bg-neon-violet/10 px-4 py-2.5 text-sm">
      <BrainCircuitIcon className="size-4 text-neon-violet" />
      {classify.progress.running ? (
        <>
          <span className="text-neon-violet">{classify.progress.label}</span>
          <Progress value={classify.progress.pct} className="w-32" />
        </>
      ) : (
        <>
          <span className="flex-1 text-muted-foreground">{pending.toLocaleString()} unlisted repos don't have a Clef suggestion yet.</span>
          <Button size="sm" variant="outline" onClick={() => void classify.run("unlisted")} disabled={data.lists.length === 0}>
            Suggest lists
          </Button>
        </>
      )}
    </div>
  );
}

function TriageCard({ s, derived }: { s: EStar; derived: Derived }) {
  const years = (Date.now() - new Date(s.starredAt).getTime()) / (365 * 86_400_000);
  return (
    <div className="glass relative overflow-hidden rounded-3xl p-5 md:p-8">
      <div
        className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full opacity-40 blur-3xl"
        style={{ background: `radial-gradient(circle, ${s.languageColor ?? "var(--neon-violet)"}, transparent 70%)` }}
      />
      <div className="relative">
        <div className="mb-1 text-xs tracking-[0.2em] text-neon-violet uppercase">
          Starred {years >= 1 ? `${years.toFixed(1)} years ago` : ago(s.starredAt)}
        </div>
        <div className="flex items-start gap-4">
          <RepoAvatar owner={s.owner} src={s.ownerAvatar} className="size-11 rounded-2xl md:size-14" />
          <div className="min-w-0">
            <div className="truncate text-sm text-muted-foreground">{s.owner}</div>
            <h2 className="truncate text-2xl font-bold tracking-tight md:text-3xl">{s.name}</h2>
          </div>
        </div>
        <p className="mt-4 text-base text-foreground/85">{s.description ?? <span className="text-muted-foreground">No description</span>}</p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <HealthBadge health={s.health} />
          <GrowthBadge d={s.g.d7} estimated={s.g.estimated} />
          {s.isFork && <Badge variant="outline">Fork</Badge>}
          {s.topics.slice(0, 6).map((t) => (
            <Badge key={t} variant="violet">
              {t}
            </Badge>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric icon={StarIcon} label="Stars" value={fmtNum(s.stars)} />
          <Metric icon={GitForkIcon} label="Forks" value={fmtNum(s.forks)} />
          <Metric icon={ClockIcon} label="Last push" value={ago(s.pushedAt)} />
          <Metric icon={RocketIcon} label="Release" value={s.latestReleaseTag ? ago(s.latestReleaseAt) : "none"} />
        </div>
        {(s.isCruft || s.rules.reasons.length > 0) && (
          <div className="mt-4 rounded-xl border border-neon-amber/25 bg-neon-amber/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-neon-amber">
              <TriangleAlertIcon className="size-4" /> {Math.round(s.cruft * 100)}% likely cruft
            </div>
            <div className="mt-1 text-muted-foreground">
              {[...s.rules.reasons, ...(s.suggestion ? [`Clef: ${Math.round(s.suggestion.cruft * 100)}%`] : [])].join(" · ")}
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <LangDot color={s.languageColor} name={s.language} />
          {s.listIds.map((l) => (
            <Badge key={l}>{derived.listsById.get(l)?.name}</Badge>
          ))}
          <a href={s.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-primary hover:underline" onPointerDown={(e) => e.stopPropagation()}>
            GitHub <ExternalLinkIcon className="size-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof StarIcon; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-white/[0.02] px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] tracking-wider text-muted-foreground uppercase">
        <Icon className="size-3" /> {label}
      </div>
      <div className="mt-0.5 truncate font-mono text-sm">{value}</div>
    </div>
  );
}

function SwipeCard({ children, onSwipe }: { children: React.ReactNode; onSwipe: (dir: "left" | "right") => void }) {
  const [dx, setDx] = useState(0);
  const start = useRef<number | null>(null);
  const threshold = 110;
  return (
    <div
      className="relative touch-pan-y select-none"
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        start.current = e.clientX;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => start.current != null && setDx(e.clientX - start.current)}
      onPointerUp={() => {
        if (Math.abs(dx) > threshold) onSwipe(dx > 0 ? "right" : "left");
        start.current = null;
        setDx(0);
      }}
      onPointerCancel={() => {
        start.current = null;
        setDx(0);
      }}
      style={{
        transform: `translateX(${dx}px) rotate(${dx / 40}deg)`,
        transition: start.current == null ? "transform 250ms cubic-bezier(.2,.8,.2,1)" : "none",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-3xl transition-opacity"
        style={{
          opacity: Math.min(1, Math.abs(dx) / threshold),
          boxShadow: dx > 0 ? "0 0 0 2px var(--neon-lime), 0 0 60px -10px var(--neon-lime)" : "0 0 0 2px var(--neon-red), 0 0 60px -10px var(--neon-red)",
        }}
      />
      <div className="animate-in fade-in-0 zoom-in-95 duration-300">{children}</div>
    </div>
  );
}

function Done({ tally, mode, onRestart }: { tally: Tally; mode: Mode; onRestart: () => void }) {
  return (
    <div className="glass rounded-3xl p-10 text-center">
      <PartyPopperIcon className="mx-auto size-10 text-neon-magenta drop-shadow-[0_0_12px_var(--neon-magenta)]" />
      <h2 className="neon-text mt-4 text-2xl font-bold">Queue clear</h2>
      <p className="mt-2 text-muted-foreground">
        {tally.kept} kept · {tally.listed} listed · {tally.unstarred} unstarred · {tally.skipped} skipped
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Button variant="outline" onClick={onRestart}>
          Rebuild {MODES[mode].label.toLowerCase()} queue
        </Button>
        <Button asChild>
          <Link to="/stars">Browse all stars</Link>
        </Button>
      </div>
    </div>
  );
}
