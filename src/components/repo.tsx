import { BrainCircuitIcon, ExternalLinkIcon, ListPlusIcon, MoreHorizontalIcon, StarIcon, StarOffIcon, TriangleAlertIcon } from "lucide-react";
import { createContext, useContext, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { useDerived, useReview, useUnstar, useUpdateLists, type EStar } from "@/lib/queries";
import { HEALTH_LABEL } from "@shared/scoring";
import { HEALTH_CHART, HEALTH_CLASS } from "@/lib/palette";
import { DORMANT_ALPHA } from "./star-field";
import { ago, agoShort, cn, fmtDate, fmtNum } from "@/lib/utils";
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
            <span className="font-normal text-muted-foreground">{s.owner}/</span>
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
          <Badge key={t} variant="outline">
            {t}
          </Badge>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border p-3 text-sm sm:grid-cols-3">
        <Stat label="Stars" value={fmtNum(s.stars)} />
        <Stat label="Forks" value={fmtNum(s.forks)} />
        <Stat label="Last push" value={ago(s.pushedAt)} />
        <Stat label="You starred" value={ago(s.starredAt)} />
        {s.latestReleaseTag && <Stat label="Latest release" value={`${s.latestReleaseTag} · ${ago(s.latestReleaseAt)}`} wide />}
        <Stat label="Created" value={fmtDate(s.createdAt)} />
      </dl>
      {s.rules.reasons.length > 0 && (
        <div className="rounded-lg border border-warning/25 bg-warning/5 p-3 text-sm">
          <div className="mb-1 flex items-center gap-2 font-medium text-warning">
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
      {suggested && !s.listIds.includes(suggested.id) && (
        <SuggestionChip repoId={s.id} listId={suggested.id} name={suggested.name} confidence={s.suggestion!.listConfidence} />
      )}
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
    <div className={cn("min-w-0", wide && "col-span-2")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate tabular-nums">{value}</dd>
    </div>
  );
}

export function SuggestionChip({
  repoId,
  listId,
  name,
  confidence,
  compact,
}: {
  repoId: string;
  listId: string;
  name: string;
  confidence: number;
  /** Single line for table cells: drops "Add to" and truncates the name. */
  compact?: boolean;
}) {
  const update = useUpdateLists();
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        update.mutate({ repoIds: [repoId], add: [listId] });
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-dashed border-input py-px pr-2.5 pl-2 text-xs whitespace-nowrap text-muted-foreground transition-colors duration-100 hover:border-solid hover:bg-accent hover:text-foreground",
        compact && "max-w-full min-w-0",
      )}
      title={`Clef suggests ${name} (${Math.round(confidence * 100)}% confident). Click to add.`}
      aria-label={`Add to ${name}, Clef's suggestion, ${Math.round(confidence * 100)}% confident`}
    >
      <BrainCircuitIcon className="size-3 shrink-0" />
      {!compact && "Add to "}
      <span className={cn("font-medium text-foreground", compact && "min-w-0 truncate")}>{name}</span>
      <span className="tabular-nums">{Math.round(confidence * 100)}%</span>
    </button>
  );
}

/* ---------- Row (library) ---------- */

/** Shared column template for the Stars table header and rows (md and up). */
export const ROW_COLS = "md:grid-cols-[1.25rem_2.75rem_minmax(0,1fr)_4.25rem_4.5rem_4.5rem_minmax(0,8.5rem)]";

