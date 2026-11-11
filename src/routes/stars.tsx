import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { CheckCheckIcon, FilterXIcon, ListPlusIcon, SearchIcon, StarOffIcon, XIcon } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { HEALTH_LABEL, HEALTH_ORDER } from "@shared/scoring";
import { PageHeader } from "@/components/bits";
import { ListPicker } from "@/components/list-picker";
import { RepoRow } from "@/components/repo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDerived, useReview, useUnstar, type EStar } from "@/lib/queries";
import { cn } from "@/lib/utils";

const SORTS = {
  starred: "Recently starred",
  oldest: "Oldest stars",
  stars: "Most stars",
  pushed: "Recently pushed",
  trending: "Trending",
  cruft: "Cruft score",
  name: "Name",
} as const;

const Search = z.object({
  q: z.string().optional().catch(undefined),
  list: z.string().optional().catch(undefined), // list id or "none"
  lang: z.string().optional().catch(undefined),
  health: z.enum(["thriving", "active", "quiet", "dormant", "archived"]).optional().catch(undefined),
  cruft: z.boolean().optional().catch(undefined),
  year: z.number().int().optional().catch(undefined),
  sort: z.enum(Object.keys(SORTS) as [keyof typeof SORTS, ...Array<keyof typeof SORTS>]).optional().catch(undefined),
});
type Search = z.infer<typeof Search>;

export const Route = createFileRoute("/stars")({
  validateSearch: Search,
  component: Library,
});

function sorter(sort: keyof typeof SORTS): (a: EStar, b: EStar) => number {
  switch (sort) {
    case "oldest":
      return (a, b) => a.starredAt.localeCompare(b.starredAt);
    case "stars":
      return (a, b) => b.stars - a.stars;
    case "pushed":
      return (a, b) => (b.pushedAt ?? "").localeCompare(a.pushedAt ?? "");
    case "trending":
      return (a, b) => (b.g.d7 ?? b.momentum) - (a.g.d7 ?? a.momentum);
    case "cruft":
      return (a, b) => b.cruft - a.cruft;
    case "name":
      return (a, b) => a.fullName.localeCompare(b.fullName);
    default:
      return (a, b) => b.starredAt.localeCompare(a.starredAt);
  }
}

