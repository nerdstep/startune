import { createFileRoute, Link } from "@tanstack/react-router";
import { BrainCircuitIcon, LightbulbIcon, LockIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, SparklesIcon, Trash2Icon, WandSparklesIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { StarList } from "@shared/schemas";
import { HEALTH_ORDER, listIdeas } from "@shared/scoring";
import { PageHeader, SectionTitle } from "@/components/bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { HEALTH_CHART } from "@/lib/palette";
import { useCreateList, useDeleteList, useDerived, useEditList, useUpdateLists } from "@/lib/queries";
import { useSyncContext } from "@/lib/sync-context";

export const Route = createFileRoute("/lists")({ component: Lists });

function Lists() {
  const { data, isLoading } = useDerived();
  const [editing, setEditing] = useState<StarList | "new" | null>(null);
  const [deleting, setDeleting] = useState<StarList | null>(null);
  const del = useDeleteList();

  const cards = useMemo(() => {
    if (!data) return [];
    return data.lists.map((l) => {
      const members = data.stars.filter((s) => s.listIds.includes(l.id));
      const health = HEALTH_ORDER.map((h) => ({ h, n: members.filter((m) => m.health === h).length }));
      const langs = new Map<string, number>();
      for (const m of members) if (m.language) langs.set(m.language, (langs.get(m.language) ?? 0) + 1);
      return {
        l,
        count: members.length,
        cruft: members.filter((m) => m.isCruft).length,
        health,
        langs: [...langs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
      };
    });
  }, [data]);

  if (isLoading || !data)
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    );

  const unlisted = data.stars.filter((s) => s.listIds.length === 0).length;

  return (
    <>
      <PageHeader title="Lists" sub={`${data.lists.length} lists · ${unlisted.toLocaleString()} stars without a home`}>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon /> New list
        </Button>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        <ClefPanel />
        <Ideas />
      </div>

      <section className="mt-8">
        <SectionTitle>Your lists</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ l, count, cruft, health, langs }) => (
            <Card key={l.id} className="gap-3 px-5 py-4">
              <div className="flex items-start justify-between gap-2">
                <Link to="/stars" search={{ list: l.id }} className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate font-semibold hover:text-primary">
                    {l.isPrivate && <LockIcon className="size-3.5 text-muted-foreground" />}
                    {l.name}
                  </div>
                  <div className="line-clamp-1 text-xs text-muted-foreground">{l.description || "No description"}</div>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon-sm" variant="ghost" aria-label="List actions">
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing(l)}>
                      <PencilIcon /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(l)}>
                      <Trash2Icon /> Delete list
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Link to="/stars" search={{ list: l.id }} className="flex items-end justify-between">
                <span className="text-glow font-mono text-3xl font-semibold text-primary">{count}</span>
                {cruft > 0 && <Badge variant="amber">{cruft} cruft</Badge>}
              </Link>
              <div className="flex h-1.5 gap-[2px] overflow-hidden rounded-full" aria-label="Health mix">
                {health
                  .filter((x) => x.n)
                  .map(({ h, n }) => (
                    <span key={h} style={{ flex: n, background: HEALTH_CHART[h] }} title={`${h}: ${n}`} />
                  ))}
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                {langs.map(([lang, n]) => (
                  <span key={lang}>
                    {lang} <span className="font-mono text-foreground/70">{n}</span>
                  </span>
                ))}
              </div>
            </Card>
          ))}
          <button
            onClick={() => setEditing("new")}
            className="grid min-h-40 place-items-center rounded-2xl border border-dashed border-border text-muted-foreground transition hover:border-primary/50 hover:text-primary hover:shadow-[0_0_30px_-12px_var(--neon-cyan)]"
          >
            <span className="flex items-center gap-2">
              <PlusIcon className="size-4" /> New list
            </span>
          </button>
        </div>
      </section>

      <ListDialog list={editing} onClose={() => setEditing(null)} />
      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{deleting?.name}”?</DialogTitle>
            <DialogDescription>This deletes the list on GitHub. The repos stay starred.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleting && (del.mutate(deleting.id), setDeleting(null))}>
              Delete list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ListDialog({ list, onClose }: { list: StarList | "new" | null; onClose: () => void }) {
  const create = useCreateList();
  const edit = useEditList();
  const isNew = list === "new";
  const current = list && list !== "new" ? list : null;
  const [form, setForm] = useState({ name: "", description: "", isPrivate: false });
  const [key, setKey] = useState<string | null>(null);
  const k = isNew ? "new" : (current?.id ?? null);
  if (k !== key) {
    setKey(k);
    setForm({ name: current?.name ?? "", description: current?.description ?? "", isPrivate: current?.isPrivate ?? false });
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = { name: form.name.trim(), description: form.description.trim() || undefined, isPrivate: form.isPrivate };
    if (isNew) await create.mutateAsync(input);
    else if (current) await edit.mutateAsync({ id: current.id, input });
    onClose();
  };
  return (
    <Dialog open={!!list} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{isNew ? "New list" : "Edit list"}</DialogTitle>
            <DialogDescription>Lists live on GitHub. A good description also helps Clef sort repos into it.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="ln">Name</Label>
            <Input id="ln" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} required autoFocus />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ld">Description</Label>
            <Input id="ld" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} placeholder="e.g. Terminal tools and TUIs" />
          </div>
          <label className="flex items-center gap-3 text-sm">
            <Switch checked={form.isPrivate} onCheckedChange={(c) => setForm({ ...form, isPrivate: c })} /> Private list
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!form.name.trim() || create.isPending || edit.isPending}>
              {isNew ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ClefPanel() {
  const { data } = useDerived();
  const { classify } = useSyncContext();
  const update = useUpdateLists();
  const [threshold, setThreshold] = useState(0.8);
  const [confirm, setConfirm] = useState(false);
  const plan = useMemo(() => {
    const byList = new Map<string, string[]>();
    for (const s of data?.stars ?? []) {
      const l = s.suggestion?.listId;
      if (!l || s.listIds.length > 0 || s.suggestion!.listConfidence < threshold) continue;
      byList.set(l, [...(byList.get(l) ?? []), s.id]);
    }
    return [...byList.entries()].filter(([l]) => data?.listsById.has(l));
  }, [data, threshold]);
  if (!data) return null;
  const total = plan.reduce((a, [, ids]) => a + ids.length, 0);
  const pending = data.stars.filter((s) => s.listIds.length === 0 && !s.suggestion).length;

  return (
    <Card className="border-neon-violet/20">
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 font-semibold text-neon-violet">
          <BrainCircuitIcon className="size-5" /> Sort with Clef
        </div>
        <p className="text-sm text-muted-foreground">
          Clef reads each unlisted repo's description, topics and activity, picks the best list (or none), and scores how likely it is to be cruft. It runs on Workers AI in your own Cloudflare account.
        </p>
        {classify.progress.running ? (
          <div className="space-y-2">
            <Progress value={classify.progress.pct} />
            <p className="text-xs text-muted-foreground">{classify.progress.label}</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void classify.run("unlisted")} disabled={!pending || data.lists.length === 0}>
              <SparklesIcon /> {pending ? `Classify ${pending.toLocaleString()} unlisted` : "All unlisted classified"}
            </Button>
            <Button variant="ghost" onClick={() => void classify.run("all")} disabled={data.lists.length === 0}>
              Re-run on everything
            </Button>
          </div>
        )}
        <div className="mt-1 rounded-xl border border-border bg-white/[0.02] p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>
              <span className="font-mono text-primary">{total}</span> suggestions at ≥ {Math.round(threshold * 100)}% confidence
            </span>
            <Button size="sm" onClick={() => setConfirm(true)} disabled={!total}>
              <WandSparklesIcon /> Apply
            </Button>
          </div>
          <input
            type="range"
            min={0.5}
            max={0.95}
            step={0.05}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="mt-3 w-full accent-[var(--neon-cyan)]"
            aria-label="Confidence threshold"
          />
        </div>
      </CardContent>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply {total} suggestions?</DialogTitle>
            <DialogDescription>These repos will be added to lists on GitHub.</DialogDescription>
          </DialogHeader>
          <ul className="grid gap-1.5 text-sm">
            {plan.map(([l, ids]) => (
              <li key={l} className="flex justify-between rounded-lg bg-white/[0.03] px-3 py-1.5">
                <span>{data.listsById.get(l)?.name}</span>
                <span className="font-mono text-primary">+{ids.length}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                for (const [l, ids] of plan) update.mutate({ repoIds: ids, add: [l] });
                setConfirm(false);
              }}
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Ideas() {
  const { data } = useDerived();
  const create = useCreateList();
  const update = useUpdateLists();
  const ideas = useMemo(() => (data ? listIdeas(data.stars, data.lists) : []), [data]);
  if (!data) return null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2 font-semibold text-neon-amber">
          <LightbulbIcon className="size-5" /> List ideas
        </div>
        <p className="text-sm text-muted-foreground">Topics shared by several unlisted stars that don't have a list yet.</p>
        <div className="flex flex-wrap gap-2">
          {ideas.map((idea) => (
            <button
              key={idea.topic}
              disabled={create.isPending}
              onClick={async () => {
                const list = await create.mutateAsync({ name: idea.topic, description: `Repos tagged ${idea.topic}`, isPrivate: false });
                update.mutate({ repoIds: idea.repoIds, add: [list.id] });
              }}
              className="group inline-flex items-center gap-2 rounded-full border border-neon-amber/30 bg-neon-amber/5 py-1 pr-1 pl-3 text-sm transition hover:border-neon-amber hover:shadow-[0_0_20px_-6px_var(--neon-amber)]"
            >
              {idea.topic}
              <span className="rounded-full bg-neon-amber/15 px-2 font-mono text-xs text-neon-amber">{idea.repoIds.length}</span>
              <PlusIcon className="mr-1 size-3.5 text-muted-foreground group-hover:text-neon-amber" />
            </button>
          ))}
          {ideas.length === 0 && <p className="text-sm text-muted-foreground">No clear clusters right now.</p>}
        </div>
      </CardContent>
    </Card>
  );
}