export function RepoRow({
  s,
  selected,
  onSelect,
  onHover,
}: {
  s: EStar;
  selected: boolean;
  onSelect: (id: string, shift: boolean) => void;
  onHover?: (id: string | null) => void;
}) {
  const { data } = useDerived();
  const open = useOpenRepo();
  const unstar = useUnstar();
  const suggested = s.suggestion?.listId && !s.listIds.includes(s.suggestion.listId) ? data?.listsById.get(s.suggestion.listId) : undefined;
  const lists = s.listIds.map((l) => data?.listsById.get(l)?.name).filter(Boolean) as string[];
  const dot = (
    <span
      aria-hidden
      className="inline-block size-2 shrink-0 rounded-full"
      style={
        s.health === "archived"
          ? { boxShadow: `inset 0 0 0 1.5px ${HEALTH_CHART[s.health]}` }
          : { background: HEALTH_CHART[s.health], opacity: s.health === "dormant" ? DORMANT_ALPHA : 1 }
      }
    />
  );
  return (
    <div
      onClick={() => open(s.id)}
      onMouseEnter={() => onHover?.(s.id)}
      onMouseLeave={() => onHover?.(null)}
      className={cn(
        "group relative grid cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b px-3 py-2.5 transition-colors duration-100 hover:bg-accent/40",
        ROW_COLS,
        selected && "bg-secondary/70 hover:bg-secondary",
      )}
    >
      <div
        className="flex"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(s.id, e.shiftKey);
        }}
      >
        <Checkbox checked={selected} aria-label={`Select ${s.fullName}`} />
      </div>
      <Tooltip content={`${HEALTH_LABEL[s.health]} · class ${HEALTH_CLASS[s.health]}`}>
        <span className="hidden items-center gap-2 md:inline-flex">
          {dot}
          <span className="font-mono text-[11px] text-muted-foreground">{HEALTH_CLASS[s.health]}</span>
        </span>
      </Tooltip>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className="md:hidden">{dot}</span>
          <button
            className="min-w-0 truncate text-left text-sm font-medium outline-none focus-visible:underline"
            onClick={(e) => {
              e.stopPropagation();
              open(s.id);
            }}
            onFocus={() => onHover?.(s.id)}
            onBlur={() => onHover?.(null)}
          >
            <span className="font-normal text-muted-foreground">{s.owner}/</span>
            <span className="underline-offset-2 group-hover:underline">{s.name}</span>
          </button>
          {s.isCruft && (
            <Tooltip content={s.rules.reasons.join(" · ") || "Clef flagged this as likely cruft"}>
              <Badge variant="warning" className="shrink-0">
                cruft {Math.round(s.cruft * 100)}%
              </Badge>
            </Tooltip>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {s.language && <span className="hidden text-foreground/70 md:inline">{s.language} · </span>}
          {s.description ?? "No description"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground md:hidden">
          {s.language && <span className="text-foreground/70">{s.language}</span>}
          <span className="tabular-nums">{fmtNum(s.stars)} stars</span>
          <span className="tabular-nums">pushed {agoShort(s.pushedAt)}</span>
          {lists[0] && <Badge>{lists[0]}</Badge>}
        </div>
      </div>
      <span className="hidden text-right tabular-nums md:block">
        <span className="block text-sm">{fmtNum(s.stars)}</span>
        {(s.g.d7 ?? 0) > 0 && <span className="block text-[11px] text-muted-foreground">+{fmtNum(s.g.d7!)} 7d</span>}
      </span>
      <span className="hidden text-sm text-muted-foreground tabular-nums md:block">{agoShort(s.pushedAt)}</span>
      <span className="hidden text-sm text-muted-foreground tabular-nums md:block">{agoShort(s.starredAt)}</span>
      <div className="hidden min-w-0 items-center gap-1 md:flex">
        {lists.length > 0 ? (
          <>
            <Badge className="min-w-0 truncate">{lists[0]}</Badge>
            {lists.length > 1 && <span className="text-xs text-muted-foreground tabular-nums">+{lists.length - 1}</span>}
          </>
        ) : suggested ? (
          <SuggestionChip repoId={s.id} listId={suggested.id} name={suggested.name} confidence={s.suggestion!.listConfidence} compact />
        ) : (
          <span className="text-xs text-muted-foreground">Unlisted</span>
        )}
      </div>
      <div
        className="flex items-center justify-end gap-0.5 opacity-100 transition md:pointer-events-none md:absolute md:top-1/2 md:right-2 md:-translate-y-1/2 md:rounded-md md:border md:bg-popover md:p-0.5 md:opacity-0 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
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
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex h-full flex-col gap-2 rounded-lg border bg-card p-4 transition-colors duration-100",
        onClick && "cursor-pointer hover:border-input hover:bg-accent/40",
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <RepoAvatar owner={s.owner} src={s.ownerAvatar} />
        <div className="min-w-0">
          <div className="truncate text-xs text-muted-foreground">{s.owner}</div>
          <div className="truncate font-medium">{s.name}</div>
        </div>
      </div>
      <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">{s.description ?? "No description"}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <LangDot color={s.languageColor} name={s.language} />
        <span className="inline-flex items-center gap-1 tabular-nums">
          <StarIcon className="size-3" />
          {fmtNum(s.stars)}
        </span>
        <span>pushed {ago(s.pushedAt)}</span>
      </div>
      {footer}
    </div>
  );
}
