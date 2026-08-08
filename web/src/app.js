// sort·bench explorer — application controller.
import {
  initDB,
  corpusStats,
  listStudies,
  listExperiments,
  listTasks,
  trend,
  runDistribution,
  classifyExperiment,
} from './db.js'
import {
  renderChart,
  destroyChart,
  focusChartSeries,
  resetChartZoom,
  setChartInspection,
} from './chart.js'
import { renderDistribution } from './dist.js'
import { colorsFor } from './palette.js'
import {
  adjacentMeasuredX,
  compareAt,
  taskDisplayName,
} from './comparison.js'
import {
  fmtTime,
  fmtRate,
  fmtInt,
  fmtIntShort,
  axisInfo,
} from './format.js'
import {
  chooseExperiment,
  readUrlView,
  replaceUrlView,
  resolveView,
} from './view-state.js'

const $ = (id) => document.getElementById(id)

const AXIS_ORDER = { cardinality: 0, multiplicity: 1, swaps: 2 }
// Remember views only for this page lifetime. Reloading starts with URL state
// or fresh defaults; nothing is persisted in browser storage.
const viewMemory = { studies: {} }

const STUDY_NOTEBOOKS = {
  fast_sort_study: 'faster_sort_study',
  insertionSort_study: 'insertionSort_study',
  javascript_runtime_sort_study: 'javascriptSort_study',
  merge_heap_Sort_study: 'mergeheapSort_study',
  qsort_study: 'qsort_study',
  slower_sort_study: 'slower_study',
  lean_experimental_study: 'somomboLean_study',
  pr14653_study: 'pr14653_study',
}

const state = {
  study: null,
  experiment: null,
  experiments: [],
  tasks: [], // [{ task_label, executor, alg, color }]
  selected: new Set(),
  xlog: true,
  ylog: false,
  normalize: false,
  spread: false, // per-point error bars on/off
  warmups: 0, // reps discarded as warm-ups before the per-array min (0 = min over all)
  maxReps: 1, // largest rep count in the corpus (Warm-up keeps the last rep)
  rows: [], // trend rows for current study+experiment
  trendCache: new Map(),
  inspectedX: null, // retained only while this experiment still contains x
  zoom: null, // shareable, but deliberately not remembered per experiment
  legendContext: null,
  legendRows: new Map(),
}

const prettyStudy = (s) =>
  s.replace(/_study$/, '').replace(/_/g, ' ').trim()

const expNumber = (name) => {
  const m = name.match(/Experiment\s+(\d+)/i)
  return m ? Number(m[1]) : 99
}

function rememberedStudy(study) {
  return viewMemory.studies[study]
}

function selectedTaskLabels() {
  const selected = state.tasks
    .filter((task) => state.selected.has(task.task_label))
    .map((task) => task.task_label)
  return selected.length === state.tasks.length ? null : selected
}

function currentView() {
  if (!state.study || !state.experiment) return null
  return {
    study: state.study,
    experiment: state.experiment,
    reduction: state.warmups > 0 ? 'warm' : 'min',
    xlog: state.xlog,
    ylog: state.ylog,
    normalize: state.normalize,
    spread: state.spread,
    selected: selectedTaskLabels(),
    inspect: state.inspectedX,
    zoom: state.zoom,
  }
}

function rememberCurrentView() {
  const view = currentView()
  if (!view) return null

  const study = viewMemory.studies[view.study] ?? {
    experiment: view.experiment,
    experiments: {},
  }
  if (!study.experiments || typeof study.experiments !== 'object')
    study.experiments = {}
  study.experiment = view.experiment
  study.experiments[view.experiment] = {
    reduction: view.reduction,
    xlog: view.xlog,
    ylog: view.ylog,
    normalize: view.normalize,
    spread: view.spread,
    selected: view.selected,
  }
  viewMemory.studies[view.study] = study
  return view
}

function commitViewState() {
  const view = rememberCurrentView()
  if (view) replaceUrlView(view)
}

function syncViewControls() {
  for (const [id, key] of [
    ['t-xlog', 'xlog'],
    ['t-ylog', 'ylog'],
    ['t-norm', 'normalize'],
    ['t-spread', 'spread'],
  ]) {
    $(id).setAttribute('aria-pressed', String(state[key]))
  }
  syncReduce()
}

