import { useEffect, useRef, useState } from 'react'

import { ACCENT } from '@/lib/palette'

/**
 * The first sync, drawn as a scan: a lime line sweeps the field, and each star fetched so far is
 * revealed as a point when the line passes over it, with a brief lime ring as it is found. The
 * count is real (`found` of `total`); the positions are decorative, since a star's data arrives
 * only when the sync finishes, so the points are neutral starlight rather than class colours.
 * Reduced motion drops the sweep: points simply appear as they are fetched.
 */

/** Points drawn at most; bigger libraries fill the field proportionally. */
const MAX_POINTS = 1400
/** One sweep across the field. */
const SWEEP_MS = 2600
/** How long a newly found point keeps its lime ring. */
const FOUND_MS = 700
const HEIGHT = 200

interface Point {
  x: number
  y: number
  r: number
  alpha: number
  /** When the sweep revealed it (ms, performance clock); Infinity until then. */
  litAt: number
}

/** Seeded so the field is the same on every visit: most points faint and small, a few bright. */
function makePoints(n: number): Point[] {
  let seed = 1_234_567
  const rnd = () => {
    seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31
    return seed / 2 ** 31
  }
  return Array.from({ length: n }, () => {
    const near = rnd() ** 2.4
    return {
      x: 0.03 + rnd() * 0.94,
      y: 0.1 + rnd() * 0.8,
      r: 0.6 + near * 1.9,
      alpha: 0.3 + near * 0.6,
      litAt: Number.POSITIVE_INFINITY,
    }
  })
}

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function ScanField({
  found,
  total,
  scanning,
}: {
  /** Stars fetched so far. */
  found: number
  /** Stars to fetch, once GitHub has said. */
  total: number | null
  scanning: boolean
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  // The sweep's clock and the motion preference, read once.
  const [start] = useState(() => performance.now())
  const [reduce] = useState(reducedMotion)
  // Animation bookkeeping (each point's reveal time), not render state: a ref, filled on mount.
  const points = useRef<Point[]>([])
  const shown = useRef(0)
  useEffect(() => {
    points.current = makePoints(MAX_POINTS)
    shown.current = 0
  }, [])
  const scanningRef = useRef(scanning)
  useEffect(() => {
    scanningRef.current = scanning
  }, [scanning])

  // Newly fetched stars become available; the sweep lights each one as it next passes over it.
  const target = total
    ? Math.round((Math.min(found, total) / Math.max(total, 1)) * Math.min(total, MAX_POINTS))
    : Math.min(found, MAX_POINTS)
  useEffect(() => {
    const now = performance.now()
    const phase = ((now - start) % SWEEP_MS) / SWEEP_MS
    for (let i = shown.current; i < target; i += 1) {
      const p = points.current[i]
      if (p) {
        const ahead = (((p.x - phase) % 1) + 1) % 1
        p.litAt = reduce ? now - FOUND_MS : now + ahead * SWEEP_MS
      }
    }
    shown.current = Math.max(shown.current, target)
  }, [target, start, reduce])

  useEffect(() => {
    let raf = 0
    const draw = () => {
      const el = canvas.current
      const box = wrap.current
      const ctx = el?.getContext('2d')
      if (!el || !box || !ctx) {
        return
      }
      const w = box.clientWidth
      const h = HEIGHT
      const dpr = Math.min(window.devicePixelRatio, 2)
      if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
        el.width = Math.round(w * dpr)
        el.height = Math.round(h * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // Instrument grid: hairlines, like the star field's floor.
      ctx.strokeStyle = '#16191c'
      ctx.lineWidth = 1
      for (let i = 1; i < 6; i += 1) {
        const y = Math.round((h / 6) * i) + 0.5
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }

      const now = performance.now()
      for (let i = 0; i < shown.current; i += 1) {
        const p = points.current[i]
        if (!p || now < p.litAt) {
          continue
        }
        const x = p.x * w
        const y = p.y * h
        const age = now - p.litAt
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = '#e8eae6'
        ctx.beginPath()
        ctx.arc(x, y, p.r, 0, Math.PI * 2)
        ctx.fill()
        if (age < FOUND_MS && !reduce) {
          const t = age / FOUND_MS
          ctx.globalAlpha = (1 - t) * 0.7
          ctx.strokeStyle = ACCENT
          ctx.beginPath()
          ctx.arc(x, y, p.r + 2.5 + t * 4, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1

      // The scan line, only while fetching.
      if (scanningRef.current && !reduce) {
        const sx = Math.round((((now - start) % SWEEP_MS) / SWEEP_MS) * w) + 0.5
        ctx.strokeStyle = ACCENT
        ctx.globalAlpha = 0.85
        ctx.beginPath()
        ctx.moveTo(sx, 0)
        ctx.lineTo(sx, h)
        ctx.stroke()
        ctx.globalAlpha = 1
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [start, reduce])

  return (
    <div ref={wrap} className="w-full">
      <canvas
        ref={canvas}
        role="img"
        aria-label={
          scanning
            ? `Scanning: ${found.toLocaleString()}${total ? ` of ${total.toLocaleString()}` : ''} stars found so far.`
            : 'An empty star field, waiting for the first sync.'
        }
        style={{ width: '100%', height: HEIGHT }}
        className="block"
      />
    </div>
  )
}
