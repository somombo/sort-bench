import test from 'node:test'
import assert from 'node:assert/strict'

import {
  chooseExperiment,
  readUrlView,
  replaceUrlView,
  resolveView,
} from '../src/view-state.js'

test('defaults to Cardinality Ascending and its normalized log view', () => {
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
    ylog: false,
    normalize: true,
    spread: false,
    selected: null,
  })
  assert.equal(resolveView(experiments[0]).normalize, false)
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
    ylog: false,
    normalize: false,
    spread: false,
    selected: null,
  })
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
  }

  replaceUrlView(original, env)
  const parsed = readUrlView(replaced)

  assert.equal(new URL(replaced).searchParams.get('unrelated'), 'keep')
  assert.equal(new URL(replaced).hash, '#chart')
  assert.deepEqual(parsed, { ...original, study: original.study })
})