function Library() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/stars" });
  const { data, isLoading } = useDerived();
  const [q, setQ] = useState(search.q ?? "");
  const dq = useDeferredValue(q);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastClicked = useRef<string | null>(null);
  const unstar = useUnstar();
  const review = useReview();

  const set = (patch: Partial<Search>) => void navigate({ search: (s) => ({ ...s, ...patch }), replace: true });

  useEffect(() => {
    const t = setTimeout(() => set({ q: q || undefined }), 300);
    return () => clearTimeout(t);
  }, [q]);

  const languages = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data?.stars ?? []) if (s.language) m.set(s.language, (m.get(s.language) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = dq.trim().toLowerCase();
    const out = data.stars.filter((s) => {
      if (search.list === "none" ? s.listIds.length > 0 : search.list && !s.listIds.includes(search.list)) return false;
      if (search.lang && s.language !== search.lang) return false;
      if (search.health && s.health !== search.health) return false;
      if (search.cruft && !s.isCruft) return false;
      if (search.year && new Date(s.starredAt).getFullYear() !== search.year) return false;
      if (needle) {
        const hay = `${s.fullName} ${s.description ?? ""} ${s.topics.join(" ")}`.toLowerCase();
        if (!needle.split(/\s+/).every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    return out.sort(sorter(search.sort ?? "starred"));
  }, [data, dq, search]);

  // Drop selections that are filtered out or gone
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(rows.map((r) => r.id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [rows]);

  const listRef = useRef<HTMLDivElement>(null);
  const virt = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => 104,
    overscan: 8,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  });

  const onSelect = (id: string, shift: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (shift && lastClicked.current) {
        const a = rows.findIndex((r) => r.id === lastClicked.current);
        const b = rows.findIndex((r) => r.id === id);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        for (let i = lo; i <= hi; i++) next.add(rows[i]!.id);
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastClicked.current = id;
  };

  const activeFilters: Array<[string, () => void]> = [];
  if (search.list) activeFilters.push([search.list === "none" ? "Unlisted" : (data?.listsById.get(search.list)?.name ?? "List"), () => set({ list: undefined })]);
  if (search.lang) activeFilters.push([search.lang, () => set({ lang: undefined })]);
  if (search.health) activeFilters.push([HEALTH_LABEL[search.health], () => set({ health: undefined })]);
  if (search.cruft) activeFilters.push(["Likely cruft", () => set({ cruft: undefined })]);
  if (search.year) activeFilters.push([`Starred in ${search.year}`, () => set({ year: undefined })]);

  const ids = [...selected];
  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <>
      <PageHeader title="Stars" sub={data ? `${rows.length.toLocaleString()} of ${data.stars.length.toLocaleString()} repos` : undefined} />

      {/* Filters: one row */}
      <div className="sticky top-14 z-10 -mx-4 mb-3 flex flex-wrap items-center gap-2 border-b border-border bg-background/70 px-4 py-3 backdrop-blur-xl md:-mx-8 md:px-8">
        <div className="relative min-w-52 flex-1">
          <SearchIcon className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, description, topics…" className="pl-9" />
        </div>
        <Filter label="List" active={!!search.list}>
          <DropdownMenuCheckboxItem checked={!search.list} onCheckedChange={() => set({ list: undefined })}>
            Any
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem checked={search.list === "none"} onCheckedChange={() => set({ list: "none" })}>
            Unlisted
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {data?.lists.map((l) => (
            <DropdownMenuCheckboxItem key={l.id} checked={search.list === l.id} onCheckedChange={() => set({ list: l.id })}>
              <span className="flex-1">{l.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{data.listCounts.get(l.id) ?? 0}</span>
            </DropdownMenuCheckboxItem>
          ))}
        </Filter>
        <Filter label="Language" active={!!search.lang}>
          <DropdownMenuCheckboxItem checked={!search.lang} onCheckedChange={() => set({ lang: undefined })}>
            Any
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <div className="max-h-72 overflow-y-auto">
            {languages.map(([l, n]) => (
              <DropdownMenuCheckboxItem key={l} checked={search.lang === l} onCheckedChange={() => set({ lang: l })}>
                <span className="flex-1">{l}</span>
                <span className="font-mono text-xs text-muted-foreground">{n}</span>
              </DropdownMenuCheckboxItem>
            ))}
          </div>
        </Filter>
        <Filter label="Health" active={!!search.health || !!search.cruft}>
          <DropdownMenuCheckboxItem checked={!!search.cruft} onCheckedChange={(c) => set({ cruft: c ? true : undefined })}>
            Likely cruft only
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {HEALTH_ORDER.map((h) => (
            <DropdownMenuCheckboxItem key={h} checked={search.health === h} onCheckedChange={(c) => set({ health: c ? h : undefined })}>
              {HEALTH_LABEL[h]}
            </DropdownMenuCheckboxItem>
          ))}
        </Filter>
        <Filter label={SORTS[search.sort ?? "starred"]} active={false}>
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          {(Object.keys(SORTS) as Array<keyof typeof SORTS>).map((k) => (
            <DropdownMenuCheckboxItem key={k} checked={(search.sort ?? "starred") === k} onCheckedChange={() => set({ sort: k === "starred" ? undefined : k })}>
              {SORTS[k]}
            </DropdownMenuCheckboxItem>
          ))}
        </Filter>
        {activeFilters.length > 0 && (
          <div className="flex w-full flex-wrap items-center gap-1.5">
            {activeFilters.map(([label, clear]) => (
              <Badge key={label} role="button" tabIndex={0} className="cursor-pointer" onClick={clear}>
                {label} <XIcon />
              </Badge>
            ))}
            <Button size="sm" variant="ghost" onClick={() => void navigate({ search: {} })}>
              <FilterXIcon /> Clear
            </Button>
          </div>
        )}
      </div>

      <div className="mb-1 flex items-center gap-3 px-3 text-xs text-muted-foreground">
        <Checkbox
          checked={allSelected ? true : selected.size > 0 ? "indeterminate" : false}
          onCheckedChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
          aria-label="Select all"
        />
        <span>{selected.size ? `${selected.size} selected` : "Select all"} · shift-click to select a range</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">No stars match these filters.</div>
      ) : (
        <div ref={listRef} style={{ height: virt.getTotalSize(), position: "relative" }}>
          {virt.getVirtualItems().map((v) => {
            const s = rows[v.index]!;
            return (
              <div
                key={s.id}
                data-index={v.index}
                ref={virt.measureElement}
                className="absolute inset-x-0"
                style={{ transform: `translateY(${v.start - virt.options.scrollMargin}px)` }}
              >
                <RepoRow s={s} selected={selected.has(s.id)} onSelect={onSelect} />
              </div>
            );
          })}
        </div>
      )}

      {/* Bulk actions */}
      <div
        className={cn(
          "fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-xl items-center gap-2 rounded-2xl border border-primary/30 bg-popover p-2 pl-4 shadow-[0_0_40px_-10px_var(--neon-cyan)] backdrop-blur-xl transition-all md:bottom-6",
          selected.size ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
        )}
      >
        <span className="mr-auto font-mono text-sm text-primary">{selected.size} selected</span>
        <ListPicker repoIds={ids} align="center">
          <Button size="sm" variant="outline">
            <ListPlusIcon /> Lists
          </Button>
        </ListPicker>
        <Button size="sm" variant="outline" onClick={() => (review.mutate({ repoIds: ids, action: "keep" }), setSelected(new Set()))}>
          <CheckCheckIcon /> Keep
        </Button>
        <Button size="sm" variant="destructive" onClick={() => (unstar.mutate(ids), setSelected(new Set()))}>
          <StarOffIcon /> Unstar
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={() => setSelected(new Set())} aria-label="Clear selection">
          <XIcon />
        </Button>
      </div>
    </>
  );
}

function Filter({ label, active, children }: { label: string; active: boolean; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-9", active && "border-primary/50 text-primary")}>
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
