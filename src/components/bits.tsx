import { ArchiveIcon, FlameIcon, MoonIcon, SparklesIcon, ZapIcon } from "lucide-react";
import type { Health } from "@shared/scoring";
import { HEALTH_HINT, HEALTH_LABEL } from "@shared/scoring";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, fmtDelta } from "@/lib/utils";

export function RepoAvatar({ owner, src, className }: { owner: string; src: string | null; className?: string }) {
  const hue = [...owner].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  if (src)
    return <img src={`${src}${src.includes("?") ? "&" : "?"}s=64`} alt="" loading="lazy" className={cn("size-8 shrink-0 rounded-lg ring-1 ring-white/10", className)} />;
  return (
    <div
      aria-hidden
      className={cn("grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white/90 ring-1 ring-white/10", className)}
      style={{ background: `linear-gradient(135deg, hsl(${hue} 80% 45%), hsl(${(hue + 60) % 360} 85% 35%))` }}
    >
      {owner[0]?.toUpperCase()}
    </div>
  );
}

export function LangDot({ color, name, className }: { color: string | null; name: string | null; className?: string }) {
  if (!name) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <span className="size-2 rounded-full" style={{ background: color ?? "#888", boxShadow: `0 0 8px ${color ?? "#888"}` }} />
      {name}
    </span>
  );
}

export const HEALTH_COLOR: Record<Health, string> = {
  thriving: "var(--neon-lime)",
  active: "var(--neon-cyan)",
  quiet: "var(--neon-amber)",
  dormant: "oklch(0.6 0.05 270)",
  archived: "var(--neon-red)",
};

const HEALTH_VARIANT = { thriving: "lime", active: "default", quiet: "amber", dormant: "outline", archived: "red" } as const;
const HEALTH_ICON = { thriving: SparklesIcon, active: ZapIcon, quiet: MoonIcon, dormant: MoonIcon, archived: ArchiveIcon };

export function HealthBadge({ health }: { health: Health }) {
  const Icon = HEALTH_ICON[health];
  return (
    <Tooltip content={HEALTH_HINT[health]}>
      <Badge variant={HEALTH_VARIANT[health]}>
        <Icon />
        {HEALTH_LABEL[health]}
      </Badge>
    </Tooltip>
  );
}

export function GrowthBadge({ d, estimated, label = "7d" }: { d: number | null; estimated?: boolean; label?: string }) {
  if (d == null || d <= 0) return null;
  return (
    <Tooltip content={`${estimated ? "Estimated " : ""}new stars in the last ${label === "7d" ? "7 days" : "30 days"}`}>
      <Badge variant="magenta" className="font-mono">
        <FlameIcon />
        {fmtDelta(d)}
        <span className="opacity-60">{label}</span>
      </Badge>
    </Tooltip>
  );
}

export function SectionTitle({ children, hint, right }: { children: React.ReactNode; hint?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold tracking-[0.18em] text-foreground/90 uppercase">{children}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

export function PageHeader({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="neon-text text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
