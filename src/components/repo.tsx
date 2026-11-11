import {
  BrainCircuitIcon,
  CalendarIcon,
  ExternalLinkIcon,
  GitForkIcon,
  ListPlusIcon,
  MoreHorizontalIcon,
  StarIcon,
  StarOffIcon,
  TagIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { createContext, useContext, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLinkItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { useSpotlight } from "@/lib/use-spotlight";
import { useDerived, useReview, useUnstar, useUpdateLists, type EStar } from "@/lib/queries";
import { ago, cn, fmtDate, fmtNum } from "@/lib/utils";
import { GrowthBadge, HealthBadge, LangDot, RepoAvatar } from "./bits";
import { ListPicker } from "./list-picker";

/* ---------- Detail dialog (opened from anywhere) ---------- */

const DetailCtx = createContext<(id: string) => void>(() => {});
export const useOpenRepo = () => useContext(DetailCtx);

export function RepoDetailProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  return (
    <DetailCtx.Provider value={setId}>
      {children}
      <Dialog open={!!id} onOpenChange={(o) => !o && setId(null)}>
        <DialogContent className="max-w-xl">{id && <RepoDetail id={id} onClose={() => setId(null)} />}</DialogContent>
      </Dialog>
    </DetailCtx.Provider>
  );
}

function RepoDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useDerived();
  const unstar = useUnstar();
  const review = useReview();
  const s = data?.byId.get(id);
  if (!data || !s)
    return (
      <>
        <DialogTitle>Not starred anymore</DialogTitle>
        <DialogDescription>This repo was removed from your stars.</DialogDescription>
      </>
    );
  const suggested = s.suggestion?.listId ? data.listsById.get(s.suggestion.listId) : undefined;
  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3 pr-6">
        <RepoAvatar owner={s.owner} src={s.ownerAvatar} className="size-11" />
        <div className="min-w-0">
          <DialogTitle className="truncate">
            <span className="text-muted-foreground">{s.owner}/</span>
            {s.name}
          </DialogTitle>
          <DialogDescription className="mt-1">{s.description ?? "No description"}</DialogDescription>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <HealthBadge health={s.health} />
        <GrowthBadge d={s.g.d7} estimated={s.g.estimated} />
        {s.isFork && <Badge variant="outline">Fork</Badge>}
        {s.license && <Badge variant="outline">{s.license}</Badge>}
        {s.topics.map((t) => (
          <Badge key={t} variant="violet">
            {t}
          </Badge>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <Stat label="Stars" value={fmtNum(s.stars)} />
        <Stat label="Forks" value={fmtNum(s.forks)} />
        <Stat label="Last push" value={ago(s.pushedAt)} />
        <Stat label="You starred" value={ago(s.starredAt)} />
        {s.latestReleaseTag && <Stat label="Latest release" value={`${s.latestReleaseTag} · ${ago(s.latestReleaseAt)}`} wide />}
        <Stat label="Created" value={fmtDate(s.createdAt)} />
      </dl>
      {s.rules.reasons.length > 0 && (
        <div className="rounded-xl border border-neon-amber/25 bg-neon-amber/5 p-3 text-sm">
          <div className="mb-1 flex items-center gap-2 font-medium text-neon-amber">
            <TriangleAlertIcon className="size-4" /> Cruft score {Math.round(s.cruft * 100)}%
          </div>
          <ul className="list-inside list-disc text-muted-foreground">
            {s.rules.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
            {s.suggestion && <li>Clef thinks it's {Math.round(s.suggestion.cruft * 100)}% likely to be cruft</li>}
          </ul>
        </div>
      )}
      {suggested && !s.listIds.includes(suggested.id) && <SuggestionChip repoId={s.id} listId={suggested.id} name={suggested.name} confidence={s.suggestion!.listConfidence} />}
      <div>
        <div className="mb-1.5 text-xs font-medium text-muted-foreground">Lists</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {s.listIds.map((l) => (
            <Badge key={l}>{data.listsById.get(l)?.name ?? "…"}</Badge>
          ))}
          <ListPicker repoIds={[s.id]} align="start">
            <Button size="sm" variant="outline">
              <ListPlusIcon /> Edit lists
            </Button>
          </ListPicker>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button variant="destructive" onClick={() => (unstar.mutate([s.id]), onClose())}>
          <StarOffIcon /> Unstar
        </Button>
        <Button variant="outline" onClick={() => review.mutate({ repoIds: [s.id], action: "keep" })} disabled={!!s.reviewedAt}>
          {s.reviewedAt ? `Kept ${ago(s.reviewedAt)}` : "Mark as kept"}
        </Button>
        <Button nativeButton={false} render={<a href={s.url} target="_blank" rel="noreferrer" />}>
          Open on GitHub <ExternalLinkIcon />
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-border bg-white/[0.02] px-3 py-2", wide && "col-span-2")}>
      <dt className="text-[11px] tracking-wider text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5 truncate font-mono text-sm">{value}</dd>
    </div>
  );
}

export function SuggestionChip({ repoId, listId, name, confidence }: { repoId: string; listId: string; name: string; confidence: number }) {
  const update = useUpdateLists();
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        update.mutate({ repoIds: [repoId], add: [listId] });
      }}
      className="group inline-flex items-center gap-2 rounded-full border border-neon-violet/40 bg-neon-violet/10 py-1 pr-3 pl-2 text-xs text-neon-violet transition hover:shadow-[0_0_18px_-4px_var(--neon-violet)]"
    >
      <BrainCircuitIcon className="size-3.5" />
      Add to <b className="font-semibold">{name}</b>
      <span className="font-mono opacity-70">{Math.round(confidence * 100)}%</span>
    </button>
  );
}

/* ---------- Row (library) ---------- */

export function RepoRow({
  s,
  selected,
  onSelect,
}: {
  s: EStar;
  selected: boolean;
  onSelect: (id: string, shift: boolean) => void;
}) {
  const { data } = useDerived();
  const open = useOpenRepo();
  const unstar = useUnstar();
  const ref = useSpotlight<HTMLDivElement>();
  const suggested = s.suggestion?.listId && !s.listIds.includes(s.suggestion.listId) ? data?.listsById.get(s.suggestion.listId) : undefined;
  return (
    <div
      ref={ref}
      onClick={() => open(s.id)}
      className={cn(
        "spotlight group flex cursor-pointer items-start gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors hover:border-border hover:bg-white/[0.025]",
        selected && "border-primary/40 bg-primary/[0.06] shadow-[inset_0_0_24px_-12px_var(--neon-cyan)]",
      )}
    >
      <div
        className="pt-2"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(s.id, e.shiftKey);
        }}
      >
        <Checkbox checked={selected} aria-label={`Select ${s.fullName}`} />
      </div>
      <RepoAvatar owner={s.owner} src={s.ownerAvatar} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate font-medium">
            <span className="text-muted-foreground">{s.owner}/</span>
            <span className="group-hover:text-primary group-hover:text-glow transition-colors">{s.name}</span>
          </span>
          {s.isCruft && (
            <Tooltip content={s.rules.reasons.join(" · ") || "Clef flagged this as likely cruft"}>
              <Badge variant="amber">
                <TriangleAlertIcon /> cruft {Math.round(s.cruft * 100)}%
              </Badge>
            </Tooltip>
          )}
          <GrowthBadge d={s.g.d7} estimated={s.g.estimated} />
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{s.description ?? "No description"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <LangDot color={s.languageColor} name={s.language} />
          <span className="inline-flex items-center gap-1 font-mono">
            <StarIcon className="size-3" />
            {fmtNum(s.stars)}
          </span>
          <span className="hidden items-center gap-1 sm:inline-flex">
            <GitForkIcon className="size-3" />
            {fmtNum(s.forks)}
          </span>
          <span className="inline-flex items-center gap-1">
            <CalendarIcon className="size-3" />
            pushed {ago(s.pushedAt)}
          </span>
          <span className="hidden md:inline">· starred {ago(s.starredAt)}</span>
          {s.listIds.map((l) => (
            <Badge key={l} className="py-0">
              <TagIcon />
              {data?.listsById.get(l)?.name}
            </Badge>
          ))}
          {suggested && <SuggestionChip repoId={s.id} listId={suggested.id} name={suggested.name} confidence={s.suggestion!.listConfidence} />}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
        <ListPicker repoIds={[s.id]}>
          <Button size="icon-sm" variant="ghost" aria-label="Edit lists">
            <ListPlusIcon />
          </Button>
        </ListPicker>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label="More" />}>
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLinkItem href={s.url} target="_blank" rel="noreferrer">
              <ExternalLinkIcon /> Open on GitHub
            </DropdownMenuLinkItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => unstar.mutate([s.id])}>
              <StarOffIcon /> Unstar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

