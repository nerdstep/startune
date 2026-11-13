import { useEffect, useMemo, useRef, useState } from "react";
import { countAt } from "@shared/own";
import type { EOwn } from "@/lib/mine";
import { HEALTH_CHART, HEALTH_CLASS } from "@/lib/palette";
import { fmtNum } from "@/lib/utils";
import { DORMANT_ALPHA } from "./star-field";

/*
 * Star history: each of your repos as a trail of its stargazers over time (log scale), ending in its star
 * at "now". All time is cumulative; the 1-year and 90-day views rebase to stars gained in the window, so a
 * small repo's good quarter isn't flattened by a big repo's history.
 */

export type Range = "all" | "1y" | "90d";

const DAY = 86_400_000;
const PAD = { l: 48, r: 168, t: 28, b: 34 };
const LABELS = 7;

interface Line {
  r: EOwn;
  pts: Array<[number, number]>;
  end: number;
}

/** A five-point star as SVG polygon points (the callout glyph, as on the Star Field). */
function starPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

const month = new Intl.DateTimeFormat("en-US", { month: "short" });
const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const short = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function HistoryChart({
  repos,
  range,
  focusId,
  pinnedId,
  onFocus,
}: {
  repos: EOwn[];
  range: Range;
  /** The repo the page is focused on (lit until cleared). */
  focusId: string | null;
  /** A repo hovered elsewhere (the table), lit while hovered. */
  pinnedId: string | null;
  onFocus: (id: string) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 320 });
  const [hover, setHover] = useState<{ id: string; t: number } | null>(null);
  const { w } = size;
  // Fills whatever height its panel gives it (the row is as tall as the panel beside it), within reason.
  const h = Math.round(Math.max(260, Math.min(520, size.h)));
  const narrow = w < 560;
  const padR = narrow ? 20 : PAD.r;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e!.contentRect.width), h: Math.round(e!.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { lines, t0, now, yMax } = useMemo(() => {
    const now = Date.now();
    const charted = repos.filter((r) => r.history && r.history.length > 0);
    const first = charted.length ? Math.min(...charted.map((r) => r.history![0]![0])) : now - 365 * DAY;
    const t0 = range === "all" ? first - (now - first) * 0.02 : now - (range === "1y" ? 365 : 90) * DAY;
    const lines: Line[] = charted
      .map((r) => {
        const hist = r.history!;
        const base = range === "all" ? 0 : countAt(hist, t0);
        const pts: Array<[number, number]> = [[t0, Math.max(0, countAt(hist, t0) - base)]];
        for (const p of hist) if (p[0] > t0) pts.push([p[0], p[1] - base]);
        if (pts[pts.length - 1]![0] < now) pts.push([now, pts[pts.length - 1]![1]]);
        return { r, pts, end: Math.round(pts[pts.length - 1]![1]) };
      })
      .filter((l) => l.end > 0);
    const yMax = Math.max(Math.log10(11), ...lines.map((l) => Math.log10(1 + l.end))) + 0.12;
    return { lines, t0, now, yMax };
  }, [repos, range]);

  const sx = (t: number) => PAD.l + ((t - t0) / (now - t0)) * (w - PAD.l - padR);
  const sy = (v: number) => h - PAD.b - (Math.log10(1 + Math.max(0, v)) / yMax) * (h - PAD.t - PAD.b);
  const ts = (x: number) => t0 + ((x - PAD.l) / (w - PAD.l - padR)) * (now - t0);

  const activeId = hover?.id ?? pinnedId ?? focusId;
  const active = activeId ? lines.find((l) => l.r.id === activeId) : undefined;

  // Right-gutter labels: the biggest trails (plus the active one), relaxed so they never overlap.
  const labels = useMemo(() => {
    if (narrow) return [];
    const pick = [...lines].sort((a, b) => b.end - a.end).slice(0, LABELS);
    if (active && !pick.includes(active)) pick.push(active);
    const out = pick.map((l) => ({ l, y0: sy(l.end), y: sy(l.end) })).sort((a, b) => a.y0 - b.y0);
    const GAP = 15;
    for (let i = 1; i < out.length; i++) out[i]!.y = Math.max(out[i]!.y, out[i - 1]!.y + GAP);
    const bottom = h - PAD.b;
    if (out.length && out[out.length - 1]!.y > bottom) {
      out[out.length - 1]!.y = bottom;
      for (let i = out.length - 2; i >= 0; i--) out[i]!.y = Math.min(out[i]!.y, out[i + 1]!.y - GAP);
    }
    return out;
    // sy depends on h and yMax only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, active, narrow, h, yMax]);

  const xTicks = useMemo(() => {
    const out: Array<{ t: number; label: string }> = [];
    const span = now - t0;
    const d = new Date(t0);
    if (span > 2.5 * 365 * DAY) {
      const years = new Date(now).getFullYear() - d.getFullYear();
      const step = Math.max(1, Math.ceil(years / (narrow ? 4 : 10)));
      for (let y = d.getFullYear() + 1; y <= new Date(now).getFullYear(); y++)
        if ((y - d.getFullYear() - 1) % step === 0) out.push({ t: new Date(y, 0, 1).getTime(), label: String(y) });
    } else {
      const months = Math.ceil(span / (30 * DAY));
      const step = Math.max(1, Math.ceil(months / (narrow ? 4 : 8)));
      const m = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      for (let i = 0; m.getTime() < now; i++, m.setMonth(m.getMonth() + 1)) {
        if (i % step) continue;
        out.push({ t: m.getTime(), label: m.getMonth() === 0 ? String(m.getFullYear()) : month.format(m) });
      }
    }
    return out;
  }, [t0, now, narrow]);
  const yTicks = [0, 10, 100, 1e3, 1e4, 1e5, 1e6].filter((v) => Math.log10(1 + v) <= yMax);

  const path = (l: Line) => {
    let d = "";
    for (const [t, v] of l.pts) d += `${d ? "L" : "M"}${sx(t).toFixed(1)},${sy(v).toFixed(1)}`;
    return d;
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - box.left;
    const my = e.clientY - box.top;
    if (mx < PAD.l || mx > w - padR + 8) return setHover(null);
    const t = Math.min(now, ts(mx));
    let best: Line | null = null;
    let bd = 18;
    for (const l of lines) {
      // A trail has nothing to say before its first star (it only rests on the baseline there).
      if (l.r.history?.length && t < l.r.history[0]![0]) {
        continue;
      }
      const dy = Math.abs(sy(countAt(l.pts, t)) - my);
      if (dy < bd) {
        bd = dy;
        best = l;
      }
    }
    setHover(best ? { id: best.r.id, t } : null);
  };

  const base = range === "all" ? null : short.format(t0);
  const callout = (() => {
    if (!hover || !active) return null;
    const v = Math.round(countAt(active.pts, hover.t));
    const x = sx(hover.t);
    const y = sy(v);
    const sampled = active.r.exactSince != null && hover.t < active.r.exactSince && v > 0;
    const BW = Math.min(214, w - 8);
    // Beside the point, out of the label gutter; on narrow screens above or below it instead, since
    // there is no room beside. Either way the box is clamped inside the chart.
    const right = x + 16 + BW < sx(now) - 4;
    const side = right ? x + 16 : x - 16 - BW;
    const bx = Math.max(4, Math.min(narrow ? x - BW / 2 : side, w - BW - 4));
    const by = narrow ? (y - 56 > 4 ? y - 56 : Math.min(y + 14, h - PAD.b - 44)) : Math.max(4, Math.min(y - 46, h - PAD.b - 44));
    return (
      <g pointerEvents="none">
        <line x1={x} x2={x} y1={PAD.t} y2={h - PAD.b} stroke="var(--grid-strong)" strokeDasharray="3 3" />
        <circle cx={x} cy={y} r={4.5} fill="none" stroke="var(--primary)" strokeWidth={1.2} />
        <rect x={bx + 0.5} y={by + 0.5} width={BW} height={40} fill="var(--background)" stroke="var(--primary)" />
        <text x={bx + 11} y={by + 17} className="fill-foreground text-[12px] font-semibold">
          {active.r.name.length > 26 ? `${active.r.name.slice(0, 25)}…` : active.r.name}
        </text>
        <polygon points={starPoints(bx + 15, by + 28, 4)} fill={HEALTH_CHART[active.r.health]} />
        <text x={bx + 24} y={by + 32} className="fill-muted-foreground font-mono text-[11px]">
          {sampled ? "≈" : ""}
          {base ? `+${fmtNum(v)}` : fmtNum(v)} · {day.format(hover.t)}
        </text>
      </g>
    );
  })();

  const top = [...lines].sort((a, b) => b.end - a.end)[0];

  return (
    <div ref={wrap} className="relative min-h-[280px] flex-1">
      <svg
        width={w}
        height={h}
        className="absolute inset-0 block w-full"
        role="img"
        aria-label={
          lines.length
            ? `Star history of ${lines.length} repositories${base ? `, stars gained since ${base}` : ""}. Most: ${top!.r.name} with ${fmtNum(top!.end)}.`
            : "Star history: nothing to draw yet."
        }
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onClick={() => hover && onFocus(hover.id)}
        style={{ cursor: hover ? "pointer" : "default" }}
      >
        {xTicks.map(({ t, label }) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={PAD.t} y2={h - PAD.b} stroke="var(--grid)" />
            <text x={sx(t)} y={h - PAD.b + 16} textAnchor="middle" className="fill-muted-foreground font-mono text-[11px]">
              {label}
            </text>
          </g>
        ))}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={w - padR} y1={sy(v)} y2={sy(v)} stroke="var(--grid)" />
            <text x={PAD.l - 8} y={sy(v) + 4} textAnchor="end" className="fill-muted-foreground font-mono text-[11px]">
              {fmtNum(v)}
            </text>
          </g>
        ))}
        <path d={`M${PAD.l},${PAD.t} V${h - PAD.b} H${w - padR}`} fill="none" stroke="var(--grid-strong)" />
        <text x={PAD.l - 36} y={PAD.t - 12} className="fill-foreground text-[11px] font-medium">
          {base ? `Stars gained since ${base}` : "Stargazers"} (log)
        </text>

        {/* trails */}
        {lines.map((l) => {
          const on = l === active;
          const c = HEALTH_CHART[l.r.health];
          const dim = active && !on;
          return (
            <path
              key={l.r.id}
              d={path(l)}
              fill="none"
              stroke={on ? "var(--primary)" : c}
              strokeWidth={on ? 1.8 : 1.2}
              strokeDasharray={l.r.health === "archived" ? "3 3" : undefined}
              strokeLinejoin="round"
              opacity={on ? 1 : dim ? 0.16 : 0.75 * (l.r.health === "dormant" ? DORMANT_ALPHA : 1)}
            />
          );
        })}
        {/* each trail ends in its star */}
        {lines.map((l) => {
          const on = l === active;
          const c = HEALTH_CHART[l.r.health];
          const r = 1.8 + (Math.log10(1 + l.r.stars) / 5) * 2.6;
          const archived = l.r.health === "archived";
          return (
            <g key={`e${l.r.id}`} opacity={active && !on ? 0.3 : 1}>
              <circle
                cx={sx(now)}
                cy={sy(l.end)}
                r={r}
                fill={archived ? "var(--background)" : c}
                stroke={archived ? c : "none"}
                opacity={l.r.health === "dormant" ? DORMANT_ALPHA : 1}
              />
              {on && <circle cx={sx(now)} cy={sy(l.end)} r={r + 3} fill="none" stroke="var(--primary)" strokeWidth={1.2} />}
            </g>
          );
        })}
        {labels.map(({ l, y0, y }) => {
          const on = l === active;
          const x = sx(now);
          return (
            <g key={`l${l.r.id}`} opacity={active && !on ? 0.45 : 1}>
              {Math.abs(y - y0) > 1 && <path d={`M${x + 6},${y0} L${x + 12},${y} H${x + 16}`} fill="none" stroke="var(--dim-leader)" />}
              <text x={x + 18} y={y + 4} className={on ? "fill-foreground text-[12px] font-semibold" : "fill-foreground text-[12px]"}>
                {l.r.name.length > 14 ? `${l.r.name.slice(0, 13)}…` : l.r.name}
              </text>
              <text x={w - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground font-mono text-[11px]">
                {base ? "+" : ""}
                {fmtNum(l.end)}
              </text>
            </g>
          );
        })}
        {callout}
      </svg>
      <span className="sr-only" aria-live="polite">
        {active && hover
          ? `${active.r.fullName}: ${base ? `${fmtNum(active.end)} stars gained since ${base}` : `${fmtNum(active.end)} stargazers`}, class ${HEALTH_CLASS[active.r.health]}`
          : ""}
      </span>
    </div>
  );
}
