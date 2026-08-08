// uPlot wrapper — a single themed trend chart with crosshair readouts,
// an optional spread overlay (error bars / box-whiskers), and click-to-inspect.
import uPlot from 'https://cdn.jsdelivr.net/npm/uplot@1.6.31/dist/uPlot.esm.js'
import { fmtInt, fmtIntShort } from './format.js'

const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

let plot = null
let ro = null
let activeModel = null
let activeInspection = null
let fullScales = null
let zoomReady = false

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
 *   zoom:    {xMin,xMax,yMin,yMax}|null
 *   inspectedX: number|null
 *   onCursorIndex: (index) => void
 *   onSeriesFocus: (key|null) => void
 *   onZoomChange: (zoom|null, zoomed) => void
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
  const inspection = createInspection(model)
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
      drag: { setScale: true, x: true, y: false, dist: 8 },
      points: { size: 6, width: 2, stroke: (u, i) => model.series[i - 1].color },
    },
    focus: { alpha: 0.16 },
    scales: {
      x: { distr: model.xlog ? 3 : 1 },
      y: { distr: model.ylog ? 3 : 1 },
    },
    legend: { show: false },
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
        show: s.show,
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
      ready: [(u) => (fullScales = scaleSnapshot(u))],
      draw: [
        (u) => {
          drawSpread(u, model)
          positionInspection(u, model, inspection)
          reportZoom(u, model)
        },
      ],
      setCursor: [
        (u) => {
          syncInspectionFromCursor(u, model, inspection)
        },
      ],
      setSeries: [
        (u, seriesIdx, opts) => {
          if (!opts || !Object.hasOwn(opts, 'focus')) return
          applyFocusWidth(u, seriesIdx, Boolean(opts.focus))
          const key =
            opts.focus && seriesIdx > 0
              ? model.series[seriesIdx - 1]?.key ?? null
              : null
          model.onSeriesFocus?.(key)
        },
      ],
    },
  }

  plot = new uPlot(opts, data, container)
  activeModel = model
  activeInspection = inspection
  // Flush uPlot's queued initial autoscale before applying a shared zoom. This
  // ensures the ready hook captures the true full domain, not the URL bounds.
  plot.batch(() => {})
  fullScales ??= scaleSnapshot(plot)
  const initialZoom = validZoom(model.zoom, model)
  if (initialZoom) {
    plot.batch(() => {
      plot.setScale('x', { min: initialZoom.xMin, max: initialZoom.xMax })
      plot.setScale('y', { min: initialZoom.yMin, max: initialZoom.yMax })
    })
  }
  zoomReady = true
  reportZoom(plot, model)
  bindClicks(plot, model)
  bindInspection(plot, model, inspection)

  ro = new ResizeObserver(() => {
    if (!plot) return
    const w = container.clientWidth
    plot.setSize({ width: w, height: chartHeight(w) })
  })
  ro.observe(container)
}

/** Move the retained inspection guide without rebuilding the chart. */
export function setChartInspection(value) {
  if (!plot || !activeModel || !activeInspection) return false
  if (!activeModel.xs.includes(value)) return false

  activeModel.inspectedX = value
  activeInspection.value = value
  positionInspection(plot, activeModel, activeInspection)
  return true
}

function createInspection(model) {
  return {
    value: Number.isFinite(model.inspectedX) ? model.inspectedX : null,
    callout: null,
    guide: null,
    markers: [],
    pointerInside: false,
    restoreFrame: null,
  }
}

function syncInspectionFromCursor(u, model, inspection) {
  if (!inspection.pointerInside) return
  const index = u.cursor.idx
  if (index == null || index < 0 || index >= model.xs.length) return

  const value = model.xs[index]
  inspection.value = value
  model.inspectedX = value
  positionInspection(u, model, inspection)
  model.onCursorIndex?.(index)
}

function bindInspection(u, model, inspection) {
  const guide = document.createElement('div')
  guide.className = 'chart-inspection-guide'
  guide.setAttribute('aria-hidden', 'true')
  guide.hidden = true
  u.over.appendChild(guide)
  inspection.guide = guide

  inspection.markers = model.series.map((series) => {
    const marker = document.createElement('div')
    marker.className = 'chart-inspection-marker'
    marker.style.setProperty('--c', series.color)
    marker.setAttribute('aria-hidden', 'true')
    marker.hidden = true
    u.over.appendChild(marker)
    return marker
  })

  const callout = document.createElement('div')
  callout.className = 'chart-x-callout'
  callout.setAttribute('aria-hidden', 'true')
  callout.hidden = true
  u.root.appendChild(callout)
  inspection.callout = callout

  u.over.addEventListener('mouseenter', () => {
    inspection.pointerInside = true
    hideRetainedInspection(inspection)
  })
  u.over.addEventListener('mouseleave', () => {
    inspection.pointerInside = false
    queueInspectionRestore(u, model, inspection)
  })

  restoreInspection(u, model, inspection)
}

function queueInspectionRestore(u, model, inspection) {
  if (inspection.restoreFrame != null)
    cancelAnimationFrame(inspection.restoreFrame)
  inspection.restoreFrame = requestAnimationFrame(() => {
    inspection.restoreFrame = null
    restoreInspection(u, model, inspection)
  })
}

