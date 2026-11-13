import { HEALTH_LABEL, HEALTH_ORDER, type Health } from '@shared/scoring'
import { createFileRoute } from '@tanstack/react-router'
import { scaleLog, scaleTime } from 'd3-scale'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomTransform } from 'd3-zoom'
import { LocateFixedIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'

import { PageHeader } from '@/components/bits'
import { useOpenRepo } from '@/components/repo'
import { DORMANT_ALPHA, StarField, starPath } from '@/components/star-field'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ACCENT, CATEGORICAL_3, HEALTH_CHART, HEALTH_CLASS, OTHER } from '@/lib/palette'
import { useDerived, type EStar } from '@/lib/queries'
import { useNow } from '@/lib/use-now'
import { cn, fmtNum } from '@/lib/utils'

export const Route = createFileRoute('/map')({
  validateSearch: z.object({ view: z.enum(['field', 'flat']).optional().catch(undefined) }),
  component: StarMap,
})

type ColorBy = 'health' | 'language'

interface Pt {
  s: EStar
  bx: number
  by: number
  r: number
  key: string
  color: string
  hollow: boolean
  alpha: number
}

const PAD = { l: 48, r: 16, t: 30, b: 46 }

function StarMap() {
  const { data, isLoading } = useDerived()
  const open = useOpenRepo()
  const { view = 'field' } = Route.useSearch()
  const navigate = Route.useNavigate()
  const setView = (v: 'flat' | 'field') =>
    void navigate({ search: { view: v === 'field' ? undefined : v }, replace: true })
  const [colorBy, setColorBy] = useState<ColorBy>('health')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [size, setSize] = useState({ w: 800, h: 520 })
  const [t, setT] = useState<ZoomTransform>(zoomIdentity)
  const [hover, setHover] = useState<Pt | null>(null)
  const [panning, setPanning] = useState(false)
  const [cursor, setCursor] = useState(-1)
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const zoomRef = useRef<ReturnType<typeof zoom<HTMLCanvasElement, unknown>> | null>(null)

  // Top 3 languages get validated hues; the rest fold into "Other".
  const langs = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of data?.stars ?? []) {
      if (s.language) {
        m.set(s.language, (m.get(s.language) ?? 0) + 1)
      }
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([l]) => l)
  }, [data])

  const legend = useMemo(
    () =>
      colorBy === 'health'
        ? HEALTH_ORDER.map((h) => ({
            key: h,
            label: HEALTH_LABEL[h],
            color: HEALTH_CHART[h],
            hollow: h === 'archived',
          }))
        : [
            ...langs.map((l, i) => ({
              key: l,
              label: l,
              color: CATEGORICAL_3[i] ?? OTHER,
              hollow: false,
            })),
            { key: 'other', label: 'Other', color: OTHER, hollow: false },
          ],
    [colorBy, langs],
  )

  useEffect(() => {
    const el = wrap.current
    if (!el) {
      return
    }
    const ro = new ResizeObserver(([e]) => {
      if (!e) {
        return
      }
      const w = e.contentRect.width
      setSize({ w, h: Math.round(Math.max(320, Math.min(540, w * 0.55))) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [isLoading, view])

  // The time axis only needs a rough "now"; refresh hourly.
  const now = useNow(3_600_000)
  const scales = useMemo(() => {
    const stars = data?.stars ?? []
    const times = stars.map((s) => new Date(s.starredAt).getTime())
    const min = Math.min(...times, now - 365 * 86_400_000)
    const max = now + 15 * 86_400_000
    const maxStars = Math.max(10, ...stars.map((s) => s.stars))
    return {
      x: scaleTime()
        .domain([new Date(min - 30 * 86_400_000), new Date(max)])
        .range([PAD.l, size.w - PAD.r]),
      y: scaleLog()
        .domain([1, maxStars * 1.4])
        .range([size.h - PAD.b, PAD.t]),
    }
  }, [data, size, now])

  const points = useMemo<Pt[]>(() => {
    if (!data) {
      return []
    }
    const langIdx = new Map(langs.map((l, i) => [l, i]))
    return data.stars.map((s) => {
      const { key, color } = legendOf(s, colorBy, langIdx)
      // Secondary encoding for health: archived = hollow ring, dormant = dimmer
      const hollow = s.health === 'archived'
      const alpha = s.health === 'dormant' ? DORMANT_ALPHA : 0.95
      const r = 2.5 + Math.min(4, Math.log10(Math.max(s.stars, 1)) * 0.8)
      return {
        s,
        bx: scales.x(new Date(s.starredAt)),
        by: scales.y(Math.max(1, s.stars)),
        r,
        key,
        color,
        hollow,
        alpha,
      }
    })
  }, [data, colorBy, langs, scales])
  const risers = useMemo(
    () =>
      [...points]
        .filter((p) => !p.s.isArchived)
        .sort((a, b) => (b.s.g.d7 ?? b.s.momentum) - (a.s.g.d7 ?? a.s.momentum))
        .slice(0, 3),
    [points],
  )

  // d3-zoom on the canvas
  useEffect(() => {
    const el = canvas.current
    if (!el) {
      return
    }
    const behavior = zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([1, 24])
      .translateExtent([
        [0, 0],
        [size.w, size.h],
      ])
      .on('start', () => setPanning(true))
      .on('end', () => setPanning(false))
      .on('zoom', (e: { transform: ZoomTransform }) => setT(e.transform))
    zoomRef.current = behavior
    select(el).call(behavior)
    return () => void select(el).on('.zoom', null)
  }, [size, isLoading, view])

  // Paint
  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) {
      return
    }
    const dpr = Math.min(window.devicePixelRatio, 2)
    el.width = size.w * dpr
    el.height = size.h * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size.w, size.h)

    const x = t.rescaleX(scales.x)
    const y = t.rescaleY(scales.y)

    // Recessive grid
    ctx.font = "11px 'Geist Mono Variable', ui-monospace, monospace"
    ctx.fillStyle = '#8d938f'
    ctx.strokeStyle = '#1c1f23'
    ctx.lineWidth = 1
    for (const tick of x.ticks(Math.max(3, Math.floor(size.w / 110)))) {
      const px = x(tick)
      if (px < PAD.l || px > size.w - PAD.r) {
        continue
      }
      ctx.beginPath()
      ctx.moveTo(px, PAD.t)
      ctx.lineTo(px, size.h - PAD.b)
      ctx.stroke()
      ctx.textAlign = 'center'
      ctx.fillText(x.tickFormat()(tick), px, size.h - PAD.b + 16)
    }
    let lastY = Infinity
    for (const v of [1, 10, 100, 1e3, 1e4, 1e5, 1e6, 1e7]) {
      const py = y(v)
      if (py < PAD.t + 4 || py > size.h - PAD.b || lastY - py < 18) {
        continue
      }
      lastY = py
      ctx.beginPath()
      ctx.moveTo(PAD.l, py)
      ctx.lineTo(size.w - PAD.r, py)
      ctx.stroke()
      ctx.textAlign = 'right'
      ctx.fillText(fmtNum(v), PAD.l - 6, py + 3)
    }

    // Axis frame and titles, in words.
    ctx.strokeStyle = '#2c3036'
    ctx.beginPath()
    ctx.moveTo(PAD.l, PAD.t)
    ctx.lineTo(PAD.l, size.h - PAD.b)
    ctx.lineTo(size.w - PAD.r, size.h - PAD.b)
    ctx.stroke()
    ctx.font = "500 11px 'Geist Variable', ui-sans-serif, sans-serif"
    ctx.fillStyle = '#e8eae6'
    ctx.textAlign = 'left'
    ctx.fillText('Popularity (stars)', PAD.l - 30, PAD.t - 12)
    ctx.textAlign = 'right'
    ctx.fillText('Year starred', size.w - PAD.r, size.h - 8)

    ctx.save()
    ctx.beginPath()
    ctx.rect(PAD.l, PAD.t, size.w - PAD.l - PAD.r, size.h - PAD.t - PAD.b)
    ctx.clip()
    const k = Math.sqrt(t.k)
    for (const p of points) {
      if (hidden.has(p.key)) {
        continue
      }
      const px = t.applyX(p.bx)
      const py = t.applyY(p.by)
      if (px < 0 || px > size.w || py < 0 || py > size.h) {
        continue
      }
      const r = p.r * Math.min(k, 2.2)
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      if (p.hollow) {
        ctx.strokeStyle = hexA(p.color, p.alpha)
        ctx.lineWidth = 1.5
        ctx.stroke()
      } else {
        ctx.fillStyle = hexA(p.color, p.alpha)
        ctx.fill()
      }
    }
    ctx.restore()

    const callout = (
      px: number,
      py: number,
      rr: number,
      st: EStar,
      accent: boolean,
      placed: Array<[number, number, number]>,
    ) => {
      ctx.font = "600 12px 'Geist Variable', ui-sans-serif, sans-serif"
      const t1 = st.fullName
      const t2 = statLine(st)
      const tw = ctx.measureText(t1).width
      ctx.font = "11px 'Geist Mono Variable', ui-monospace, monospace"
      const bw = Math.max(tw, ctx.measureText(t2).width + 14) + 22
      const bh = 40
      const slots: Array<[number, number]> = []
      for (const gap of [TIP_GAP, TIP_GAP + 60, TIP_GAP + 130]) {
        for (const dy of [-48, 10, -96, 58]) {
          slots.push([px + gap, py + dy], [px - gap - bw, py + dy])
        }
      }
      const fits = ([cx, cy]: [number, number]) =>
        cx > PAD.l + 2 &&
        cx + bw < size.w - 4 &&
        cy > 4 &&
        cy + bh < size.h - PAD.b - 2 &&
        !placed.some(
          ([ox, oy, ow]) =>
            cx < ox + ow + 8 && cx + bw + 8 > ox && cy < oy + bh + 8 && cy + bh + 8 > oy,
        )
      // Fewest marks under the box wins; a resting riser with no clean slot stays unlabelled.
      const covered = ([cx, cy]: [number, number]) => {
        let n = 0
        for (const q of points) {
          if (hidden.has(q.key)) {
            continue
          }
          const qx = t.applyX(q.bx)
          const qy = t.applyY(q.by)
          if (qx > cx - 3 && qx < cx + bw + 3 && qy > cy - 3 && qy < cy + bh + 3) {
            n += 1
          }
        }
        return n
      }
      let slot: [number, number] | undefined
      let best = Infinity
      for (const c of slots) {
        if (!fits(c)) {
          continue
        }
        const n = covered(c)
        if (n < best) {
          best = n
          slot = c
          if (n === 0) {
            break
          }
        }
      }
      if (!slot || (!accent && best > 1)) {
        return false
      }
      const [bx, by] = slot
      placed.push([bx, by, bw])
      ctx.strokeStyle = accent ? ACCENT : '#5a6068'
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(px, py, rr, 0, Math.PI * 2)
      ctx.stroke()
      ctx.lineWidth = 1
      const ax = bx > px ? bx : bx + bw
      const ay = by + bh / 2
      const ang = Math.atan2(ay - py, ax - px)
      ctx.beginPath()
      ctx.moveTo(px + Math.cos(ang) * rr, py + Math.sin(ang) * rr)
      ctx.lineTo(ax, ay)
      ctx.stroke()
      ctx.fillStyle = '#050607'
      ctx.strokeStyle = accent ? ACCENT : '#30343a'
      ctx.beginPath()
      ctx.rect(bx + 0.5, by + 0.5, bw, bh)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#e8eae6'
      ctx.textAlign = 'left'
      ctx.font = "600 12px 'Geist Variable', ui-sans-serif, sans-serif"
      ctx.fillText(t1, bx + 11, by + 17)
      ctx.fillStyle = '#8d938f'
      starPath(ctx, bx + 15, by + 29, 4.5)
      ctx.fill()
      ctx.font = "11px 'Geist Mono Variable', ui-monospace, monospace"
      ctx.fillText(t2, bx + 25, by + 33)
      return true
    }
    const inPlot = (px: number, py: number) =>
      px >= PAD.l && px <= size.w - PAD.r && py >= PAD.t && py <= size.h - PAD.b
    const placed: Array<[number, number, number]> = []
    if (hover && !hidden.has(hover.key)) {
      const px = t.applyX(hover.bx)
      const py = t.applyY(hover.by)
      const rr = hover.r * Math.min(k, 2.2) + 4
      // Drop-line to the time axis.
      ctx.strokeStyle = ACCENT
      ctx.globalAlpha = 0.6
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(px, py + rr)
      ctx.lineTo(px, size.h - PAD.b)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.globalAlpha = 1
      ctx.fillStyle = ACCENT
      ctx.beginPath()
      ctx.arc(px, size.h - PAD.b, 2, 0, Math.PI * 2)
      ctx.fill()
      callout(px, py, rr, hover.s, true, placed)
    } else if (!panning) {
      // Resting callouts on the three fastest risers, as in the Field.
      for (const p of risers) {
        if (hidden.has(p.key)) {
          continue
        }
        const px = t.applyX(p.bx)
        const py = t.applyY(p.by)
        if (inPlot(px, py)) {
          callout(px, py, p.r * Math.min(k, 2.2) + 4, p.s, false, placed)
        }
      }
    }
  }, [points, t, size, hidden, hover, scales, view, panning, risers])

  const nearest = (mx: number, my: number): Pt | null => {
    let best: Pt | null = null
    let bd = 18 * 18 // 18px hit radius: bigger than the mark
    for (const p of points) {
      if (hidden.has(p.key)) {
        continue
      }
      const dx = t.applyX(p.bx) - mx
      const dy = t.applyY(p.by) - my
      const d = dx * dx + dy * dy
      if (d < bd) {
        bd = d
        best = p
      }
    }
    return best
  }

  const visibleCount = points.filter((p) => !hidden.has(p.key)).length
  const order = useMemo(() => {
    const vis = points.filter((p) => !hidden.has(p.key))
    const ris = risers.filter((p) => !hidden.has(p.key))
    return [...ris, ...vis.filter((p) => !ris.includes(p)).sort((a, b) => b.s.stars - a.s.stars)]
  }, [points, hidden, risers])
  const step = (dir: 1 | -1) => {
    if (order.length === 0) {
      return
    }
    const next = (cursor + dir + order.length) % order.length
    setCursor(next)
    const p = order[next]
    if (p) {
      setHover(p)
    }
  }
  const resetFlat = () =>
    canvas.current &&
    zoomRef.current &&
    select(canvas.current).call(zoomRef.current.transform, zoomIdentity)

  return (
    <>
      <PageHeader
        title="Star map"
        sub="Every star you've given, by when you starred it and how popular it is."
      >
        <Tabs value={view} onValueChange={(v) => setView(v as 'flat' | 'field')}>
          <TabsList aria-label="View">
            <TabsTrigger value="field">Field</TabsTrigger>
            <TabsTrigger value="flat">Flat</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      {isLoading || !data ? (
        <Skeleton className="h-140" />
      ) : (
        <section className="overflow-hidden rounded-lg border bg-card" aria-label="Star map">
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
            <Tabs
              value={colorBy}
              onValueChange={(v) => (setColorBy(v as ColorBy), setHidden(new Set()))}
            >
              <TabsList aria-label="Colour by" className="h-8">
                <TabsTrigger value="health">Health</TabsTrigger>
                <TabsTrigger value="language">Language</TabsTrigger>
              </TabsList>
            </Tabs>
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
            {legend.map((l) => {
              const off = hidden.has(l.key)
              return (
                <button
                  key={l.key}
                  onClick={() =>
                    setHidden((h) => {
                      const n = new Set(h)
                      if (n.has(l.key)) {
                        n.delete(l.key)
                      } else {
                        n.add(l.key)
                      }
                      return n
                    })
                  }
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors duration-100',
                    off ? 'text-muted-foreground opacity-50 hover:opacity-80' : 'hover:bg-accent',
                  )}
                  aria-pressed={!off}
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={
                      l.hollow
                        ? { boxShadow: `inset 0 0 0 1.5px ${l.color}` }
                        : { background: l.color, opacity: l.key === 'dormant' ? DORMANT_ALPHA : 1 }
                    }
                  />
                  {l.label}
                  {colorBy === 'health' && (
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {HEALTH_CLASS[l.key as Health]}
                    </span>
                  )}
                </button>
              )
            })}
            <span className="ml-auto font-mono text-[11px] text-muted-foreground tabular-nums">
              {visibleCount.toLocaleString()} stars
            </span>
          </div>
          {view === 'field' ? (
            <StarField
              stars={data.stars}
              onOpen={open}
              height={560}
              colorBy={colorBy}
              topLangs={langs}
              hiddenKeys={hidden}
            />
          ) : (
            <div ref={wrap} className="relative w-full">
              <canvas
                ref={canvas}
                tabIndex={0}
                style={{ width: '100%', height: size.h }}
                className={cn(
                  'block touch-none outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-inset',
                  hover ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
                )}
                onPointerMove={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  setHover(nearest(e.clientX - r.left, e.clientY - r.top))
                }}
                onPointerLeave={() => setHover(null)}
                onBlur={() => setHover(null)}
                onClick={() => hover && open(hover.s.id)}
                onKeyDown={(e) => {
                  if (e.key === ']' || e.key === '[') {
                    e.preventDefault()
                    step(e.key === ']' ? 1 : -1)
                  } else if (e.key === 'Enter' && hover) {
                    e.preventDefault()
                    open(hover.s.id)
                  } else if (e.key === 'Escape') {
                    setHover(null)
                  }
                }}
                role="img"
                aria-label={`Scatter plot of ${visibleCount} starred repositories: year starred left to right, popularity bottom to top. Scroll to zoom, drag to pan; [ and ] step through stars; Enter opens the selected star.`}
              />
              <button
                onClick={resetFlat}
                className="absolute top-2 right-2 inline-flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Reset view"
              >
                <LocateFixedIcon className="size-3.5" /> Reset view
              </button>
              <span className="sr-only" aria-live="polite">
                {hover
                  ? `${hover.s.fullName}, ${fmtNum(hover.s.stars)} stars, ${HEALTH_LABEL[hover.s.health]} (class ${HEALTH_CLASS[hover.s.health]}). Press Enter to open.`
                  : ''}
              </span>
            </div>
          )}
          <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
            {view === 'field'
              ? 'Nearer means pushed more recently. Drag or arrow keys to orbit · [ ] to step through stars · Enter or click to open.'
              : 'Oldest stars on the left. Scroll to zoom, drag to pan · [ ] to step through stars · Enter or click to open.'}
          </p>
        </section>
      )}
    </>
  )
}

/** A star's legend key and colour: its health, or its language when that is a top language, else Other. */
function legendOf(
  s: EStar,
  colorBy: ColorBy,
  langIdx: Map<string, number>,
): { key: string; color: string } {
  if (colorBy === 'health') {
    return { key: s.health, color: HEALTH_CHART[s.health] }
  }
  const i = s.language ? langIdx.get(s.language) : undefined
  if (s.language && i !== undefined) {
    return { key: s.language, color: CATEGORICAL_3[i] ?? OTHER }
  }
  return { key: 'other', color: OTHER }
}

function statLine(s: EStar) {
  return `${fmtNum(s.stars)} · ${new Date(s.starredAt).getFullYear()}${s.g.d7 ? ` · +${fmtNum(s.g.d7)} this week` : ''}`
}

const TIP_GAP = 40

function hexA(hex: string, a: number) {
  const r = Number.parseInt(hex.slice(1, 3), 16)
  const g = Number.parseInt(hex.slice(3, 5), 16)
  const b = Number.parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}
