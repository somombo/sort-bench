import test from 'node:test'
import assert from 'node:assert/strict'

import {
  chooseExperiment,
  readUrlView,
  replaceUrlView,
  resolveView,
} from '../src/view-state.js'

test('defaults to Cardinality Ascending and the uniform raw log-log view', () => {
  const experiments = [
    { experiment: 'Swaps Desc', axis: 'swaps', descending: true },
    { experiment: 'Cardinality Desc', axis: 'cardinality', descending: true },
    { experiment: 'Cardinality Asc', axis: 'cardinality', descending: false },
  ]
  const selected = chooseExperiment(experiments)

  assert.equal(selected.experiment, 'Cardinality Asc')
  assert.equal(
    chooseExperiment(experiments, 'Swaps Desc').experiment,
    'Swaps Desc',
  )
  assert.deepEqual(resolveView(selected), {
    reduction: 'min',
    xlog: true,
    ylog: true,
    normalize: false,
    spread: false,
    selected: null,
    inspect: null,
    zoom: null,
  })
})

test('uses the same view defaults for every experiment axis', () => {
  for (const axis of ['cardinality', 'multiplicity', 'swaps']) {
    const view = resolveView({ axis })
    assert.deepEqual(
      {
        xlog: view.xlog,
        ylog: view.ylog,
        normalize: view.normalize,
        spread: view.spread,
      },
      { xlog: true, ylog: true, normalize: false, spread: false },
    )
  }
})

test('a shared link ignores remembered values, including omitted fields', () => {
  const view = resolveView(
    { axis: 'cardinality' },
    { reduction: 'warm', xlog: false, spread: true },
    { xlog: true, normalize: false },
  )

  assert.deepEqual(view, {
    reduction: 'min',
    xlog: true,
    ylog: true,
    normalize: false,
    spread: false,
    selected: null,
    inspect: null,
    zoom: null,
  })
})

test('zoom is shareable but is not restored from page-memory preferences', () => {
  const zoom = { xMin: 1, xMax: 10, yMin: 2, yMax: 20 }

  assert.equal(resolveView({ axis: 'swaps' }, { zoom }).zoom, null)
  assert.deepEqual(resolveView({ axis: 'swaps' }, {}, { zoom }).zoom, zoom)
})

test('inspected x is shareable but is not restored from page-memory preferences', () => {
  assert.equal(resolveView({ axis: 'swaps' }, { inspect: 64 }).inspect, null)
  assert.equal(
    resolveView({ axis: 'swaps' }, {}, { inspect: 64 }).inspect,
    64,
  )
})

test('URL state round-trips an exact custom-series view', () => {
  let replaced
  const env = {
    location: { href: 'https://example.test/explorer?unrelated=keep#chart' },
    history: {
      replaceState(_state, _title, url) {
        replaced = String(url)
      },
    },
  }
  const original = {
    study: 'pr14653_study',
    experiment: 'Experiment 6 (Varying Swaps Descending)',
    reduction: 'warm',
    xlog: true,
    ylog: false,
    normalize: false,
    spread: true,
    selected: ['kim-em.qsort_three_way', 'leancore.Array.qsort'],
    inspect: 44721,
    zoom: { xMin: 32, xMax: 4096, yMin: 1.5, yMax: 88.25 },
  }

  replaceUrlView(original, env)
  const parsed = readUrlView(replaced)

  assert.equal(new URL(replaced).searchParams.get('unrelated'), 'keep')
  assert.equal(new URL(replaced).hash, '#chart')
  assert.deepEqual(parsed, { ...original, study: original.study })
})

test('URL ignores incomplete or invalid zoom bounds', () => {
  const incomplete = readUrlView(
    'https://example.test/?study=s&xmin=1&xmax=10&ymin=2',
  )
  const reversed = readUrlView(
    'https://example.test/?study=s&xmin=10&xmax=1&ymin=2&ymax=3',
  )

  assert.equal(incomplete.zoom, null)
  assert.equal(reversed.zoom, null)
})

test('URL ignores an invalid inspected x and accepts zero', () => {
  assert.equal(
    readUrlView('https://example.test/?study=s&inspect=nope').inspect,
    null,
  )
  assert.equal(
    readUrlView('https://example.test/?study=s&inspect=0').inspect,
    0,
  )
})
