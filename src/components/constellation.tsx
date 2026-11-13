import { useMemo, useState } from 'react'

import { HEALTH_CHART } from '@/lib/palette'
import type { EStar } from '@/lib/queries'

import { DORMANT_ALPHA } from './star-field'

/** Shared axes so every constellation on a page is drawn on the same sky. */
export interface SkyDomain {
  minT: number
  maxT: number
  maxLog: number
}

export function skyDomain(stars: EStar[]): SkyDomain {
  const now = Date.now()
  const ts = stars.map((s) => new Date(s.starredAt).getTime())
  return {
    minT: Math.min(...ts, now - 365 * 86_400_000),
    maxT: now,
    maxLog: Math.max(2, ...stars.map((s) => Math.log10(Math.max(1, s.stars)))),
  }
}

const W = 320
const H = 100
const PAD = 8

type Edge = [number, number, number, number]

/** Minimum spanning tree (Prim) over the given points, as line segments. */
function spanningTree(top: Array<{ x: number; y: number }>): Edge[] {
  const edges: Edge[] = []
  const root = top[0]
  if (!root || top.length < 2) {
    return edges
  }
  const inTree = new Set([0])
  const dist = top.map((p) => (p.x - root.x) ** 2 + (p.y - root.y) ** 2)
  const from = top.map(() => 0)
  while (inTree.size < top.length) {
    let k = -1
    let kd = Infinity
    for (let i = 0; i < top.length; i += 1) {
      const di = dist[i] ?? Infinity
      if (!inTree.has(i) && (k < 0 || di < kd)) {
        k = i
        kd = di
      }
    }
    inTree.add(k)
    const a = top[from[k] ?? 0]
    const b = top[k]
    if (!a || !b) {
      break // unreachable: k is a point not yet in the tree, from[k] one that is
    }
    edges.push([a.x, a.y, b.x, b.y])
    for (let i = 0; i < top.length; i += 1) {
      const p = top[i]
      if (!p || inTree.has(i)) {
        continue
      }
      const d = (p.x - b.x) ** 2 + (p.y - b.y) ** 2
      if (d < (dist[i] ?? Infinity)) {
        dist[i] = d
        from[i] = k
      }
    }
  }
  return edges
}

/** Places each star on the sky, and joins the brightest 80 so big lists stay readable. */
function layout(stars: EStar[], domain: SkyDomain) {
  const pts = stars.map((s) => {
    const lg = Math.log10(Math.max(1, s.stars))
    return {
      s,
      x:
        PAD +
        ((new Date(s.starredAt).getTime() - domain.minT) / (domain.maxT - domain.minT)) *
          (W - PAD * 2),
      y: H - PAD - (lg / domain.maxLog) * (H - PAD * 2),
      r: 1.2 + (lg / domain.maxLog) * 3,
    }
  })
  const top = [...pts].sort((a, b) => b.s.stars - a.s.stars).slice(0, 80)
  return { pts, edges: spanningTree(top) }
}

/**
 * A List drawn as a constellation: its repos placed by when you starred them (left to right) and how
 * popular they are (bottom to top), joined by the shortest lines that connect them all.
 */
export function Constellation({
  stars,
  domain,
  onOpen,
  label,
}: {
  stars: EStar[]
  domain: SkyDomain
  onOpen?: (id: string) => void
  label: string
}) {
  const [hover, setHover] = useState<string | null>(null)
  const { pts, edges } = useMemo(() => layout(stars, domain), [stars, domain])

  return (
    <svg
      viewBox={`0 0 ${W} ${H + 10}`}
      className="block h-auto w-full overflow-visible"
      role="img"
      aria-label={label}
    >
      <line
        x1={PAD}
        x2={W - PAD}
        y1={H - PAD + 4}
        y2={H - PAD + 4}
        stroke="var(--grid-strong)"
        strokeWidth={1}
      />
      <text x={PAD} y={H + 6} className="fill-muted-foreground font-mono text-[11px]">
        {new Date(domain.minT).getFullYear()}
      </text>
      <text
        x={W - PAD}
        y={H + 6}
        textAnchor="end"
        className="fill-muted-foreground font-mono text-[11px]"
      >
        now
      </text>
      {edges.map(([x1, y1, x2, y2], i) => (
        <line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="var(--grid-strong)"
          strokeWidth={0.8}
        />
      ))}
      {pts.map((p) => {
        const c = HEALTH_CHART[p.s.health]
        const archived = p.s.health === 'archived'
        const on = hover === p.s.id
        return (
          <g
            key={p.s.id}
            className={onOpen ? 'cursor-pointer' : undefined}
            onMouseEnter={() => setHover(p.s.id)}
            onMouseLeave={() => setHover(null)}
            onClick={
              onOpen ? (e) => (e.preventDefault(), e.stopPropagation(), onOpen(p.s.id)) : undefined
            }
          >
            <title>{`${p.s.fullName} · ${p.s.stars.toLocaleString()} stars`}</title>
            <circle cx={p.x} cy={p.y} r={7} fill="transparent" />
            <circle
              cx={p.x}
              cy={p.y}
              r={p.r}
              fill={archived ? 'none' : c}
              stroke={archived ? c : 'none'}
              strokeWidth={archived ? 1 : 0}
              opacity={p.s.health === 'dormant' ? DORMANT_ALPHA : 1}
            />
            {on && (
              <circle
                cx={p.x}
                cy={p.y}
                r={p.r + 2.5}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={1}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}