function applyExperimentView(experiment, sharedView = null) {
  const remembered =
    rememberedStudy(state.study)?.experiments?.[experiment.experiment] ?? {}
  const view = resolveView(experiment, remembered, sharedView)

  state.warmups = view.reduction === 'warm' ? state.maxReps - 1 : 0
  state.xlog = view.xlog
  state.ylog = view.ylog
  state.normalize = view.normalize
  state.spread = view.spread
  state.zoom = view.zoom
  if (sharedView) state.inspectedX = view.inspect

  const validTasks = new Set(state.tasks.map((task) => task.task_label))
  state.selected =
    view.selected === null
      ? new Set(validTasks)
      : new Set(view.selected.filter((task) => validTasks.has(task)))

  syncViewControls()
}

// Human label for the active per-array reduction, given warm-ups discarded.
function reductionLabel() {
  const w = state.warmups
  const keep = state.maxReps - w
  if (w <= 0) return 'min over reps'
  if (keep <= 1) return 'warm · last rep'
  return `min · last ${keep} reps`
}

// Reflect the per-array reduction mode into the toggle button + hint.
function syncReduce() {
  const warm = state.warmups > 0
  $('reduce-toggle').setAttribute('aria-pressed', String(warm))
  $('reduce-active').textContent = warm ? 'Warm-up' : 'Min'
  $('reduce-alt').textContent = warm ? '→ Min' : '→ Warm-up'
  $('warm-hint').textContent = warm
    ? `Keeps only the last of the ${state.maxReps} reps, treating the earlier ones as warm-ups.`
    : `Keeps the fastest of the ${state.maxReps} reps — jitter-free (the lab default).`
}

// ----------------------------------------------------------------- boot
async function main() {
  const setStatus = (t) => ($('boot-status').textContent = t)
  try {
    await initDB(setStatus)
    setStatus('Indexing studies…')

    const [stats, studies] = await Promise.all([corpusStats(), listStudies()])
    paintCorpus(stats)
    state.maxReps = Math.max(1, stats.maxReps)
    buildStudySelect(studies)

    const sharedView = readUrlView()
    // Lead with the cross-language head-to-head unless a shared URL says which
    // study to open.
    const opening =
      studies.find((s) => s.study === sharedView?.study) ??
      studies.find((s) => s.study === 'fast_sort_study') ??
      studies[0]
    await selectStudy(
      opening.study,
      sharedView?.study === opening.study ? sharedView : null,
    )
    wireControls()

    $('app').hidden = false
    requestAnimationFrame(() => $('boot').classList.add('done'))
  } catch (err) {
    console.error(err)
    $('boot-status').innerHTML = `Failed to load: ${err.message}`
    $('boot-status').style.color = 'var(--s8)'
  }
}

function paintCorpus(s) {
  document.querySelector('[data-stat="rows"]').textContent = fmtInt(s.rows)
  document.querySelector('[data-stat="studies"]').textContent = s.studies
  document.querySelector('[data-stat="langs"]').textContent = s.langs
  document.querySelector('[data-stat="algos"]').textContent = s.algos
}

function buildStudySelect(studies) {
  const sel = $('study')
  sel.innerHTML = ''
  for (const { study, n } of studies) {
    const opt = document.createElement('option')
    opt.value = study
    opt.textContent = `${prettyStudy(study)}  ·  ${fmtIntShort(n)} pts`
    sel.appendChild(opt)
  }
}

