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
import { renderChart, destroyChart } from './chart.js'
import { renderDistribution } from './dist.js'
import { colorFor } from './palette.js'
import {
  fmtTime,
  fmtRate,
  fmtInt,
  fmtIntShort,
  axisInfo,
} from './format.js'
import {
  chooseExperiment,
  loadViewMemory,
  readUrlView,
  replaceUrlView,
  resolveView,
  saveViewMemory,
} from './view-state.js'

const $ = (id) => document.getElementById(id)

const AXIS_ORDER = { cardinality: 0, multiplicity: 1, swaps: 2 }
const viewMemory = loadViewMemory()

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
  saveViewMemory(viewMemory)
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

  const validTasks = new Set(state.tasks.map((task) => task.task_label))
  state.selected =
    view.selected === null
      ? new Set(validTasks)
      : new Set(view.selected.filter((task) => validTasks.has(task)))

  syncViewControls()
  syncSeriesList()
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

  state.tasks = tasks.map((t, i) => ({ ...t, color: colorFor(i) }))

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

  $('study-hint').textContent = `${tasks.length} algorithms across ${
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
  buildSeriesList()

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

function buildSeriesList() {
  const wrap = $('series')
  wrap.innerHTML = ''
  for (const t of state.tasks) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'series-item'
    btn.style.setProperty('--c', t.color)
    btn.dataset.task = t.task_label
    btn.innerHTML = `
      <span class="series-swatch" aria-hidden="true"></span>
      <span class="series-meta">
        <span class="series-lang">${t.executor}</span>
        <span class="series-alg" title="${t.alg}">${t.alg}</span>
      </span>`
    btn.addEventListener('click', () => {
      if (state.selected.has(t.task_label)) state.selected.delete(t.task_label)
      else state.selected.add(t.task_label)
      syncSeriesList()
      draw()
    })
    wrap.appendChild(btn)
  }
  syncSeriesList()
}

function syncSeriesList() {
  for (const btn of $('series').children) {
    btn.setAttribute(
      'aria-pressed',
      String(state.selected.has(btn.dataset.task)),
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
    : 'No algorithms selected — pick one or more from the list.'

  // pivot rows -> shared xs + per-series aligned values + spread summaries
  const xs = [...new Set(rows.map((r) => r.x))].sort((a, b) => a - b)
  const byTask = new Map()
  for (const r of rows) {
    if (!byTask.has(r.task_label)) byTask.set(r.task_label, new Map())
    byTask.get(r.task_label).set(r.x, r)
  }

  const norm = (v, x) => (v == null ? null : state.normalize ? v / x : v)

  const series = selected.map((t) => {
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
      label: `${t.executor} · ${t.alg}`,
      color: t.color,
      ys,
      stats,
    }
  })

  destroyChart()
  if (selected.length && xs.length) {
    renderChart($('chart'), {
      xs,
      series,
      xlog: state.xlog,
      ylog: state.ylog,
      spread: state.spread,
      xLabel: `${info.label} (${info.unit})`,
      yLabel: state.normalize ? 'ns per element' : 'Duration',
      yFmt: state.normalize ? fmtRate : fmtTime,
      onPointClick: openDistribution,
    })
  }

  paintRanking(meta, info, xs, byTask, selected)
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

function paintRanking(meta, info, xs, byTask, selected) {
  const list = $('ranking-list')
  list.innerHTML = ''
  if (!selected.length || !xs.length) {
    $('ranking-note').textContent = ''
    return
  }
  const maxX = xs[xs.length - 1]

  // rank by absolute median duration at the largest axis value
  const ranked = selected
    .map((t) => ({ t, y: byTask.get(t.task_label)?.get(maxX)?.y ?? null }))
    .filter((d) => d.y != null)
    .sort((a, b) => a.y - b.y)

  if (!ranked.length) {
    $('ranking-note').textContent = 'no data at peak axis value'
    return
  }
  const fastest = ranked[0].y
  const slowest = ranked[ranked.length - 1].y

  $('ranking-title').textContent = `Fastest at ${info.label.toLowerCase()} = ${fmtInt(
    maxX,
  )}`
  $('ranking-note').textContent = `${ranked.length} algorithms · median ns`

  ranked.forEach((d, i) => {
    const li = document.createElement('li')
    li.className = 'rank-row'
    li.style.setProperty('--c', d.t.color)
    li.style.setProperty('--w', String(d.y / slowest))
    const rel = d.y / fastest
    li.innerHTML = `
      <span class="rank-pos">${i + 1}</span>
      <span class="rank-name">
        <span class="rank-dot" aria-hidden="true"></span>
        <span class="rank-label"><span class="rank-lang">${
          d.t.executor
        }</span> ${d.t.alg}</span>
      </span>
      <span class="rank-bar-track"><span class="rank-bar"></span></span>
      <span class="rank-val">${fmtTime(d.y)}
        <span class="rank-rel">${rel < 1.05 ? 'fastest' : rel.toFixed(rel < 10 ? 1 : 0) + '×'}</span>
      </span>`
    list.appendChild(li)
  })
}

// ----------------------------------------------------------------- controls
function wireControls() {
  $('study').addEventListener('change', (e) => selectStudy(e.target.value))

  const toggle = (id, key) => {
    const btn = $(id)
    btn.addEventListener('click', () => {
      if (btn.disabled) return
      state[key] = !state[key]
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
    syncReduce()
    commitViewState()
    loadTrend() // reduction changes the SQL — re-query
  })
  syncReduce()

  for (const b of document.querySelectorAll('.series-bulk button')) {
    b.addEventListener('click', () => {
      state.selected =
        b.dataset.bulk === 'all'
          ? new Set(state.tasks.map((t) => t.task_label))
          : new Set()
      syncSeriesList()
      draw()
    })
  }

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
