// v2 resets preferences captured while Log Y's fallback default was still on.
const STORAGE_KEY = 'sort-bench:view-state:v2'
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
]

const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export function loadViewMemory(storage) {
  try {
    const target = storage ?? globalThis.localStorage
    const parsed = JSON.parse(target.getItem(STORAGE_KEY) ?? '{}')
    return isObject(parsed) && isObject(parsed.studies)
      ? parsed
      : { studies: {} }
  } catch {
    return { studies: {} }
  }
}

export function saveViewMemory(memory, storage) {
  try {
    const target = storage ?? globalThis.localStorage
    target.setItem(STORAGE_KEY, JSON.stringify(memory))
  } catch {
    // Persistence is optional; the active view and URL still work without it.
  }
}

function boolParam(params, name) {
  const value = params.get(name)
  if (value === '1' || value === 'true') return true
  if (value === '0' || value === 'false') return false
  return undefined
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
    ylog: false,
    normalize: experiment?.axis === 'cardinality',
    spread: false,
    selected: null,
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