// ----------------------------------------------------------------- study
async function selectStudy(study, sharedView = null) {
  rememberCurrentView()
  state.study = study
  state.experiment = null
  $('study').value = study

  const [experiments, tasks] = await Promise.all([
    listExperiments(study),
    listTasks(study),
  ])

  experiments.sort(
    (a, b) =>
      AXIS_ORDER[a.axis] - AXIS_ORDER[b.axis] ||
      Number(a.descending) - Number(b.descending) ||
      expNumber(a.experiment) - expNumber(b.experiment),
  )
  state.experiments = experiments

  const colors = colorsFor(tasks.map((task) => task.task_label))
  state.tasks = tasks.map((task, index) => ({
    ...task,
    color: colors[index],
  }))

  const rememberedExperiment = sharedView
    ? undefined
    : rememberedStudy(study)?.experiment
  const openingExperiment = chooseExperiment(
    experiments,
    sharedView?.experiment,
    rememberedExperiment,
  )
  if (!openingExperiment) throw new Error(`Study ${study} has no experiments`)
  state.experiment = openingExperiment.experiment
  applyExperimentView(openingExperiment, sharedView)

  $('study-hint').textContent = `${tasks.length} tasks across ${
    new Set(tasks.map((t) => t.executor)).size
  } runtimes · ${experiments.length} experiments`

  const nb = STUDY_NOTEBOOKS[study]
  const colabLink = $('colab-link')
  if (nb) {
    colabLink.href = `https://colab.research.google.com/github/somombo/sort-bench/blob/main/lab/${nb}.ipynb`
    colabLink.hidden = false
  } else {
    colabLink.hidden = true
  }

  buildExperimentList()

  commitViewState()
  await loadTrend()
}

async function selectExperiment(experiment) {
  if (state.experiment === experiment.experiment) return
  rememberCurrentView()
  state.experiment = experiment.experiment
  applyExperimentView(experiment)
  syncExperimentList()
  commitViewState()
  await loadTrend()
}

function buildExperimentList() {
  const wrap = $('experiments')
  wrap.innerHTML = ''
  for (const exp of state.experiments) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'exp-item'
    btn.setAttribute('role', 'radio')
    btn.dataset.exp = exp.experiment
    btn.title = exp.experiment
    btn.innerHTML = `
      <span class="exp-tick" aria-hidden="true"></span>
      <span class="exp-name">${axisInfo(exp.axis).label}</span>
      <span class="exp-axis">${exp.descending ? 'desc' : 'asc'}</span>`
    btn.addEventListener('click', () => selectExperiment(exp))
    wrap.appendChild(btn)
  }
}

function syncExperimentList() {
  for (const btn of $('experiments').children) {
    btn.setAttribute(
      'aria-checked',
      String(btn.dataset.exp === state.experiment),
    )
  }
}

// ----------------------------------------------------------------- data
async function loadTrend() {
  syncExperimentList()
  const key = `${state.study}::${state.experiment}::w${state.warmups}`
  let rows = state.trendCache.get(key)
  if (!rows) {
    rows = await trend(state.study, state.experiment, state.warmups)
    state.trendCache.set(key, rows)
  }
  state.rows = rows

  // Log-x hides non-positive points rather than disabling the control.
  $('t-xlog').disabled = false

  draw()
}

// ----------------------------------------------------------------- draw
function draw() {
  const meta = classifyExperiment(state.experiment)
  const info = axisInfo(meta.axis)
  // A logarithmic x axis cannot represent zero or negative values. Keep those
  // points available in linear view, but omit them from this rendering.
  const rows = state.xlog ? state.rows.filter((r) => r.x > 0) : state.rows
  const omittedNonPositive = rows.length !== state.rows.length
  paintStageHead(meta, info, rows, omittedNonPositive)

  const selected = state.tasks.filter((t) => state.selected.has(t.task_label))
  const empty = $('chart-empty')
  empty.hidden = selected.length > 0 && rows.length > 0
  empty.textContent = selected.length
    ? 'No positive axis values are available for a logarithmic x scale.'
    : 'No tasks shown — select one or more in the legend.'

  // pivot rows -> shared xs + per-series aligned values + spread summaries
  const xs = [...new Set(rows.map((r) => r.x))].sort((a, b) => a - b)
  if (state.inspectedX != null && !xs.includes(state.inspectedX))
    state.inspectedX = null
  const byTask = new Map()
  for (const r of rows) {
    if (!byTask.has(r.task_label)) byTask.set(r.task_label, new Map())
    byTask.get(r.task_label).set(r.x, r)
  }

  const norm = (v, x) => (v == null ? null : state.normalize ? v / x : v)

  const series = state.tasks.map((t) => {
    const pts = byTask.get(t.task_label) ?? new Map()
    const ys = xs.map((x) => norm(pts.get(x)?.y, x))
    const stats = xs.map((x) => {
      const r = pts.get(x)
      if (!r) return null
      return {
        lo: norm(r.lo, x),
        q1: norm(r.q1, x),
        med: norm(r.y, x),
        q3: norm(r.q3, x),
        hi: norm(r.hi, x),
      }
    })
    return {
      key: t.task_label,
      label: taskDisplayName(t),
      color: t.color,
      show: state.selected.has(t.task_label),
      ys,
      stats,
    }
  })

  buildLegend(xs, byTask, info)
  destroyChart()
  if (state.tasks.length && xs.length) {
    renderChart($('chart'), {
      xs,
      series,
      xlog: state.xlog,
      ylog: state.ylog,
      spread: state.spread,
      xLabel: `${info.label} (${info.unit})`,
      yLabel: state.normalize ? 'ns per element' : 'Duration',
      yFmt: state.normalize ? fmtRate : fmtTime,
      zoom: state.zoom,
      inspectedX: state.inspectedX,
      onCursorIndex: (index) => inspectX(xs[index]),
      onSeriesFocus: syncLegendFocus,
      onZoomChange: syncZoomState,
      onPointClick: openDistribution,
    })
  } else {
    syncZoomState(null, false)
  }

  commitViewState()
}