/* ---------- Card (gems, trending, discover) ---------- */

export function RepoTile({
  s,
  footer,
  onClick,
  className,
}: {
  s: Pick<EStar, "id" | "owner" | "name" | "description" | "ownerAvatar" | "language" | "languageColor" | "stars" | "pushedAt"> & Partial<EStar>;
  footer?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const ref = useSpotlight<HTMLDivElement>();
  return (
    <div
      ref={ref}
      onClick={onClick}
      className={cn("glass spotlight flex h-full flex-col gap-2 rounded-2xl p-4 transition-transform", onClick && "cursor-pointer hover:-translate-y-0.5", className)}
    >
      <div className="flex items-center gap-2.5">
        <RepoAvatar owner={s.owner} src={s.ownerAvatar} />
        <div className="min-w-0">
          <div className="truncate text-xs text-muted-foreground">{s.owner}</div>
          <div className="truncate font-semibold">{s.name}</div>
        </div>
      </div>
      <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">{s.description ?? "No description"}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <LangDot color={s.languageColor} name={s.language} />
        <span className="inline-flex items-center gap-1 font-mono">
          <StarIcon className="size-3 text-neon-amber" />
          {fmtNum(s.stars)}
        </span>
        <span>pushed {ago(s.pushedAt)}</span>
      </div>
      {footer}
    </div>
  );
}
