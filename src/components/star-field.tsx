import { LocateFixedIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HEALTH_LABEL, type Health } from "@shared/scoring";
import { ACCENT, CATEGORICAL_3, HEALTH_CHART, HEALTH_CLASS, OTHER } from "@/lib/palette";
import type { EStar } from "@/lib/queries";
import { fmtNum } from "@/lib/utils";

/*
 * A 3D point cloud of the library. Axes are honest:
 *   x  when you starred it   ·   y  popularity (log stars)   ·   depth  how recently it was pushed (recent = near)
 * Drag (or arrow keys) to orbit, hover to name, click to open. [ and ] step through stars; Enter opens.
 */

interface P3 {
  s: EStar;
  x: number;
  y: number;
  z: number;
  r: number;
}
interface Proj {
  p: P3;
  sx: number;
  sy: number;
  sr: number;
  depth: number;
}
interface Frame {
  kx: number;
  ky: number;
  ox: number;
  oy: number;
}
interface Gutter {
  l: number;
  r: number;
  t: number;
  b: number;
}

const NO_LANGS: string[] = [];
const DEFAULT = { yaw: -0.32, pitch: 0.36 };
const MONTH = 30 * 86_400_000;
const STALE_MONTHS = 48;
const CAM = 3.4;
/** A decision just made in triage: the star brightens and comes forward (keep) or dims and falls back (unstar). */
export interface Outcome {
  star: EStar;
  kind: "keep" | "unstar";
  at: number;
}
const OUTCOME_MS = 450;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

/** Dormant marks are slightly dimmer everywhere they appear (field and swatches). */
export const DORMANT_ALPHA = 0.75;

/** Rotate into camera space. z2 > 0 is farther from the viewer; the camera looks down on the floor. */
function rotate(x: number, y: number, z: number, yaw: number, pitch: number) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const x1 = x * cy - z * sy;
  const z1 = x * sy + z * cy;
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const y2 = y * cp + z1 * sp;
  const z2 = -y * sp + z1 * cp;
  const f = CAM / (CAM + z2);
  return { u: x1 * f, v: -y2 * f, f, depth: z2 };
}

const CORNERS = [-1, 1].flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => [x, y, z] as const)));

/** Fit the projected cube into the canvas, leaving gutters for axis labels. x may stretch (up to 1.7×) to use wide panels. */
function fit(yaw: number, pitch: number, w: number, h: number, g: Gutter): Frame {
  let u0 = Infinity;
  let u1 = -Infinity;
  let v0 = Infinity;
  let v1 = -Infinity;
  for (const [x, y, z] of CORNERS) {
    const r = rotate(x, y, z, yaw, pitch);
    u0 = Math.min(u0, r.u);
    u1 = Math.max(u1, r.u);
    v0 = Math.min(v0, r.v);
    v1 = Math.max(v1, r.v);
  }
  const ky = Math.min((h - g.t - g.b) / (v1 - v0), (w - g.l - g.r) / (u1 - u0));
  const kx = Math.min((w - g.l - g.r) / (u1 - u0), ky * 1.7);
  return {
    kx,
    ky,
    ox: g.l + (w - g.l - g.r - (u1 - u0) * kx) / 2 - u0 * kx,
    oy: g.t + (h - g.t - g.b - (v1 - v0) * ky) / 2 - v0 * ky,
  };
}

export function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  }
  ctx.closePath();
}

