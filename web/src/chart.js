// uPlot wrapper — a single themed trend chart with crosshair readouts,
// an optional spread overlay (error bars / box-whiskers), and click-to-inspect.
import uPlot from 'https://cdn.jsdelivr.net/npm/uplot@1.6.31/dist/uPlot.esm.js'
import { fmtIntShort } from './format.js'

const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

let plot = null
let ro = null

function chartHeight(width) {
  return Math.round(Math.max(360, Math.min(540, width * 0.5)))
}

/**
 * model = {
 *   xs:      number[]                       // shared, sorted axis values
 *   series:  [{ key, label, color, ys, stats:[{lo,q1,q3,hi}|null] }]
 *   xlog, ylog: boolean
 *   spread:  boolean                       // overlay per-point error bars
 *   xLabel, yLabel: string
 *   yFmt:    (v, terse) => string
 *   onPointClick: ({ key, label, color, x }) => void
 * }
 */
export function renderChart(container, model) {
  destroyChart()
  if (!model.series.length || !model.xs.length) return

  const ink3 = cssVar('--ink-3')
  const line = cssVar('--line')
  const line2 = cssVar('--line-2')

  const data = [model.xs, ...model.series.map((s) => s.ys)]
  const gridCfg = { stroke: line, width: 1 }
  const tickCfg = { stroke: line2, size: 5, width: 1 }
  const axisFont = '11px "JetBrains Mono", monospace'
  const labelFont = '600 12px "Inter", sans-serif'

  const opts = {
    width: container.clientWidth,
    height: chartHeight(container.clientWidth),
    padding: [14, 18, 6, 8],
    cursor: {
      focus: { prox: 24 },
      points: { size: 6, width: 2, stroke: (u, i) => model.series[i - 1].color },
    },
    scales: {
      x: { distr: model.xlog ? 3 : 1 },
      y: { distr: model.ylog ? 3 : 1 },
    },
    legend: { live: true, markers: { width: 0 } },
    axes: [
      {
        scale: 'x',
        stroke: ink3,
        font: axisFont,
        grid: gridCfg,
        ticks: tickCfg,
        gap: 6,
        label: model.xLabel,
        labelFont,
        labelGap: 6,
        labelSize: 30,
        values: (u, splits) => splits.map((v) => fmtIntShort(v)),
      },
      {
        scale: 'y',
        stroke: ink3,
        font: axisFont,
        grid: gridCfg,
        ticks: tickCfg,
        gap: 6,
        size: 62,
        label: model.yLabel,
        labelFont,
        labelGap: 4,
        labelSize: 30,
        values: (u, splits) => splits.map((v) => model.yFmt(v, true)),
      },
    ],
    series: [
      { label: model.xLabel, value: (u, v) => (v == null ? '—' : fmtIntShort(v)) },
      ...model.series.map((s) => ({
        label: s.label,
        stroke: s.color,
        width: 2,
        scale: 'y',
        // shrink the median marker when error bars are shown so it doesn't
        // occlude the spread overlay drawn on top of it
        points: {
          show: true,
          size: model.spread ? 2.5 : 5,
          width: 0,
          fill: s.color,
          stroke: s.color,
        },
        value: (u, v) => model.yFmt(v),
      })),
    ],
    hooks: {
      draw: [(u) => drawSpread(u, model)],
    },
  }

  plot = new uPlot(opts, data, container)
  recolorLegend()
  bindClicks(plot, model)

  ro = new ResizeObserver(() => {
    if (!plot) return
    const w = container.clientWidth
    plot.setSize({ width: w, height: chartHeight(w) })
  })
  ro.observe(container)
}

// ---- spread overlay (per-point error bars) ------------------------------
function drawSpread(u, model) {
  if (!model.spread) return
  const ctx = u.ctx
  // valToPos(.., true) returns physical canvas pixels, so dodge offsets and
  // line widths must be scaled by the same device-pixel ratio.
  const dpr = u.pxRatio || window.devicePixelRatio || 1

  // visible series, in draw order, for horizontal dodge
  const visible = []
  model.series.forEach((s, k) => {
    if (u.series[k + 1].show) visible.push(s)
  })
  const V = visible.length
  if (!V) return
  const gap = 5 * dpr
  const capW = 4 * dpr

  ctx.save()
  ctx.beginPath()
  ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height)
  ctx.clip()
  ctx.lineCap = 'round'

  visible.forEach((s, vi) => {
    const off = (vi - (V - 1) / 2) * gap
    model.xs.forEach((xv, xi) => {
      const st = s.stats[xi]
      if (!st || st.lo == null) return
      const cx = Math.round(u.valToPos(xv, 'x', true) + off)
      const yLo = u.valToPos(st.lo, 'y', true) // min  → lower value, larger py
      const yHi = u.valToPos(st.hi, 'y', true) // max  → smaller py
      const yQ1 = u.valToPos(st.q1, 'y', true)
      const yQ3 = u.valToPos(st.q3, 'y', true)

      ctx.strokeStyle = s.color

      // whiskers (min → max), drawn faintly behind the IQR bar
      ctx.globalAlpha = 0.5
      ctx.lineWidth = 1 * dpr
      cap(ctx, cx, yHi, capW)
      cap(ctx, cx, yLo, capW)
      segment(ctx, cx, yHi, cx, yQ3)
      segment(ctx, cx, yLo, cx, yQ1)

      // thick inter-quartile bar
      ctx.globalAlpha = 0.9
      ctx.lineWidth = 3 * dpr
      segment(ctx, cx, yQ3, cx, yQ1)
    })
  })
  ctx.globalAlpha = 1
  ctx.restore()
}

function segment(ctx, x1, y1, x2, y2) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}
function cap(ctx, cx, y, w) {
  segment(ctx, cx - w, y, cx + w, y)
}

// ---- click to inspect a point ------------------------------------------
function bindClicks(u, model) {
  u.over.style.cursor = 'pointer'
  u.over.addEventListener('click', () => {
    const idx = u.cursor.idx
    if (idx == null || u.cursor.top == null) return
    const top = u.cursor.top // CSS px within plot area

    let best = null
    let bestDist = Infinity
    model.series.forEach((s, k) => {
      if (!u.series[k + 1].show) return
      const yv = s.ys[idx]
      if (yv == null) return
      const py = u.valToPos(yv, 'y') // CSS px
      const d = Math.abs(py - top)
      if (d < bestDist) {
        bestDist = d
        best = s
      }
    })
    if (best && bestDist <= 44) {
      model.onPointClick?.({
        key: best.key,
        label: best.label,
        color: best.color,
        x: model.xs[idx],
      })
    }
  })
}

// uPlot draws the legend marker as a bordered box; paint it the series color.
function recolorLegend() {
  if (!plot) return
  const rows = plot.root.querySelectorAll('.u-legend .u-series')
  rows.forEach((row, i) => {
    if (i === 0) return
    const marker = row.querySelector('.u-marker')
    if (marker) marker.style.background = plot.series[i].stroke
  })
}

export function destroyChart() {
  if (ro) {
    ro.disconnect()
    ro = null
  }
  if (plot) {
    plot.destroy()
    plot = null
  }
}