function restoreInspection(u, model, inspection) {
  if (u !== plot || !inspection.callout) return
  positionInspection(u, model, inspection)
}

function inspectionInView(u, value) {
  const { min, max } = u.scales.x
  if (![value, min, max].every(Number.isFinite)) return false
  const tolerance = Math.max(1, Math.abs(min), Math.abs(max)) * 1e-9
  return value >= min - tolerance && value <= max + tolerance
}

function positionInspection(u, model, inspection) {
  const callout = inspection.callout
  const value = inspection.value
  if (!callout || !Number.isFinite(value) || !inspectionInView(u, value)) {
    hideInspection(inspection)
    return
  }

  const index = model.xs.indexOf(value)
  if (index < 0) {
    hideInspection(inspection)
    return
  }

  callout.textContent = fmtInt(value)
  callout.hidden = false
  callout.style.top = `${u.over.offsetTop + u.over.offsetHeight + 3}px`

  const desiredLeft = u.over.offsetLeft + u.valToPos(value, 'x')
  const halfWidth = callout.offsetWidth / 2
  const inset = 4
  const left = Math.min(
    u.root.clientWidth - halfWidth - inset,
    Math.max(halfWidth + inset, desiredLeft),
  )
  callout.style.left = `${left}px`

  if (inspection.pointerInside) {
    hideRetainedInspection(inspection)
    return
  }

  const x = u.valToPos(value, 'x')
  inspection.guide.hidden = false
  inspection.guide.style.left = `${x}px`

  const yScale = u.scales.y
  model.series.forEach((series, seriesIndex) => {
    const marker = inspection.markers[seriesIndex]
    const y = series.ys[index]
    const visible =
      u.series[seriesIndex + 1].show &&
      Number.isFinite(y) &&
      y >= yScale.min &&
      y <= yScale.max
    marker.hidden = !visible
    if (!visible) return
    marker.style.left = `${x}px`
    marker.style.top = `${u.valToPos(y, 'y')}px`
  })
}

function hideRetainedInspection(inspection) {
  if (inspection.guide) inspection.guide.hidden = true
  inspection.markers.forEach((marker) => (marker.hidden = true))
}

function hideInspection(inspection) {
  if (inspection.callout) inspection.callout.hidden = true
  hideRetainedInspection(inspection)
}

function validZoom(zoom, model) {
  if (
    !zoom ||
    ![zoom.xMin, zoom.xMax, zoom.yMin, zoom.yMax].every(Number.isFinite) ||
    zoom.xMin >= zoom.xMax ||
    zoom.yMin >= zoom.yMax
  )
    return null
  if ((model.xlog && zoom.xMin <= 0) || (model.ylog && zoom.yMin <= 0))
    return null
  return zoom
}

function scaleSnapshot(u) {
  const x = u.scales.x
  const y = u.scales.y
  if (![x.min, x.max, y.min, y.max].every(Number.isFinite)) return null
  return {
    xMin: x.min,
    xMax: x.max,
    yMin: y.min,
    yMax: y.max,
  }
}

function nearlyEqual(a, b) {
  const size = Math.max(1, Math.abs(a), Math.abs(b))
  return Math.abs(a - b) <= size * 1e-9
}

function sameZoom(a, b) {
  return (
    a &&
    b &&
    nearlyEqual(a.xMin, b.xMin) &&
    nearlyEqual(a.xMax, b.xMax) &&
    nearlyEqual(a.yMin, b.yMin) &&
    nearlyEqual(a.yMax, b.yMax)
  )
}

function reportZoom(u, model) {
  if (!zoomReady || u !== plot) return
  const current = scaleSnapshot(u)
  if (!fullScales) {
    const zoomed = Boolean(model.zoom && current)
    model.onZoomChange?.(zoomed ? current : null, zoomed)
    return
  }
  const zoomed = Boolean(current && fullScales && !sameZoom(current, fullScales))
  model.onZoomChange?.(zoomed ? current : null, zoomed)
}

function applyFocusWidth(u, seriesIdx, focused) {
  for (let i = 1; i < u.series.length; i += 1) u.series[i].width = 2
  if (focused && seriesIdx > 0) u.series[seriesIdx].width = 3.5
  u.redraw(false)
}

/** Focus one chart trace from the external legend, or clear focus with null. */
export function focusChartSeries(key) {
  if (!plot || !activeModel) return
  const modelIndex = activeModel.series.findIndex((series) => series.key === key)
  if (modelIndex < 0) plot.setSeries(null, { focus: false })
  else plot.setSeries(modelIndex + 1, { focus: true })
}

/** Restore the current chart to the full x/y domains captured at render time. */
export function resetChartZoom() {
  if (!plot || !fullScales) return false
  plot.batch(() => {
    plot.setScale('x', { min: fullScales.xMin, max: fullScales.xMax })
    plot.setScale('y', { min: fullScales.yMin, max: fullScales.yMax })
  })
  if (activeInspection)
    queueInspectionRestore(plot, activeModel, activeInspection)
  return true
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

export function destroyChart() {
  zoomReady = false
  activeModel = null
  if (activeInspection?.restoreFrame != null)
    cancelAnimationFrame(activeInspection.restoreFrame)
  activeInspection = null
  fullScales = null
  if (ro) {
    ro.disconnect()
    ro = null
  }
  if (plot) {
    plot.destroy()
    plot = null
  }
}
