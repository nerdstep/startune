import { useMemo, useState } from "react";
import { HEALTH_CHART } from "@/lib/palette";
import type { EStar } from "@/lib/queries";
import { DORMANT_ALPHA } from "./star-field";

/** Shared axes so every constellation on a page is drawn on the same sky. */
export interface SkyDomain {
  minT: number;
  maxT: number;
  maxLog: number;
}

export function skyDomain(stars: EStar[]): SkyDomain {
  const now = Date.now();
  const ts = stars.map((s) => new Date(s.starredAt).getTime());
  return {
    minT: Math.min(...ts, now - 365 * 86_400_000),
    maxT: now,
    maxLog: Math.max(2, ...stars.map((s) => Math.log10(Math.max(1, s.stars)))),
  };
}

const W = 320;
const H = 100;
const PAD = 8;

/**
 * A List drawn as a constellation: its repos placed by when you starred them (left to right) and how
 * popular they are (bottom to top), joined by the shortest lines that connect them all.
 */
export function Constellation({ stars, domain, onOpen, label }: { stars: EStar[]; domain: SkyDomain; onOpen?: (id: string) => void; label: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const { pts, edges } = useMemo(() => {
    const pts = stars.map((s) => {
      const lg = Math.log10(Math.max(1, s.stars));
      return {
        s,
        x: PAD + ((new Date(s.starredAt).getTime() - domain.minT) / (domain.maxT - domain.minT)) * (W - PAD * 2),
        y: H - PAD - (lg / domain.maxLog) * (H - PAD * 2),
        r: 1.2 + (lg / domain.maxLog) * 3,
      };
    });
    // Minimum spanning tree (Prim) over the brightest 80, so big lists stay readable.
    const top = [...pts].sort((a, b) => b.s.stars - a.s.stars).slice(0, 80);
    const edges: Array<[number, number, number, number]> = [];
    if (top.length > 1) {
      const inTree = new Set([0]);
      const dist = top.map((p) => (p.x - top[0]!.x) ** 2 + (p.y - top[0]!.y) ** 2);
      const from = top.map(() => 0);
      while (inTree.size < top.length) {
        let k = -1;
        for (let i = 0; i < top.length; i++) if (!inTree.has(i) && (k < 0 || dist[i]! < dist[k]!)) k = i;
        inTree.add(k);
        const a = top[from[k]!]!;
        const b = top[k]!;
        edges.push([a.x, a.y, b.x, b.y]);
        for (let i = 0; i < top.length; i++) {
          if (inTree.has(i)) continue;
          const d = (top[i]!.x - b.x) ** 2 + (top[i]!.y - b.y) ** 2;
          if (d < dist[i]!) {
            dist[i] = d;
            from[i] = k;
          }
        }
      }
    }
    return { pts, edges };
  }, [stars, domain]);

  return (
    <svg viewBox={`0 0 ${W} ${H + 10}`} className="block h-auto w-full overflow-visible" role="img" aria-label={label}>
      <line x1={PAD} x2={W - PAD} y1={H - PAD + 4} y2={H - PAD + 4} stroke="var(--grid-strong)" strokeWidth={1} />
      <text x={PAD} y={H + 6} className="fill-muted-foreground font-mono text-[11px]">
        {new Date(domain.minT).getFullYear()}
      </text>
      <text x={W - PAD} y={H + 6} textAnchor="end" className="fill-muted-foreground font-mono text-[11px]">
        now
      </text>
      {edges.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--grid-strong)" strokeWidth={0.8} />
      ))}
      {pts.map((p) => {
        const c = HEALTH_CHART[p.s.health];
        const archived = p.s.health === "archived";
        const on = hover === p.s.id;
        return (
          <g
            key={p.s.id}
            className={onOpen ? "cursor-pointer" : undefined}
            onMouseEnter={() => setHover(p.s.id)}
            onMouseLeave={() => setHover(null)}
            onClick={onOpen ? (e) => (e.preventDefault(), e.stopPropagation(), onOpen(p.s.id)) : undefined}
          >
            <title>{`${p.s.fullName} · ${p.s.stars.toLocaleString()} stars`}</title>
            <circle cx={p.x} cy={p.y} r={7} fill="transparent" />
            <circle
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill={archived ? "none" : c}
              stroke={archived ? c : "none"}
              strokeWidth={archived ? 1 : 0}
              opacity={p.s.health === "dormant" ? DORMANT_ALPHA : 1}
            />
            {on && <circle cx={p.x} cy={p.y} r={p.r + 2.5} fill="none" stroke="var(--primary)" strokeWidth={1} />}
          </g>
        );
      })}
    </svg>
  );
}
