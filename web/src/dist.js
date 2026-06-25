// Run-distribution drawer — the raw spread behind one plotted point.
// Renders a horizontal box-whisker plus a strip of every individual run.
import { fmtTime, fmtInt } from './format.js'

// Linear-interpolated quantile over an ascending array (matches quantile_cont).
function quantile(sorted, p) {
  if (!sorted.length) return null
  if (sorted.length === 1) return sorted[0]
  const i = p * (sorted.length - 1)
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

// Deterministic jitter in [-1, 1] from an integer index.
function jitter(i) {
  const v = Math.sin((i + 1) * 12.9898) * 43758.5453
  return (v - Math.floor(v)) * 2 - 1
}

const VB_W = 560
const PAD_L = 44
const PAD_R = 24
const Y_C = 66

export function renderDistribution(dialog, ctx) {
  const { label, executor, color, axisLabel, x, rows, warmups = 0 } = ctx
  const vals = rows.map((r) => r.metric).sort((a, b) => a - b)
  const n = vals.length

  const lo = vals[0]
  const hi = vals[n - 1]
  const q1 = quantile(vals, 0.25)
  const med = quantile(vals, 0.5)
  const q3 = quantile(vals, 0.75)
  const iqr = q3 - q1
  const spreadPct = med ? ((hi - lo) / med) * 100 : 0

  const range = (sel) => {
    const lo = Math.min(...rows.map(sel))
    const hi = Math.max(...rows.map(sel))
    return { hi, txt: lo === hi ? `${lo}` : `${lo}–${hi}` }
  }
  const reps = range((r) => r.reps)
  const kept = range((r) => r.kept ?? r.reps)
  const repsTxt = reps.txt
  const keptTxt = kept.txt
  const reduced =
    warmups <= 0
      ? 'minimum over reps'
      : kept.hi <= 1
        ? 'last (warm-up) rep'
        : `min over its last ${keptTxt} reps (first ${warmups} discarded as warm-ups)`

  // pad domain so caps/dots stay inside the frame
  const span = hi - lo || Math.max(hi, 1)
  const d0 = lo - span * 0.06
  const d1 = hi + span * 0.06
  const xpos = (v) => PAD_L + ((v - d0) / (d1 - d0)) * (VB_W - PAD_L - PAD_R)

  const xLo = xpos(lo)
  const xHi = xpos(hi)
  const xQ1 = xpos(q1)
  const xQ3 = xpos(q3)
  const xMed = xpos(med)

  // five evenly spaced axis ticks across the data range
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4)

  const dots = rows
    .map((r, i) => {
      const cx = xpos(r.metric).toFixed(1)
      const cy = (Y_C + jitter(i) * 17).toFixed(1)
      return `<circle class="dist-dot" cx="${cx}" cy="${cy}" r="3.1">
        <title>${fmtTime(r.metric)} · ${r.reps} reps</title></circle>`
    })
    .join('')

  const tickMarks = ticks
    .map((t) => {
      const px = xpos(t).toFixed(1)
      return `<line x1="${px}" y1="104" x2="${px}" y2="110" class="dist-tick" />
        <text x="${px}" y="124" class="dist-ticklabel">${fmtTime(t, true)}</text>`
    })
    .join('')

  const box =
    n > 1
      ? `
      <line x1="${xLo}" y1="${Y_C}" x2="${xQ1}" y2="${Y_C}" class="dist-whisker" />
      <line x1="${xQ3}" y1="${Y_C}" x2="${xHi}" y2="${Y_C}" class="dist-whisker" />
      <line x1="${xLo}" y1="${Y_C - 11}" x2="${xLo}" y2="${Y_C + 11}" class="dist-whisker" />
      <line x1="${xHi}" y1="${Y_C - 11}" x2="${xHi}" y2="${Y_C + 11}" class="dist-whisker" />
      <rect x="${xQ1}" y="${Y_C - 19}" width="${Math.max(xQ3 - xQ1, 0.5)}" height="38"
            rx="3" class="dist-box" />
      <line x1="${xMed}" y1="${Y_C - 19}" x2="${xMed}" y2="${Y_C + 19}" class="dist-median" />`
      : ''

  const stat = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`

  dialog.innerHTML = `
    <form method="dialog" class="dist-card" style="--c:${color}">
      <header class="dist-head">
        <div class="dist-id">
          <span class="dist-dotmark" aria-hidden="true"></span>
          <div>
            <p class="dist-lang">${executor}</p>
            <h2 class="dist-title">${label}</h2>
          </div>
        </div>
        <button class="dist-close" value="close" aria-label="Close">esc</button>
      </header>

      <p class="dist-context">
        ${axisLabel} = <b>${fmtInt(x)}</b> · <b>${n}</b> independent random
        ${n === 1 ? 'array' : 'arrays'} · ${repsTxt} reps each${
          warmups > 0
            ? kept.hi <= 1
              ? ' · last rep only'
              : ` · last ${keptTxt} kept`
            : ''
        }
      </p>

      <svg class="dist-svg" viewBox="0 0 ${VB_W} 132" role="img"
           aria-label="Distribution of run times">
        <line x1="${PAD_L}" y1="104" x2="${VB_W - PAD_R}" y2="104" class="dist-axis" />
        ${tickMarks}
        ${box}
        <g class="dist-dots">${dots}</g>
      </svg>

      <dl class="dist-stats">
        ${stat('min', fmtTime(lo))}
        ${stat('Q1', fmtTime(q1))}
        ${stat('median', fmtTime(med))}
        ${stat('Q3', fmtTime(q3))}
        ${stat('max', fmtTime(hi))}
        ${stat('IQR', fmtTime(iqr))}
        ${stat('span', `${spreadPct.toFixed(0)}%`)}
      </dl>

      <p class="dist-foot">
        Each dot is one random array, reduced to its <b>${reduced}</b>. The
        plotted point is the <b>median</b> of these; the box spans the
        inter-quartile range.
      </p>
    </form>`
}
