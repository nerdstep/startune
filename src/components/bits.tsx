import { TrendingUpIcon } from "lucide-react";
import type { Health } from "@shared/scoring";
import { HEALTH_HINT, HEALTH_LABEL } from "@shared/scoring";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { HEALTH_CHART, HEALTH_CLASS } from "@/lib/palette";
import { cn, fmtDelta } from "@/lib/utils";

export function RepoAvatar({ owner, src, className }: { owner: string; src: string | null; className?: string }) {
  if (src)
    return <img src={`${src}${src.includes("?") ? "&" : "?"}s=64`} alt="" loading="lazy" className={cn("size-8 shrink-0 rounded-md bg-muted ring-1 ring-border", className)} />;
  return (
    <div aria-hidden className={cn("grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-xs font-semibold text-muted-foreground ring-1 ring-border", className)}>
      {owner[0]?.toUpperCase()}
    </div>
  );
}

export function LangDot({ color, name, className }: { color: string | null; name: string | null; className?: string }) {
  if (!name) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span className="size-2 rounded-full" style={{ background: color ?? "#888" }} />
      {name}
    </span>
  );
}

/** Uses the chart hues, so a badge reads like its legend entry. Archived is a ring, as on the star map. */
export function HealthBadge({ health }: { health: Health }) {
  return (
    <Tooltip content={`Class ${HEALTH_CLASS[health]} · ${HEALTH_HINT[health]}`}>
      <Badge variant="outline" className="gap-1.5 text-foreground/85">
        <span className={cn("size-1.5 rounded-full", health === "archived" && "bg-transparent ring-[1.5px] ring-inset")} style={{ background: health === "archived" ? undefined : HEALTH_CHART[health], color: HEALTH_CHART[health] }} />
        {HEALTH_LABEL[health]}
        <span className="font-mono text-[10px] text-muted-foreground">{HEALTH_CLASS[health]}</span>
      </Badge>
    </Tooltip>
  );
}

export function GrowthBadge({ d, estimated, label = "7d" }: { d: number | null; estimated?: boolean; label?: string }) {
  if (d == null || d <= 0) return null;
  return (
    <Tooltip content={`${estimated ? "Estimated " : ""}new stars in the last ${label === "7d" ? "7 days" : "30 days"}`}>
      <Badge variant="outline" className="tabular-nums text-foreground/85">
        <TrendingUpIcon className="text-muted-foreground" />
        {fmtDelta(d)}
        <span className="text-muted-foreground">{label}</span>
      </Badge>
    </Tooltip>
  );
}

export function SectionTitle({ children, hint, right }: { children: React.ReactNode; hint?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold">{children}</h2>
        {hint && <p className="mt-0.5 text-[13px] text-muted-foreground">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

export function PageHeader({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
