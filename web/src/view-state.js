const URL_KEYS = [
  'study',
  'experiment',
  'reduction',
  'xlog',
  'ylog',
  'normalize',
  'spread',
  'series',
  'task',
  'inspect',
  'xmin',
  'xmax',
  'ymin',
  'ymax',
]

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

function boolParam(params, name) {
  const value = params.get(name)
  if (value === '1' || value === 'true') return true
  if (value === '0' || value === 'false') return false
  return undefined
}

function zoomParam(params, name) {
  const raw = params.get(name)
  if (raw === null || raw.trim() === '') return undefined
  const value = Number(raw)
  return Number.isFinite(value) ? value : undefined
}

function readZoom(params) {
  const xMin = zoomParam(params, 'xmin')
  const xMax = zoomParam(params, 'xmax')
  const yMin = zoomParam(params, 'ymin')
  const yMax = zoomParam(params, 'ymax')
  return xMin < xMax && yMin < yMax ? { xMin, xMax, yMin, yMax } : null
}

function validZoom(zoom) {
  return (
    isObject(zoom) &&
    Number.isFinite(zoom.xMin) &&
    Number.isFinite(zoom.xMax) &&
    Number.isFinite(zoom.yMin) &&
    Number.isFinite(zoom.yMax) &&
    zoom.xMin < zoom.xMax &&
    zoom.yMin < zoom.yMax
  )
}

/** Read a complete or partial shared view from the current URL. */
export function readUrlView(href) {
  try {
    const url = new URL(href ?? globalThis.location.href)
    const params = url.searchParams
    const study = params.get('study')
    if (!study) return null

    const reduction = params.get('reduction')
    const series = params.get('series')
    let selected
    if (series === 'all') selected = null
    else if (series === 'none') selected = []
    else if (series === 'custom') selected = params.getAll('task')

    return {
      study,
      experiment: params.get('experiment') || undefined,
      reduction:
        reduction === 'min' || reduction === 'warm' ? reduction : undefined,
      xlog: boolParam(params, 'xlog'),
      ylog: boolParam(params, 'ylog'),
      normalize: boolParam(params, 'normalize'),
      spread: boolParam(params, 'spread'),
      selected,
      inspect: zoomParam(params, 'inspect') ?? null,
      zoom: readZoom(params),
    }
  } catch {
    return null
  }
}

/** Replace only this app's query parameters, preserving the path and hash. */
export function replaceUrlView(view, env = globalThis) {
  try {
    const url = new URL(env.location.href)
    URL_KEYS.forEach((key) => url.searchParams.delete(key))

    url.searchParams.set('study', view.study)
    url.searchParams.set('experiment', view.experiment)
    url.searchParams.set('reduction', view.reduction)
    url.searchParams.set('xlog', view.xlog ? '1' : '0')
    url.searchParams.set('ylog', view.ylog ? '1' : '0')
    url.searchParams.set('normalize', view.normalize ? '1' : '0')
    url.searchParams.set('spread', view.spread ? '1' : '0')

    if (view.selected === null) {
      url.searchParams.set('series', 'all')
    } else if (!view.selected.length) {
      url.searchParams.set('series', 'none')
    } else {
      url.searchParams.set('series', 'custom')
      view.selected.forEach((task) => url.searchParams.append('task', task))
    }

    if (validZoom(view.zoom)) {
      url.searchParams.set('xmin', view.zoom.xMin)
      url.searchParams.set('xmax', view.zoom.xMax)
      url.searchParams.set('ymin', view.zoom.yMin)
      url.searchParams.set('ymax', view.zoom.yMax)
    }

    if (Number.isFinite(view.inspect))
      url.searchParams.set('inspect', view.inspect)

    env.history.replaceState(null, '', url)
  } catch {
    // URL synchronization is progressive enhancement.
  }
}

/** Use shared state or remembered state (never both), over safe defaults. */
export function resolveView(experiment, remembered = {}, shared = null) {
  const view = {
    reduction: 'min',
    xlog: true,
    ylog: true,
    normalize: false,
    spread: false,
    selected: null,
    inspect: null,
    zoom: null,
  }

  const source = isObject(shared) ? shared : remembered
  if (isObject(source)) {
    if (source.reduction === 'min' || source.reduction === 'warm')
      view.reduction = source.reduction
    for (const key of ['xlog', 'ylog', 'normalize', 'spread']) {
      if (typeof source[key] === 'boolean') view[key] = source[key]
    }
    if (source.selected === null || Array.isArray(source.selected))
      view.selected = source.selected
    // Inspection and zoom are shareable transient state, never remembered
    // experiment preferences.
    if (isObject(shared)) {
      if (Number.isFinite(shared.inspect)) view.inspect = shared.inspect
      if (validZoom(shared.zoom)) view.zoom = shared.zoom
    }
  }

  return view
}

/** Choose a valid preferred experiment, otherwise Cardinality Ascending. */
export function chooseExperiment(experiments, ...preferredNames) {
  for (const name of preferredNames) {
    const match = experiments.find((exp) => exp.experiment === name)
    if (match) return match
  }
  return (
    experiments.find((exp) => exp.axis === 'cardinality' && !exp.descending) ??
    experiments[0] ??
    null
  )
}