function paintStageHead(meta, info, rows, omittedNonPositive) {
  $('stage-title').textContent = `${prettyStudy(state.study)} — ${
    info.label
  }${meta.descending ? ' (descending)' : ''}`

  const bits = [info.blurb]
  if (meta.fixedSize)
    bits.push(`Total size held at ${fmtInt(meta.fixedSize)} elements.`)
  if (meta.descending)
    bits.push('Inputs start in reverse-sorted order.')
  $('stage-sub').textContent = bits.join(' ')

  const xs = rows.map((r) => r.x)
  const sweep = xs.length
    ? `${fmtIntShort(Math.min(...xs))} → ${fmtIntShort(Math.max(...xs))}`
    : 'no positive values'
  const runs = rows.length
    ? Math.max(...rows.map((r) => r.runs))
    : 0
  $('stage-axis').innerHTML = `
    swept <b>${sweep}</b><br />
    median of ${runs} arrays · ${reductionLabel()}`

  // editorial figure caption beneath the chart
  const yName = state.normalize ? 'Time per element' : 'Sort duration'
  const xName = info.label.toLowerCase()
  const scaleTxt = `${state.ylog ? 'log' : 'linear'}–${state.xlog ? 'log' : 'linear'}`
  const qualifiers = []
  if (omittedNonPositive)
    qualifiers.push('non-positive x values omitted for log scale')
  if (state.spread) qualifiers.push('bars show min–IQR–max spread')
  $('chart-cap').textContent =
    `Fig. 1 — ${yName} versus ${xName}, by language and algorithm. ` +
    `${scaleTxt} axes; each point is the median of ${runs} independent random ` +
    `arrays (${reductionLabel()})${qualifiers.length ? '; ' + qualifiers.join('; ') : ''}.`
}

function buildLegend(xs, byTask, info) {
  const list = $('legend-list')
  const fragment = document.createDocumentFragment()
  state.legendRows = new Map()
  state.legendContext = { xs, byTask, info }

  for (const task of state.tasks) {
    const row = document.createElement('button')
    row.type = 'button'
    row.className = 'legend-row'
    row.dataset.task = task.task_label
    row.style.setProperty('--c', task.color)

    const sample = document.createElement('span')
    sample.className = 'legend-sample'
    sample.setAttribute('aria-hidden', 'true')

    const identity = document.createElement('span')
    identity.className = 'legend-identity'
    const executor = document.createElement('span')
    executor.className = 'legend-executor'
    executor.textContent = task.executor
    identity.appendChild(executor)
    if (task.alg?.trim()) {
      const args = document.createElement('span')
      args.className = 'legend-args'
      args.textContent = task.alg
      identity.appendChild(args)
    }

    const metrics = document.createElement('span')
    metrics.className = 'legend-metrics'
    const value = document.createElement('span')
    value.className = 'legend-value'
    const relative = document.createElement('span')
    relative.className = 'legend-relative'
    metrics.append(value, relative)
    row.append(sample, identity, metrics)

    row.addEventListener('click', () => {
      if (state.selected.has(task.task_label))
        state.selected.delete(task.task_label)
      else state.selected.add(task.task_label)
      draw()
    })
    row.addEventListener('pointerenter', () =>
      focusChartSeries(task.task_label),
    )
    row.addEventListener('pointerleave', () => focusChartSeries(null))
    row.addEventListener('focus', () => focusChartSeries(task.task_label))
    row.addEventListener('blur', () => focusChartSeries(null))

    state.legendRows.set(task.task_label, { row, value, relative })
    fragment.appendChild(row)
  }

  list.replaceChildren(fragment)
  paintLegendComparison()
}

