import { createFileRoute } from "@tanstack/react-router";
import { scaleLog, scaleTime } from "d3-scale";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import { LocateFixedIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { HEALTH_LABEL, HEALTH_ORDER, type Health } from "@shared/scoring";
import { PageHeader } from "@/components/bits";
import { useOpenRepo } from "@/components/repo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CATEGORICAL_3, HEALTH_CHART, OTHER } from "@/lib/palette";
import { useDerived, type EStar } from "@/lib/queries";
import { ago, cn, fmtNum } from "@/lib/utils";

export const Route = createFileRoute("/map")({ component: StarMap });

type ColorBy = "health" | "language";

interface Pt {
  s: EStar;
  bx: number;
  by: number;
  r: number;
  key: string;
  color: string;
  hollow: boolean;
  alpha: number;
}

const PAD = { l: 44, r: 16, t: 16, b: 28 };

function StarMap() {
  const { data, isLoading } = useDerived();
  const open = useOpenRepo();
  const [colorBy, setColorBy] = useState<ColorBy>("health");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [size, setSize] = useState({ w: 800, h: 520 });
  const [t, setT] = useState<ZoomTransform>(zoomIdentity);
  const [hover, setHover] = useState<Pt | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const zoomRef = useRef<ReturnType<typeof zoom<HTMLCanvasElement, unknown>> | null>(null);

  // Top 3 languages get validated hues; the rest fold into "Other".
  const langs = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data?.stars ?? []) if (s.language) m.set(s.language, (m.get(s.language) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l]) => l);
  }, [data]);

  const legend = useMemo(
    () =>
      colorBy === "health"
        ? HEALTH_ORDER.map((h) => ({ key: h, label: HEALTH_LABEL[h], color: HEALTH_CHART[h], hollow: h === "archived" }))
        : [...langs.map((l, i) => ({ key: l, label: l, color: CATEGORICAL_3[i]!, hollow: false })), { key: "other", label: "Other", color: OTHER, hollow: false }],
    [colorBy, langs],
  );

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e!.contentRect.width;
      setSize({ w, h: Math.max(360, Math.min(640, w * 0.62)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLoading]);

  const scales = useMemo(() => {
    const stars = data?.stars ?? [];
    const times = stars.map((s) => new Date(s.starredAt).getTime());
    const min = Math.min(...times, Date.now() - 365 * 86_400_000);
    const max = Date.now() + 15 * 86_400_000;
    const maxStars = Math.max(10, ...stars.map((s) => s.stars));
    return {
      x: scaleTime().domain([new Date(min - 30 * 86_400_000), new Date(max)]).range([PAD.l, size.w - PAD.r]),
      y: scaleLog().domain([1, maxStars * 1.4]).range([size.h - PAD.b, PAD.t]),
    };
  }, [data, size]);

  const points = useMemo<Pt[]>(() => {
    if (!data) return [];
    const langIdx = new Map(langs.map((l, i) => [l, i]));
    return data.stars.map((s) => {
      const key = colorBy === "health" ? s.health : s.language && langIdx.has(s.language) ? s.language : "other";
      const color = colorBy === "health" ? HEALTH_CHART[s.health] : s.language && langIdx.has(s.language) ? CATEGORICAL_3[langIdx.get(s.language)!]! : OTHER;
      // Secondary encoding for health: archived = hollow ring, dormant = dimmer
      const hollow = s.health === "archived";
      const alpha = s.health === "dormant" || s.health === "archived" ? 0.55 : 0.95;
      const r = 2.5 + Math.min(4, Math.log10(Math.max(s.stars, 1)) * 0.8);
      return { s, bx: scales.x(new Date(s.starredAt)), by: scales.y(Math.max(1, s.stars)), r, key, color, hollow, alpha };
    });
  }, [data, colorBy, langs, scales]);

  // d3-zoom on the canvas
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const z = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, 24])
      .translateExtent([
        [0, 0],
        [size.w, size.h],
      ])
      .on("zoom", (e: { transform: ZoomTransform }) => setT(e.transform));
    zoomRef.current = z;
    select(el).call(z);
    return () => void select(el).on(".zoom", null);
  }, [size, isLoading]);

  // Paint
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio, 2);
    el.width = size.w * dpr;
    el.height = size.h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);

    const x = t.rescaleX(scales.x);
    const y = t.rescaleY(scales.y);

    // Recessive grid
    ctx.font = "10px 'Geist Mono Variable', monospace";
    ctx.fillStyle = "rgba(200,210,255,0.45)";
    ctx.strokeStyle = "rgba(200,210,255,0.06)";
    ctx.lineWidth = 1;
    for (const tick of x.ticks(Math.max(3, Math.floor(size.w / 110)))) {
      const px = x(tick);
      if (px < PAD.l || px > size.w - PAD.r) continue;
      ctx.beginPath();
      ctx.moveTo(px, PAD.t);
      ctx.lineTo(px, size.h - PAD.b);
      ctx.stroke();
      ctx.textAlign = "center";
      ctx.fillText(x.tickFormat()(tick), px, size.h - 10);
    }
    let lastY = Infinity;
    for (const v of [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7]) {
      const py = y(v);
      if (py < PAD.t + 4 || py > size.h - PAD.b || lastY - py < 18) continue;
      lastY = py;
      ctx.beginPath();
      ctx.moveTo(PAD.l, py);
      ctx.lineTo(size.w - PAD.r, py);
      ctx.stroke();
      ctx.textAlign = "right";
      ctx.fillText(fmtNum(v), PAD.l - 6, py + 3);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD.l, PAD.t, size.w - PAD.l - PAD.r, size.h - PAD.t - PAD.b);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    const k = Math.sqrt(t.k);
    for (const p of points) {
      if (hidden.has(p.key)) continue;
      const px = t.applyX(p.bx);
      const py = t.applyY(p.by);
      if (px < 0 || px > size.w || py < 0 || py > size.h) continue;
      const r = p.r * Math.min(k, 2.2);
      // glow halo
      const g = ctx.createRadialGradient(px, py, 0, px, py, r * 3.2);
      g.addColorStop(0, hexA(p.color, 0.35 * p.alpha));
      g.addColorStop(1, hexA(p.color, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      if (p.hollow) {
        ctx.strokeStyle = hexA(p.color, p.alpha);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.fillStyle = hexA(p.color, p.alpha);
        ctx.fill();
      }
    }
    ctx.restore();

    if (hover && !hidden.has(hover.key)) {
      const px = t.applyX(hover.bx);
      const py = t.applyY(hover.by);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, hover.r * Math.min(k, 2.2) + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, [points, t, size, hidden, hover, scales]);

  const nearest = (mx: number, my: number): Pt | null => {
    let best: Pt | null = null;
    let bd = 18 * 18; // 18px hit radius: bigger than the mark
    for (const p of points) {
      if (hidden.has(p.key)) continue;
      const dx = t.applyX(p.bx) - mx;
      const dy = t.applyY(p.by) - my;
      const d = dx * dx + dy * dy;
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  };

  const visibleCount = points.filter((p) => !hidden.has(p.key)).length;

  return (
    <>
      <PageHeader title="Star map" sub="Every star you've given, placed by when you starred it (→) and how popular it is (↑). Scroll to zoom, drag to pan.">
        <Tabs value={colorBy} onValueChange={(v) => (setColorBy(v as ColorBy), setHidden(new Set()))}>
          <TabsList>
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="language">Language</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="outline" size="sm" onClick={() => canvas.current && zoomRef.current && select(canvas.current).call(zoomRef.current.transform, zoomIdentity)}>
          <LocateFixedIcon /> Reset
        </Button>
      </PageHeader>

      {isLoading ? (
        <Skeleton className="h-[520px]" />
      ) : (
        <Card spotlight={false} className="gap-3 p-3 md:p-4">
          <div className="flex flex-wrap items-center gap-2 px-1">
            {legend.map((l) => {
              const off = hidden.has(l.key);
              return (
                <button
                  key={l.key}
                  onClick={() =>
                    setHidden((h) => {
                      const n = new Set(h);
                      if (n.has(l.key)) n.delete(l.key);
                      else n.add(l.key);
                      return n;
                    })
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs transition",
                    off ? "opacity-40" : "bg-white/[0.04] hover:bg-white/[0.08]",
                  )}
                  aria-pressed={!off}
                >
                  <span className="size-2.5 rounded-full" style={l.hollow ? { boxShadow: `inset 0 0 0 1.5px ${l.color}` } : { background: l.color, boxShadow: `0 0 8px ${l.color}` }} />
                  {l.label}
                </button>
              );
            })}
            <span className="ml-auto font-mono text-xs text-muted-foreground">{visibleCount.toLocaleString()} stars</span>
          </div>
          <div ref={wrap} className="relative w-full">
            <canvas
              ref={canvas}
              style={{ width: size.w, height: size.h }}
              className={cn("block touch-none rounded-xl bg-black/20", hover ? "cursor-pointer" : "cursor-grab active:cursor-grabbing")}
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setHover(nearest(e.clientX - r.left, e.clientY - r.top));
              }}
              onPointerLeave={() => setHover(null)}
              onClick={() => hover && open(hover.s.id)}
              role="img"
              aria-label="Scatter plot of starred repositories by star date and popularity. Use the Stars page for a list view."
            />
            {hover && <MapTip p={hover} t={t} w={size.w} />}
          </div>
          <p className="px-1 text-xs text-muted-foreground">
            Left side = your oldest stars. Hollow rings are archived, faded dots are dormant. Click a star to open it.
          </p>
        </Card>
      )}
    </>
  );
}

function MapTip({ p, t, w }: { p: Pt; t: ZoomTransform; w: number }) {
  const x = t.applyX(p.bx);
  const y = t.applyY(p.by);
  const left = x > w - 220;
  return (
    <div
      className="pointer-events-none absolute z-10 w-56 rounded-xl border border-primary/30 bg-popover p-3 text-xs shadow-[0_0_30px_-8px_var(--neon-cyan)] backdrop-blur-xl"
      style={{ left: left ? x - 236 : x + 16, top: Math.max(0, y - 40) }}
    >
      <div className="font-mono text-sm font-semibold text-foreground">{fmtNum(p.s.stars)}★</div>
      <div className="mt-0.5 truncate font-medium text-foreground">{p.s.fullName}</div>
      <div className="mt-1 line-clamp-2 text-muted-foreground">{p.s.description}</div>
      <div className="mt-2 flex items-center gap-2 text-muted-foreground">
        <span className="h-0.5 w-3 rounded-full" style={{ background: HEALTH_CHART[p.s.health as Health] }} />
        {HEALTH_LABEL[p.s.health]} · starred {ago(p.s.starredAt)}
      </div>
    </div>
  );
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