export function StarField({
  stars,
  onOpen,
  height: maxHeight = 520,
  focusHealth = null,
  highlightId = null,
  ambient = false,
  compact = false,
  outcome = null,
  insetLeft = 0,
  highlightSet = null,
  ringSet = null,
  pinnedId = null,
  colorBy = "health",
  topLangs = NO_LANGS,
  hiddenKeys = null,
}: {
  stars: EStar[];
  onOpen?: (id: string) => void;
  height?: number;
  /** Isolate one health class: other points dim. */
  focusHealth?: Health | null;
  /** Pin one repo: it keeps the lime ring, drop-line and callout; everything else dims. */
  highlightId?: string | null;
  /** Showcase mode: slow auto-orbit, no hover or open, labelled as sample data. */
  ambient?: boolean;
  /** Small inset: no reset button, axis titles or camera readout. */
  compact?: boolean;
  /** Animate the result of a triage decision on this star (drawn from its own record, so it survives an unstar). */
  outcome?: Outcome | null;
  /** Extra left gutter in px, to frame the cloud clear of content laid over the canvas. */
  insetLeft?: number;
  /** Keep these stars bright and dim the rest (e.g. the rows a filter matches). */
  highlightSet?: Set<string> | null;
  /** Draw a lime ring on each of these (e.g. selected rows). */
  ringSet?: Set<string> | null;
  /** Pin a callout on one star without dimming the others (e.g. the hovered row). */
  pinnedId?: string | null;
  /** Colour points by health class (default) or by language (top three languages plus Other). */
  colorBy?: "health" | "language";
  topLangs?: string[];
  /** Legend keys to hide: health names, or language names / "other". */
  hiddenKeys?: Set<string> | null;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(900);
  const height = Math.round(Math.min(maxHeight, Math.max(320, w * 0.85)));
  const view = useRef({ ...DEFAULT, intro: 0 });
  const vel = useRef({ yaw: 0, pitch: 0 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [hover, setHover] = useState<Proj | null>(null);
  const [cursor, setCursor] = useState(-1);
  const projected = useRef<Proj[]>([]);
  const raf = useRef(0);
  const moving = useRef(false);
  const reduce = useMemo(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  const { points, years, minT, maxT, maxLog, toP3 } = useMemo(() => {
    const now = Date.now();
    const ts = stars.map((s) => new Date(s.starredAt).getTime());
    const minT = Math.min(...ts, now - 365 * 86_400_000);
    const maxT = now;
    const maxLog = Math.max(2, ...stars.map((s) => Math.log10(Math.max(1, s.stars))));
    const points: P3[] = stars.map((s, i) => {
      const pushed = s.pushedAt ? (now - new Date(s.pushedAt).getTime()) / MONTH : STALE_MONTHS;
      const lg = Math.log10(Math.max(1, s.stars));
      return {
        s,
        x: ((ts[i]! - minT) / (maxT - minT)) * 2 - 1,
        y: (lg / maxLog) * 1.8 - 0.9,
        z: Math.min(pushed, STALE_MONTHS) / (STALE_MONTHS / 2) - 1,
        r: 0.7 + (lg / maxLog) * 4.6,
      };
    });
    const years: number[] = [];
    for (let y = new Date(minT).getFullYear() + 1; y <= new Date(maxT).getFullYear(); y++) years.push(y);
    const toP3 = (s: EStar): P3 => {
      const pushed = s.pushedAt ? (now - new Date(s.pushedAt).getTime()) / MONTH : STALE_MONTHS;
      const lg = Math.log10(Math.max(1, s.stars));
      return {
        s,
        x: Math.max(-1, Math.min(1, ((new Date(s.starredAt).getTime() - minT) / (maxT - minT)) * 2 - 1)),
        y: (Math.min(lg, maxLog) / maxLog) * 1.8 - 0.9,
        z: Math.min(pushed, STALE_MONTHS) / (STALE_MONTHS / 2) - 1,
        r: 0.7 + (Math.min(lg, maxLog) / maxLog) * 4.6,
      };
    };
    return { points, years, minT, maxT, maxLog, toP3 };
  }, [stars]);

  const visibleCount = useMemo(() => {
    if (!hiddenKeys || !hiddenKeys.size) return stars.length;
    return stars.filter((s) => !hiddenKeys.has(colorBy === "language" ? (s.language && topLangs.includes(s.language) ? s.language : "other") : s.health))
      .length;
  }, [stars, hiddenKeys, colorBy, topLangs]);
  const risers = useMemo(
    () =>
      [...stars]
        .filter((s) => !s.isArchived)
        .sort((a, b) => (b.g.d7 ?? b.momentum) - (a.g.d7 ?? a.momentum))
        .slice(0, 3)
        .map((s) => s.id),
    [stars],
  );
  /** Keyboard order: the labelled risers first, then by popularity. */
  const order = useMemo(() => {
    const rest = [...stars]
      .sort((a, b) => b.stars - a.stars)
      .map((s) => s.id)
      .filter((id) => !risers.includes(id));
    return [...risers, ...rest];
  }, [stars, risers]);

  const draw = useCallback(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const h = height;
    const dpr = Math.min(window.devicePixelRatio, 2);
    if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const { yaw, intro } = view.current;
    const pitch = view.current.pitch * intro + 0.03 * (1 - intro);
    const wide = w >= 560;
    ctx.font = "500 11px 'Geist Variable', ui-sans-serif, sans-serif";
    const gutter: Gutter = compact
      ? { l: 40, r: 12, t: h < 200 ? 8 : 20, b: h < 200 ? 22 : 30 }
      : {
          l: Math.min(70, Math.max(44, w * 0.09)) + insetLeft,
          r: wide ? ctx.measureText("Pushed recently").width + 24 : 12,
          t: wide ? 64 : 28,
          b: 44,
        };
    const fr = fit(yaw, pitch, w, h, gutter);
    const P = (x: number, y: number, z: number) => {
      const r = rotate(x, y, z, yaw, pitch);
      return { sx: fr.ox + r.u * fr.kx, sy: fr.oy + r.v * fr.ky, scale: r.f, depth: r.depth };
    };
    // Areas callouts must avoid: the Reset button and every axis label drawn below.
    const blocked: Array<{ x: number; y: number; w: number; h: number }> = ambient || compact ? [] : [{ x: w - 124, y: 0, w: 124, h: 44 }];
    const text = (t: string, x: number, y: number, align: CanvasTextAlign) => {
      ctx.textAlign = align;
      ctx.fillText(t, x, y);
      const tw = ctx.measureText(t).width;
      blocked.push({ x: align === "right" ? x - tw : align === "center" ? x - tw / 2 : x, y: y - 11, w: tw, h: 14 });
    };
    const seg = (a: { sx: number; sy: number }, b: { sx: number; sy: number }) => {
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.stroke();
    };
    const tx = (yr: number) => ((new Date(yr, 0, 1).getTime() - minT) / (maxT - minT)) * 2 - 1;
    const ly = (v: number) => (v / maxLog) * 1.8 - 0.9;
    // The popularity axis rides the vertical edge that is leftmost on screen, so it never cuts through the cloud.
    const [ax, az] = (
      [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ] as const
    ).reduce((a, b) => (P(b[0], -1, b[1]).sx < P(a[0], -1, a[1]).sx ? b : a));

    // Back wall (z = +1, the stale side) and floor (y = -1).
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#16191c";
    for (let v = 0; v <= maxLog; v++) seg(P(-1, ly(v), 1), P(1, ly(v), 1));
    for (const yr of years) seg(P(tx(yr), -1, 1), P(tx(yr), 1, 1));
    ctx.strokeStyle = "#1c1f23";
    for (const yr of years) seg(P(tx(yr), -1, -1), P(tx(yr), -1, 1));
    for (let i = 0; i <= 4; i++) seg(P(-1, -1, -1 + i * 0.5), P(1, -1, -1 + i * 0.5));
    ctx.strokeStyle = "#2c3036";
    seg(P(-1, -1, -1), P(1, -1, -1));
    seg(P(-1, -1, 1), P(1, -1, 1));
    seg(P(-1, -1, -1), P(-1, -1, 1));
    seg(P(1, -1, -1), P(1, -1, 1));
    seg(P(ax, -1, az), P(ax, 1, az));

    // Axis ticks and titles.
    ctx.font = "11px 'Geist Mono Variable', ui-monospace, monospace";
    ctx.fillStyle = "#8d938f";
    ctx.textAlign = "center";
    let lastX = -Infinity;
    for (const yr of years) {
      const a = P(tx(yr), -1, -1);
      if (Math.abs(a.sx - lastX) < 40) continue;
      lastX = a.sx;
      text(String(yr), a.sx, a.sy + 16, "center");
    }
    ctx.textAlign = "right";
    ctx.strokeStyle = "#2c3036";
    for (let v = 0; v <= maxLog; v++) {
      const a = P(ax, ly(v), az);
      seg({ sx: a.sx - 4, sy: a.sy }, a);
      text(fmtNum(10 ** v), a.sx - 7, a.sy + 4, "right");
    }
    ctx.font = "500 11px 'Geist Variable', ui-sans-serif, sans-serif";
    ctx.fillStyle = "#c5cac6";
    const top = P(ax, 1, az);
    if (!compact) text("Popularity (stars)", Math.max(8, top.sx - 30), Math.max(14, top.sy - 10), "left");
    const yrEnd = P(1, -1, -1);
    if (!compact) text("Year starred", Math.min(w - 8, yrEnd.sx), yrEnd.sy + 34, "right");
    if (wide && !compact) {
      const near = P(1, -1, -1);
      const far = P(1, -1, 1);
      text("Pushed recently", near.sx + 10, near.sy + 4, "left");
      ctx.fillStyle = "#8d938f";
      text("Stale", far.sx + 10, far.sy + 4, "left");
    }

    // Points, far to near. Hidden legend keys drop out entirely (no marks, no hover, no callouts).
    const keyOf = (s: EStar) => (colorBy === "language" ? (s.language && topLangs.includes(s.language) ? s.language : "other") : s.health);
    const colorOf = (s: EStar) =>
      colorBy === "language" ? (s.language && topLangs.includes(s.language) ? CATEGORICAL_3[topLangs.indexOf(s.language)]! : OTHER) : HEALTH_CHART[s.health];
    const shown = hiddenKeys && hiddenKeys.size ? points.filter((p) => !hiddenKeys.has(keyOf(p.s))) : points;
    const proj: Proj[] = shown.map((p) => {
      const a = P(p.x, p.y, p.z);
      return { p, sx: a.sx, sy: a.sy, sr: Math.max(0.9, p.r * a.scale * (fr.ky / 230)), depth: a.depth };
    });
    proj.sort((a, b) => b.depth - a.depth);
    for (const q of proj) {
      const hl = q.p.s.health;
      const c = colorOf(q.p.s);
      const fade = 0.5 + 0.5 * Math.max(0, Math.min(1, (1.4 - q.depth) / 2.8));
      const dim =
        focusHealth && focusHealth !== hl ? 0.1 : highlightId && q.p.s.id !== highlightId ? 0.28 : highlightSet && !highlightSet.has(q.p.s.id) ? 0.14 : 1;
      ctx.globalAlpha = (hl === "dormant" ? DORMANT_ALPHA : 1) * fade * dim;
      ctx.beginPath();
      ctx.arc(q.sx, q.sy, q.sr, 0, Math.PI * 2);
      if (hl === "archived") {
        ctx.strokeStyle = c;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        ctx.fillStyle = c;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    if (ringSet && ringSet.size) {
      ctx.strokeStyle = ACCENT;
      ctx.lineWidth = 1.2;
      let n = 0;
      for (const q of proj) {
        if (!ringSet.has(q.p.s.id)) continue;
        ctx.beginPath();
        ctx.arc(q.sx, q.sy, q.sr + 3, 0, Math.PI * 2);
        ctx.stroke();
        if (++n > 400) break;
      }
    }
    projected.current = proj;

    // Callouts sit in the emptiest nearby slot; leaders run outward.
    const boxes = blocked;
    const near = (x: number, y: number, r: number) => {
      let n = 0;
      for (const o of proj) if (Math.abs(o.sx - x) < r && Math.abs(o.sy - y) < r) n++;
      return n;
    };
    /** Returns false (and draws nothing) when an optional callout has no clean slot. */
    const label = (q: Proj, accent: boolean, optional = false): boolean => {
      // A short inset has no room for a callout box: ring only (the host already names the repo).
      if (compact && h < 200) {
        ctx.strokeStyle = accent ? ACCENT : "#5a6068";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(q.sx, q.sy, q.sr + 4, 0, Math.PI * 2);
        ctx.stroke();
        return true;
      }
      const s = q.p.s;
      ctx.font = "600 12px 'Geist Variable', ui-sans-serif, sans-serif";
      const t1 = s.fullName;
      const tw1 = ctx.measureText(t1).width;
      const t2 = `${fmtNum(s.stars)} · ${new Date(s.starredAt).getFullYear()}${s.g.d7 ? ` · +${fmtNum(s.g.d7)} this week` : ""}`;
      ctx.font = "11px 'Geist Mono Variable', ui-monospace, monospace";
      const bw = Math.max(tw1, ctx.measureText(t2).width + 14) + 22;
      const bh = 40;
      let best: { x: number; y: number; score: number } | null = null;
      // [x, y, side, base cost]: near the point first, then the reserved band above the cube (empty by construction).
      const slots: Array<[number, number, 1 | -1, number]> = [];
      for (const side of [1, -1] as const)
        for (const off of [60, 120, 180])
          for (const dy of [-110, -70, -30, 20]) slots.push([side > 0 ? q.sx + off : q.sx - off - bw, q.sy + dy, side, off * 0.05 + Math.abs(dy) * 0.02]);
      for (const ox of [-bw - 30, -bw / 2, 30, 140, -bw - 140]) slots.push([q.sx + ox, 10, ox < -bw / 2 ? -1 : 1, 6]);
      for (const [x, y, side, base] of slots) {
        const m = compact ? 10 : 4;
        if (x < m || x + bw > w - m || y < m || y + bh > h - 30) continue;
        let score = base;
        for (const o of proj) if (o.sx > x - 4 && o.sx < x + bw + 4 && o.sy > y - 4 && o.sy < y + bh + 4) score += 25;
        for (const bx of boxes) if (x < bx.x + bx.w + 8 && x + bw + 8 > bx.x && y < bx.y + bx.h + 8 && y + bh + 8 > bx.y) score += 1000;
        // Leaders should run through empty space, not across the cloud or other boxes.
        const ex = side > 0 ? x : x + bw;
        const ey = y + bh / 2;
        const len = Math.hypot(ex - q.sx, ey - q.sy);
        for (let t = 0.15; t < 1; t += 8 / Math.max(len, 8)) {
          const px = q.sx + (ex - q.sx) * t;
          const py = q.sy + (ey - q.sy) * t;
          score += near(px, py, 6) * 20;
          for (const bx of boxes) if (px > bx.x && px < bx.x + bx.w && py > bx.y && py < bx.y + bx.h) score += 400;
        }
        if (!best || score < best.score) best = { x, y, score };
      }
      if (optional && (!best || best.score >= 1000)) return false;
      if (!best) best = { x: Math.max(4, Math.min(w - bw - 4, q.sx + 20)), y: Math.max(4, q.sy - bh - 20), score: 0 };
      boxes.push({ x: best.x, y: best.y, w: bw, h: bh });
      const ax = best.x > q.sx ? best.x : best.x + bw;
      const ay = best.y + bh / 2;
      ctx.strokeStyle = accent ? ACCENT : "#5a6068";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(q.sx, q.sy, q.sr + 4, 0, Math.PI * 2);
      ctx.stroke();
      const ang = Math.atan2(ay - q.sy, ax - q.sx);
      seg({ sx: q.sx + Math.cos(ang) * (q.sr + 4), sy: q.sy + Math.sin(ang) * (q.sr + 4) }, { sx: ax, sy: ay });
      ctx.fillStyle = "#050607";
      ctx.strokeStyle = accent ? ACCENT : "#30343a";
      ctx.beginPath();
      ctx.rect(best.x + 0.5, best.y + 0.5, bw, bh);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e8eae6";
      ctx.textAlign = "left";
      ctx.font = "600 12px 'Geist Variable', ui-sans-serif, sans-serif";
      ctx.fillText(t1, best.x + 11, best.y + 17);
      ctx.fillStyle = "#8d938f";
      starPath(ctx, best.x + 15, best.y + 29, 4.5);
      ctx.fill();
      ctx.font = "11px 'Geist Mono Variable', ui-monospace, monospace";
      ctx.fillText(t2, best.x + 25, best.y + 33);
      return true;
    };

    const pinned = hover?.p.s.id ?? highlightId ?? pinnedId;
    const active = pinned ? proj.find((x) => x.p.s.id === pinned) : undefined;
    if (active) {
      // Drop-line to the floor: where it sits in time and recency.
      const foot = P(active.p.x, -1, active.p.z);
      ctx.strokeStyle = ACCENT;
      ctx.globalAlpha = 0.6;
      ctx.setLineDash([3, 3]);
      seg(active, foot);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(foot.sx, foot.sy, 2, 0, Math.PI * 2);
      ctx.fillStyle = ACCENT;
      ctx.fill();
    }
    // The active callout claims its slot first; risers fit around it or stay unlabelled.
    // A pinned (not hovered) callout waits until the outcome moment has played.
    const outcomePlaying = !!outcome && !reduce && performance.now() - outcome.at < OUTCOME_MS;
    if (active && (hover || !outcomePlaying)) label(active, true);
    if (!moving.current && view.current.intro >= 1 && w >= 560 && !focusHealth && !highlightId && !ambient) {
      for (const id of risers) {
        const q = proj.find((x) => x.p.s.id === id);
        if (q && q.p.s.id !== active?.p.s.id) label(q, false, true);
      }
    }

    // Outcome of the last triage decision, drawn over the field.
    const ot = outcome && !reduce ? (performance.now() - outcome.at) / OUTCOME_MS : 1;
    if (outcome && ot < 1) {
      const e = easeOut(Math.max(0, ot));
      const keep = outcome.kind === "keep";
      const p = toP3(outcome.star);
      const a = P(p.x, p.y + (keep ? 0.08 * e : -0.06 * e), p.z + (keep ? -0.45 : 0.45) * e);
      const base = Math.max(1.2, p.r * a.scale * (fr.ky / 230));
      const r = keep ? base * (1 + 0.9 * e) : base * (1 - 0.6 * e);
      ctx.globalAlpha = keep ? 1 : 1 - e * 0.85;
      ctx.fillStyle = HEALTH_CHART[outcome.star.health];
      ctx.beginPath();
      ctx.arc(a.sx, a.sy, Math.max(0.6, r), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1 - ot;
      ctx.strokeStyle = keep ? ACCENT : HEALTH_CHART.archived;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(a.sx, a.sy, keep ? r + 4 + 16 * e : r + 4 + 6 * (1 - e), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Camera readout
    if (!compact) {
      ctx.font = "11px 'Geist Mono Variable', ui-monospace, monospace";
      ctx.fillStyle = "#8d938f";
      ctx.textAlign = "left";
      ctx.fillText(
        ambient
          ? `Sample sky · ${points.length} generated repos`
          : `yaw ${Math.round((yaw * 180) / Math.PI)}°  pitch ${Math.round((pitch * 180) / Math.PI)}°  ·  ${proj.length} stars`,
        12 + (ambient ? insetLeft : 0),
        h - 12,
      );
    }
  }, [
    w,
    height,
    points,
    years,
    minT,
    maxT,
    maxLog,
    toP3,
    risers,
    hover,
    focusHealth,
    highlightId,
    ambient,
    compact,
    outcome,
    reduce,
    insetLeft,
    highlightSet,
    ringSet,
    pinnedId,
    colorBy,
    topLangs,
    hiddenKeys,
  ]);

  // Animation loop: intro tilt + inertia. Callouts hide while anything moves; idle when settled.
  const tick = useCallback(() => {
    const v = view.current;
    let busy = false;
    if (v.intro < 1) {
      v.intro = reduce ? 1 : Math.min(1, v.intro + 0.03);
      busy = true;
    }
    if (outcome && !reduce && performance.now() - outcome.at < OUTCOME_MS) busy = true;
    if (ambient && !reduce && !drag.current) {
      v.yaw += 0.0016;
      busy = true;
    }
    if (!drag.current && (Math.abs(vel.current.yaw) > 0.0004 || Math.abs(vel.current.pitch) > 0.0004)) {
      v.yaw += vel.current.yaw;
      v.pitch = Math.max(0.08, Math.min(1.0, v.pitch + vel.current.pitch));
      vel.current.yaw *= 0.92;
      vel.current.pitch *= 0.92;
      busy = true;
    }
    moving.current = busy || !!drag.current;
    draw();
    raf.current = busy ? requestAnimationFrame(tick) : 0;
  }, [draw, reduce, ambient, outcome]);

  const kick = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => {
    kick();
    return () => {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [kick]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nearest = (mx: number, my: number) => {
    let best: Proj | null = null;
    let bd = 14 * 14;
    for (const q of projected.current) {
      if (focusHealth && q.p.s.health !== focusHealth) continue;
      const d = (q.sx - mx) ** 2 + (q.sy - my) ** 2;
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    return best;
  };

  const reset = () => {
    view.current.yaw = DEFAULT.yaw;
    view.current.pitch = DEFAULT.pitch;
    vel.current = { yaw: 0, pitch: 0 };
    kick();
  };

  const step = (dir: 1 | -1) => {
    const next = (cursor + dir + order.length) % order.length;
    setCursor(next);
    const q = projected.current.find((x) => x.p.s.id === order[next]);
    if (q) setHover(q);
  };

  return (
    <div ref={wrap} className="relative w-full min-w-0">
      <canvas
        ref={canvas}
        tabIndex={ambient ? -1 : 0}
        role="img"
        aria-label={
          ambient
            ? `Sample 3D star field of ${stars.length} generated repositories, slowly rotating.`
            : `3D star field of ${visibleCount} starred repositories: year starred left to right, popularity bottom to top, recently pushed nearest to you. Arrow keys rotate; [ and ] step through stars; Enter opens the selected star.`
        }
        style={{ width: "100%", height }}
        className={`block touch-none outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset ${hover ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"}`}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, moved: false };
          vel.current = { yaw: 0, pitch: 0 };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          if (drag.current) {
            const dx = e.clientX - drag.current.x;
            const dy = e.clientY - drag.current.y;
            if (Math.abs(dx) + Math.abs(dy) > 3) drag.current.moved = true;
            drag.current.x = e.clientX;
            drag.current.y = e.clientY;
            vel.current = { yaw: dx * 0.006, pitch: dy * 0.004 };
            view.current.yaw += vel.current.yaw;
            view.current.pitch = Math.max(0.08, Math.min(1.0, view.current.pitch + vel.current.pitch));
            if (reduce) vel.current = { yaw: 0, pitch: 0 };
            setHover(null);
            kick();
            return;
          }
          if (ambient) return;
          const n = nearest(e.clientX - r.left, e.clientY - r.top);
          if (n?.p.s.id !== hover?.p.s.id) setHover(n);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          if (d && !d.moved && onOpen && !ambient) {
            const r = e.currentTarget.getBoundingClientRect();
            const n = nearest(e.clientX - r.left, e.clientY - r.top);
            if (n) onOpen(n.p.s.id);
          }
          kick();
        }}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "]" || e.key === "[") {
            e.preventDefault();
            step(e.key === "]" ? 1 : -1);
            return;
          }
          if (e.key === "Enter" && hover && onOpen) {
            e.preventDefault();
            onOpen(hover.p.s.id);
            return;
          }
          if (e.key === "Escape") {
            setHover(null);
            return;
          }
          const turn = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.08], ArrowDown: [0, 0.08] }[e.key];
          if (!turn) return;
          e.preventDefault();
          view.current.yaw += turn[0]!;
          view.current.pitch = Math.max(0.08, Math.min(1.0, view.current.pitch + turn[1]!));
          kick();
        }}
      />
      {!ambient && !compact && (
        <button
          onClick={reset}
          className="absolute top-2 right-2 inline-flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Reset view"
        >
          <LocateFixedIcon className="size-3.5" /> Reset view
        </button>
      )}
      <span className="sr-only" aria-live="polite">
        {hover
          ? `${hover.p.s.fullName}, ${fmtNum(hover.p.s.stars)} stars, ${HEALTH_LABEL[hover.p.s.health]} (class ${HEALTH_CLASS[hover.p.s.health]}). Press Enter to open.`
          : ""}
      </span>
    </div>
  );
}