function inspectX(x) {
  if (x == null || x === state.inspectedX) return
  state.inspectedX = x
  setChartInspection(x)
  paintLegendComparison()
  commitViewState()
}

function stepInspection(direction) {
  const xs = state.legendContext?.xs ?? []
  if (xs.length === 0 || (state.inspectedX != null && xs.length < 2)) return
  const next = adjacentMeasuredX(xs, state.inspectedX, direction)
  if (next != null) inspectX(next)
}

function formatRelative(relative) {
  if (relative < 2) return `${relative.toFixed(2)}×`
  if (relative < 10) return `${relative.toFixed(1)}×`
  return `${relative.toFixed(0)}×`
}

function paintLegendComparison() {
  const context = state.legendContext
  if (!context) return
  const { xs, byTask, info } = context
  const x = state.inspectedX
  const yFmt = state.normalize ? fmtRate : fmtTime
  const outsideZoom = inspectionOutsideZoom(x)
  const inspectionIndex = x == null ? -1 : xs.indexOf(x)

  const legendAt = $('legend-at')
  legendAt.textContent =
    x == null
      ? 'Choose a measured x value.'
      : `${info.label} = ${fmtInt(x)}${
          outsideZoom ? ' · outside current zoom' : ''
        } · ${inspectionIndex + 1} of ${xs.length}`
  legendAt.classList.toggle('has-inspection', x != null)
  legendAt.classList.toggle('is-outside-zoom', outsideZoom)

  const previousX = adjacentMeasuredX(xs, x, -1)
  const nextX = adjacentMeasuredX(xs, x, 1)
  const previous = $('inspect-prev')
  const next = $('inspect-next')
  const canStep = xs.length > 0 && (x == null || xs.length > 1)
  previous.setAttribute('aria-disabled', String(!canStep))
  next.setAttribute('aria-disabled', String(!canStep))
  previous.setAttribute(
    'aria-label',
    previousX == null
      ? 'No previous measured x value'
      : x == null
        ? `Inspect last measured x value: ${fmtInt(previousX)}`
        : `Inspect previous measured x value: ${fmtInt(previousX)}${
            inspectionIndex === 0 ? ' (wraps to last)' : ''
          }`,
  )
  next.setAttribute(
    'aria-label',
    nextX == null
      ? 'No next measured x value'
      : x == null
        ? `Inspect first measured x value: ${fmtInt(nextX)}`
        : `Inspect next measured x value: ${fmtInt(nextX)}${
            inspectionIndex === xs.length - 1 ? ' (wraps to first)' : ''
          }`,
  )

  const comparison =
    x == null
      ? state.tasks.map((task) => ({
          task,
          visible: state.selected.has(task.task_label),
          value: null,
          fastest: false,
          relative: null,
        }))
      : compareAt(state.tasks, state.selected, byTask, x, state.normalize)

  for (const item of comparison) {
    const parts = state.legendRows.get(item.task.task_label)
    if (!parts) continue
    const { row, value, relative } = parts
    row.setAttribute('aria-pressed', String(item.visible))

    let valueText = '—'
    let relativeText = '—'
    if (!item.visible) relativeText = 'hidden'
    else if (x != null && item.value == null) valueText = 'no data'
    else if (item.value != null) {
      valueText = yFmt(item.value)
      relativeText = item.fastest
        ? 'fastest'
        : formatRelative(item.relative)
    }

    value.textContent = valueText
    relative.textContent = relativeText
    relative.classList.toggle('is-fastest', item.fastest)
    row.setAttribute(
      'aria-label',
      `${taskDisplayName(item.task)}, ${item.visible ? 'shown' : 'hidden'}, ` +
        `${valueText}, ${relativeText}. ${item.visible ? 'Hide' : 'Show'} line.`,
    )
  }

  const visibleCount = state.selected.size
  const showAll = document.querySelector('.legend-bulk [data-bulk="all"]')
  const hideAll = document.querySelector('.legend-bulk [data-bulk="none"]')
  showAll.disabled = visibleCount === state.tasks.length
  hideAll.disabled = visibleCount === 0
}

