import { useEffect, useMemo, useRef, useState } from 'react'

import { HEALTH_CLASS, HEALTH_CHART } from '@/lib/palette'
import type { EStar } from '@/lib/queries'
import { fmtNum } from '@/lib/utils'

import { DORMANT_ALPHA } from './star-field'

/*
 * Momentum: every growing repo placed by how popular it is (x, log) and how many stars it gained
 * in the window (y, log). Diagonals mark constant growth rates, so "big and steady" and "small and
 * exploding" separate at a glance.
 */

interface Pt {
  s: EStar
  d: number
  x: number
  y: number
}

const PAD = { l: 52, r: 76, t: 28, b: 44 }

export function MomentumPlot({
  stars,
  delta,
  windowLabel,
  rates,
  labelIds,
  pinnedId,
  onOpen,
  tailOf,
}: {
  stars: EStar[]
  /** New stars in the window, or null/0 to leave a repo out. */
  delta: (s: EStar) => number
  windowLabel: string
  /** Guide diagonals as growth fractions over the window, e.g. [0.005, 0.02, 0.1]. */
  rates: number[]
  /** Repos to label at rest (the leaders of the current ranking). */
  labelIds: string[]
  /** A repo hovered elsewhere (the ranked list) to ring here. */
  pinnedId?: string | null
  onOpen: (id: string) => void
  /** Pace trail: where the repo was (stars, weekly pace) before this window; null to skip. */
  tailOf?: ((s: EStar) => { stars: number; pace: number } | null) | null
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(800)
  const [hover, setHover] = useState<Pt | null>(null)
  const h = Math.round(Math.max(280, Math.min(380, w * 0.42)))

  useEffect(() => {
    const el = wrap.current
    if (!el) {
      return
    }
    const ro = new ResizeObserver(([e]) => {
      if (e) {
        setW(Math.round(e.contentRect.width))
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { pts, xMax, yMax } = useMemo(() => {
    const raw = stars.map((s) => ({ s, d: delta(s) })).filter((r) => r.d > 0 && !r.s.isArchived)
    return {
      pts: raw,
      xMax: Math.max(2, ...raw.map((r) => Math.log10(Math.max(1, r.s.stars)))) + 0.15,
      yMax: Math.max(1, ...raw.map((r) => Math.log10(Math.max(1, r.d)))) + 0.2,
    }
  }, [stars, delta])

  const sx = (lg: number) => PAD.l + (lg / xMax) * (w - PAD.l - PAD.r)
  const sy = (lg: number) => h - PAD.b - (lg / yMax) * (h - PAD.t - PAD.b)
  const placed: Pt[] = pts.map((p) => ({
    ...p,
    x: sx(Math.log10(Math.max(1, p.s.stars))),
    y: sy(Math.log10(Math.max(1, p.d))),
  }))
  const byId = new Map(placed.map((p) => [p.s.id, p]))

  const nearest = (mx: number, my: number) => {
    let best: Pt | null = null
    let bd = 14 * 14
    for (const p of placed) {
      const dd = (p.x - mx) ** 2 + (p.y - my) ** 2
      if (dd < bd) {
        bd = dd
        best = p
      }
    }
    return best
  }

  const active = hover ?? (pinnedId ? (byId.get(pinnedId) ?? null) : null)
  // Resting labels (wide screens only): up to three leaders of the ranking, each placed in the clearest slot
  // beside its own point (short leaders, as on the Star map). A label with no clean slot is skipped.
  const BW = 228
  const BH = 40
  const labelBoxes: Array<{ p: Pt; x: number; y: number }> = []
  if (!active && w >= 640) {
    // Obstacles beyond the marks: each growth diagonal's label and the last ~80px of its line.
    const diagBoxes: Array<{ x: number; y: number; w: number; h: number }> = []
    const diagPts: Array<{ x: number; y: number }> = []
    for (const rate of rates) {
      const off = Math.log10(rate)
      const x0 = Math.max(0, -off)
      const x1 = Math.min(xMax, yMax - off)
      if (x1 <= x0) {
        continue
      }
      const ex = sx(x1)
      const ey = sy(x1 + off)
      diagBoxes.push({ x: ex + 2, y: ey - 10, w: 44, h: 16 })
      const sx0 = sx(x0)
      const sy0 = sy(x0 + off)
      const len = Math.hypot(ex - sx0, ey - sy0)
      for (let d = 0; d <= Math.min(80, len); d += 10) {
        diagPts.push({ x: ex - ((ex - sx0) * d) / len, y: ey - ((ey - sy0) * d) / len })
      }
    }
    const leaders = labelIds
      .map((id) => byId.get(id))
      .filter((p): p is Pt => Boolean(p))
      .slice(0, 3)
    for (const p of leaders) {
      let best: { x: number; y: number; cost: number } | null = null
      for (const side of [-1, 1]) {
        for (const gap of [36, 90]) {
          for (const dy of [-20, -66, 26, -112, 72]) {
            const x = side < 0 ? p.x - gap - BW : p.x + gap
            const y = p.y + dy
            if (x < PAD.l + 4 || x + BW > w - 8 || y < 4 || y + BH > h - PAD.b - 4) {
              continue
            }
            if (
              labelBoxes.some(
                (o) => x < o.x + BW + 8 && x + BW + 8 > o.x && y < o.y + BH + 8 && y + BH + 8 > o.y,
              )
            ) {
              continue
            }
            if (
              diagBoxes.some(
                (o) =>
                  x < o.x + o.w + 4 && x + BW + 4 > o.x && y < o.y + o.h + 4 && y + BH + 4 > o.y,
              )
            ) {
              continue
            }
            let cost = gap * 0.05 + Math.abs(dy + 20) * 0.02
            for (const q of placed) {
              if (q.x > x - 3 && q.x < x + BW + 3 && q.y > y - 3 && q.y < y + BH + 3) {
                cost += 4
              }
            }
            for (const q of diagPts) {
              if (q.x > x - 3 && q.x < x + BW + 3 && q.y > y - 3 && q.y < y + BH + 3) {
                cost += 4
              }
            }
            if (!best || cost < best.cost) {
              best = { x, y, cost }
            }
          }
        }
      }
      if (best && best.cost < 8) {
        labelBoxes.push({ p, x: best.x, y: best.y })
      }
    }
  }

  const xTicks = [1, 10, 100, 1e3, 1e4, 1e5, 1e6].filter((v) => Math.log10(v) <= xMax)
  const yTicks = [1, 10, 100, 1e3, 1e4, 1e5].filter((v) => Math.log10(v) <= yMax)
  const activeTail = active && tailOf ? tailOf(active.s) : null

  return (
    <div ref={wrap} className="relative">
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- pointer-hover chart; the ranked list beside it is the keyboard path to the same repos */}
      <svg
        width={w}
        height={h}
        className="block w-full"
        role="img"
        aria-label={`Momentum: ${placed.length} growing repositories by popularity and new stars in the ${windowLabel}. Diagonals mark growth rates.`}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const n = nearest(e.clientX - r.left, e.clientY - r.top)
          if (n?.s.id !== hover?.s.id) {
            setHover(n)
          }
        }}
        onPointerLeave={() => setHover(null)}
        onClick={() => active && onOpen(active.s.id)}
        style={{ cursor: hover ? 'pointer' : 'default' }}
      >
        {/* grid */}
        {xTicks.map((v) => (
          <g key={`x${v}`}>
            <line
              x1={sx(Math.log10(v))}
              x2={sx(Math.log10(v))}
              y1={PAD.t}
              y2={h - PAD.b}
              stroke="var(--grid)"
            />
            <text
              x={sx(Math.log10(v))}
              y={h - PAD.b + 16}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[11px]"
            >
              {fmtNum(v)}
            </text>
          </g>
        ))}
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line
              x1={PAD.l}
              x2={w - PAD.r}
              y1={sy(Math.log10(v))}
              y2={sy(Math.log10(v))}
              stroke="var(--grid)"
            />
            <text
              x={PAD.l - 8}
              y={sy(Math.log10(v)) + 4}
              textAnchor="end"
              className="fill-muted-foreground font-mono text-[11px]"
            >
              {fmtNum(v)}
            </text>
          </g>
        ))}
        <path
          d={`M${PAD.l},${PAD.t} V${h - PAD.b} H${w - PAD.r}`}
          fill="none"
          stroke="var(--grid-strong)"
        />
        {/* growth-rate diagonals: delta = rate * stars */}
        {rates.map((rate) => {
          const off = Math.log10(rate)
          const x0 = Math.max(0, -off)
          const x1 = Math.min(xMax, yMax - off)
          if (x1 <= x0) {
            return null
          }
          return (
            <g key={rate}>
              <line
                x1={sx(x0)}
                y1={sy(x0 + off)}
                x2={sx(x1)}
                y2={sy(x1 + off)}
                stroke="var(--grid-strong)"
                strokeDasharray="4 4"
              />
              <text
                x={sx(x1) + 6}
                y={sy(x1 + off) + 4}
                className="fill-muted-foreground font-mono text-[11px]"
              >
                {rate * 100 < 1 ? (rate * 100).toFixed(1) : Math.round(rate * 100)}%
              </text>
            </g>
          )
        })}
        <text x={PAD.l - 36} y={PAD.t - 12} className="fill-foreground text-[11px] font-medium">
          New stars, {windowLabel}
        </text>
        <text
          x={w - PAD.r}
          y={h - 8}
          textAnchor="end"
          className="fill-foreground text-[11px] font-medium"
        >
          Popularity (stars)
        </text>
        {/* pace trails: from the earlier weekly pace to this week's, drawn under the marks */}
        {tailOf &&
          placed.map((p) => {
            const t = tailOf(p.s)
            // No trail from (near) zero: a repo with under one star a week before has no earlier pace to show.
            if (!t || t.pace < 1) {
              return null
            }
            const x0 = sx(Math.log10(Math.max(1, t.stars)))
            const y0 = sy(Math.log10(Math.max(1, t.pace)))
            if (Math.hypot(p.x - x0, p.y - y0) < 4) {
              return null
            }
            const isActive = active?.s.id === p.s.id
            return (
              <g key={`t${p.s.id}`} opacity={trailOpacity(isActive, Boolean(active))}>
                <line
                  x1={x0}
                  y1={y0}
                  x2={p.x}
                  y2={p.y}
                  stroke={isActive ? 'var(--primary)' : HEALTH_CHART[p.s.health]}
                  strokeWidth={isActive ? 1.4 : 1}
                />
                <circle
                  cx={x0}
                  cy={y0}
                  r={1.4}
                  fill="none"
                  stroke={isActive ? 'var(--primary)' : HEALTH_CHART[p.s.health]}
                  strokeWidth={0.8}
                />
              </g>
            )
          })}
        {/* marks */}
        {placed.map((p) => (
          <circle
            key={p.s.id}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={HEALTH_CHART[p.s.health]}
            opacity={
              (p.s.health === 'dormant' ? DORMANT_ALPHA : 1) *
              (active && active.s.id !== p.s.id ? 0.5 : 1)
            }
          />
        ))}
        {labelBoxes.map(({ p, x, y }) => {
          const right = x > p.x
          const ex = right ? x : x + BW
          const ey = y + BH / 2
          const ang = Math.atan2(ey - p.y, ex - p.x)
          return (
            <g key={p.s.id}>
              <circle cx={p.x} cy={p.y} r={7} fill="none" stroke="var(--dim-leader)" />
              <line
                x1={p.x + Math.cos(ang) * 7}
                y1={p.y + Math.sin(ang) * 7}
                x2={ex}
                y2={ey}
                stroke="var(--dim-leader)"
              />
              <Box x={x} y={y} s={p.s} d={p.d} accent={false} />
            </g>
          )
        })}
        {active && (
          <g>
            <circle
              cx={active.x}
              cy={active.y}
              r={7}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={1.2}
            />
            <line
              x1={active.x}
              y1={active.y + 7}
              x2={active.x}
              y2={h - PAD.b}
              stroke="var(--primary)"
              strokeOpacity={0.6}
              strokeDasharray="3 3"
            />
            {(() => {
              const right = active.x < w - PAD.r - 260
              const bx = right ? active.x + 40 : active.x - 268
              const by = Math.max(4, Math.min(active.y - 20, h - PAD.b - 44))
              return (
                <>
                  <line
                    x1={active.x + (right ? 7 : -7)}
                    y1={active.y}
                    x2={right ? bx : bx + 228}
                    y2={by + 20}
                    stroke="var(--primary)"
                  />
                  <Box x={bx} y={by} s={active.s} d={active.d} accent />
                </>
              )
            })()}
          </g>
        )}
      </svg>
      <span className="sr-only" aria-live="polite">
        {active
          ? `${active.s.fullName}: ${fmtNum(active.d)} new stars, ${fmtNum(active.s.stars)} total, class ${HEALTH_CLASS[active.s.health]}${activeTail ? `, ${activeTail.pace < active.d ? 'up' : 'down'} from about ${fmtNum(Math.round(activeTail.pace))} a week before` : ''}`
          : ''}
      </span>
    </div>
  )
}

/** A pace trail's opacity: lit when its repo is active, faded behind another active repo. */
function trailOpacity(isActive: boolean, anyActive: boolean): number {
  if (isActive) {
    return 1
  }
  return anyActive ? 0.12 : 0.4
}

function Box({
  x,
  y,
  s,
  d,
  accent,
}: {
  x: number
  y: number
  s: EStar
  d: number
  accent: boolean
}) {
  const pct = s.stars - d > 0 ? (d / (s.stars - d)) * 100 : 0
  return (
    <g>
      <rect
        x={x + 0.5}
        y={y + 0.5}
        width={228}
        height={40}
        fill="var(--background)"
        stroke={accent ? 'var(--primary)' : 'var(--input)'}
      />
      <text x={x + 11} y={y + 17} className="fill-foreground text-[12px] font-semibold">
        {s.fullName.length > 30 ? `${s.fullName.slice(0, 29)}…` : s.fullName}
      </text>
      <text x={x + 11} y={y + 32} className="fill-muted-foreground font-mono text-[11px]">
        +{fmtNum(d)} · {fmtNum(s.stars)} total · {pct >= 10 ? Math.round(pct) : pct.toFixed(1)}%
      </text>
    </g>
  )
}
