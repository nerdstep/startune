import { useMemo, useRef, useState } from "react";
import { HEALTH_LABEL, HEALTH_ORDER, type Health } from "@shared/scoring";
import { HEALTH_CHART } from "@/lib/palette";
import type { EStar } from "@/lib/queries";
import { cn } from "@/lib/utils";

function Legend({ items, className }: { items: Array<{ key: string; label: string; color: string; value?: string }>; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground", className)}>
      {items.map((i) => (
        <li key={i.key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: i.color }} />
          <span>{i.label}</span>
          {i.value && <span className="font-mono text-foreground">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}

function Tip({ x, y, children }: { x: number | string; y: number; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg border border-primary/30 bg-popover px-3 py-2 text-xs shadow-[0_0_24px_-8px_var(--neon-cyan)] backdrop-blur-xl"
      style={{ left: x, top: y }}
    >
      {children}
    </div>
  );
}

function TipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="h-0.5 w-3 rounded-full" style={{ background: color }} />
      <span className="font-mono font-semibold text-foreground">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

/* ---------- Health: one segmented bar ---------- */

export function HealthBar({ stars, onPick }: { stars: EStar[]; onPick?: (h: Health) => void }) {
  const counts = useMemo(() => {
    const m = new Map<Health, number>(HEALTH_ORDER.map((h) => [h, 0]));
    for (const s of stars) m.set(s.health, (m.get(s.health) ?? 0) + 1);
    return m;
  }, [stars]);
  const total = stars.length || 1;
  const [hover, setHover] = useState<{ h: Health; x: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div ref={ref} className="relative flex h-4 gap-[2px]" onPointerLeave={() => setHover(null)}>
        {HEALTH_ORDER.map((h) => {
          const n = counts.get(h) ?? 0;
          if (!n) return null;
          return (
            <button
              key={h}
              aria-label={`${HEALTH_LABEL[h]}: ${n}`}
              onClick={() => onPick?.(h)}
              onPointerMove={(e) => {
                const r = ref.current!.getBoundingClientRect();
                setHover({ h, x: e.clientX - r.left });
              }}
              onFocus={(e) => {
                const r = ref.current!.getBoundingClientRect();
                const b = e.currentTarget.getBoundingClientRect();
                setHover({ h, x: b.left - r.left + b.width / 2 });
              }}
              onBlur={() => setHover(null)}
              className="h-full rounded-[4px] transition-[filter] first:rounded-l-full last:rounded-r-full hover:brightness-125 focus-visible:brightness-125 focus-visible:outline-none"
              style={{ width: `${(n / total) * 100}%`, background: HEALTH_CHART[h], boxShadow: `0 0 14px -2px ${HEALTH_CHART[h]}` }}
            />
          );
        })}
        {hover && (
          <Tip x={hover.x} y={0}>
            <TipRow color={HEALTH_CHART[hover.h]} label={HEALTH_LABEL[hover.h]} value={`${counts.get(hover.h)} · ${Math.round(((counts.get(hover.h) ?? 0) / total) * 100)}%`} />
          </Tip>
        )}
      </div>
      <Legend
        className="mt-3"
        items={HEALTH_ORDER.map((h) => ({ key: h, label: HEALTH_LABEL[h], color: HEALTH_CHART[h], value: String(counts.get(h) ?? 0) }))}
      />
    </div>
  );
}

/* ---------- Stars per year, stacked by health ---------- */

export function YearChart({ stars, onPick }: { stars: EStar[]; onPick?: (year: number) => void }) {
  const years = useMemo(() => {
    const m = new Map<number, Record<Health, number>>();
    for (const s of stars) {
      const y = new Date(s.starredAt).getFullYear();
      const row = m.get(y) ?? { thriving: 0, active: 0, quiet: 0, dormant: 0, archived: 0 };
      row[s.health]++;
      m.set(y, row);
    }
    const ys = [...m.keys()];
    if (!ys.length) return [];
    const out = [];
    for (let y = Math.min(...ys); y <= Math.max(...ys); y++) out.push({ year: y, ...(m.get(y) ?? { thriving: 0, active: 0, quiet: 0, dormant: 0, archived: 0 }) });
    return out;
  }, [stars]);
  const [hover, setHover] = useState<number | null>(null);

  const W = 640;
  const H = 200;
  const pad = { l: 28, r: 4, t: 8, b: 22 };
  const max = Math.max(1, ...years.map((y) => HEALTH_ORDER.reduce((a, h) => a + y[h], 0)));
  const step = (W - pad.l - pad.r) / Math.max(years.length, 1);
  const bw = Math.min(28, step * 0.62);
  const sy = (v: number) => ((H - pad.t - pad.b) * v) / max;
  const ticks = [0, Math.round(max / 2), max];
  const hovered = years.find((y) => y.year === hover);

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label="Stars added per year, by repo health">
        <defs>
          <filter id="barglow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={H - pad.b - sy(t)} y2={H - pad.b - sy(t)} stroke="currentColor" className="text-white/[0.06]" />
            <text x={pad.l - 6} y={H - pad.b - sy(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
              {t}
            </text>
          </g>
        ))}
        {years.map((y, i) => {
          const x = pad.l + i * step + (step - bw) / 2;
          let acc = 0;
          const total = HEALTH_ORDER.reduce((a, h) => a + y[h], 0);
          const segs = HEALTH_ORDER.filter((h) => y[h] > 0);
          return (
            <g
              key={y.year}
              tabIndex={0}
              role="button"
              aria-label={`${y.year}: ${total} stars`}
              className="cursor-pointer outline-none"
              onPointerEnter={() => setHover(y.year)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(y.year)}
              onBlur={() => setHover(null)}
              onClick={() => onPick?.(y.year)}
              opacity={hover == null || hover === y.year ? 1 : 0.45}
            >
              <rect x={pad.l + i * step} y={pad.t} width={step} height={H - pad.t - pad.b} fill="transparent" />
              {segs.map((h, j) => {
                const hgt = sy(y[h]);
                const top = H - pad.b - acc - hgt;
                acc += hgt;
                const isTop = j === segs.length - 1;
                return (
                  <path
                    key={h}
                    d={roundedTop(x, top, bw, Math.max(hgt - (j > 0 ? 2 : 0), 1), isTop ? 4 : 0)}
                    fill={HEALTH_CHART[h]}
                    filter={hover === y.year ? "url(#barglow)" : undefined}
                  />
                );
              })}
              {(years.length <= 14 || i % 2 === 0) && (
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
                  {String(y.year).slice(2).padStart(2, "0")}
                  <tspan className="opacity-0">'</tspan>
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hovered && (
        <Tip x={`${((pad.l + years.indexOf(hovered) * step + step / 2) / W) * 100}%`} y={20}>
          <div className="mb-1 font-semibold text-foreground">
            {hovered.year} · {HEALTH_ORDER.reduce((a, h) => a + hovered[h], 0)} stars
          </div>
          {[...HEALTH_ORDER].reverse().map((h) => (
            <TipRow key={h} color={HEALTH_CHART[h]} label={HEALTH_LABEL[h]} value={String(hovered[h])} />
          ))}
        </Tip>
      )}
      <Legend className="mt-2" items={HEALTH_ORDER.map((h) => ({ key: h, label: HEALTH_LABEL[h], color: HEALTH_CHART[h] }))} />
    </div>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}