function inspectionOutsideZoom(x) {
  if (x == null || !state.zoom) return false
  const { xMin, xMax } = state.zoom
  const tolerance = Math.max(1, Math.abs(xMin), Math.abs(xMax)) * 1e-9
  return x < xMin - tolerance || x > xMax + tolerance
}

function syncLegendFocus(taskLabel) {
  for (const [key, { row }] of state.legendRows) {
    row.classList.toggle('is-focused', key === taskLabel)
  }
}

function cleanZoom(zoom) {
  if (!zoom) return null
  return Object.fromEntries(
    Object.entries(zoom).map(([key, value]) => [
      key,
      Number(value.toPrecision(12)),
    ]),
  )
}

function syncZoomState(zoom, zoomed) {
  const next = zoomed ? cleanZoom(zoom) : null
  const changed = JSON.stringify(next) !== JSON.stringify(state.zoom)
  state.zoom = next
  $('reset-zoom').disabled = !zoomed
  if (changed) {
    paintLegendComparison()
    commitViewState()
  }
}

// ----------------------------------------------------------------- controls
function wireControls() {
  $('study').addEventListener('change', (e) => selectStudy(e.target.value))

  const toggle = (id, key) => {
    const btn = $(id)
    btn.addEventListener('click', () => {
      if (btn.disabled) return
      state[key] = !state[key]
      if (key !== 'spread') state.zoom = null
      btn.setAttribute('aria-pressed', String(state[key]))
      draw()
    })
  }
  toggle('t-xlog', 'xlog')
  toggle('t-ylog', 'ylog')
  toggle('t-norm', 'normalize')
  toggle('t-spread', 'spread')

  // per-array reduction: one button toggling Min (all reps) ⇄ Warm-up (last rep)
  $('reduce-toggle').addEventListener('click', () => {
    state.warmups = state.warmups > 0 ? 0 : state.maxReps - 1
    state.zoom = null
    syncReduce()
    commitViewState()
    loadTrend() // reduction changes the SQL — re-query
  })
  syncReduce()

  for (const b of document.querySelectorAll('.legend-bulk button')) {
    b.addEventListener('click', () => {
      state.selected =
        b.dataset.bulk === 'all'
          ? new Set(state.tasks.map((t) => t.task_label))
          : new Set()
      draw()
    })
  }

  $('inspect-prev').addEventListener('click', () => stepInspection(-1))
  $('inspect-next').addEventListener('click', () => stepInspection(1))
  document
    .querySelector('.legend-inspection')
    .addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      stepInspection(e.key === 'ArrowLeft' ? -1 : 1)
    })

  $('reset-zoom').addEventListener('click', () => {
    if (!resetChartZoom()) {
      state.zoom = null
      draw()
    }
  })

  // distribution drawer: backdrop click closes
  const dlg = $('dist')
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg) dlg.close()
  })
}

// ----------------------------------------------------------------- drawer
async function openDistribution({ key, label, color, x }) {
  const dlg = $('dist')
  const meta = state.tasks.find((t) => t.task_label === key)
  dlg.dataset.loading = '1'
  dlg.showModal()
  try {
    const rows = await runDistribution(
      state.study,
      state.experiment,
      key,
      x,
      state.warmups,
    )
    renderDistribution(dlg, {
      label,
      executor: meta?.executor ?? '',
      color,
      axisLabel: axisInfo(classifyExperiment(state.experiment).axis).label,
      x,
      rows,
      warmups: state.warmups,
    })
  } catch (err) {
    console.error(err)
    dlg.close()
  }
}

main()
