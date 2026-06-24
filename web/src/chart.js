// uPlot wrapper — a single themed trend chart with crosshair value readouts.
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
 *   xs:      number[]           // shared, sorted axis values
 *   series:  [{ label, color, ys:(number|null)[] }]
 *   xlog, ylog: boolean
 *   xLabel, yLabel: string
 *   yFmt:    (v, terse) => string
 * }
 */
export function renderChart(container, model) {
  destroyChart()
  if (!model.series.length || !model.xs.length) return

  const ink = cssVar('--ink')
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
    padding: [12, 18, 6, 8],
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
        points: { show: true, size: 5, width: 0, fill: s.color, stroke: s.color },
        value: (u, v) => model.yFmt(v),
      })),
    ],
  }

  plot = new uPlot(opts, data, container)
  recolorLegend()

  ro = new ResizeObserver(() => {
    if (!plot) return
    const w = container.clientWidth
    plot.setSize({ width: w, height: chartHeight(w) })
  })
  ro.observe(container)
}

// uPlot draws the legend marker as a bordered box; paint it with the series color.
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
