import test from 'node:test'
import assert from 'node:assert/strict'

import { summarizeSamples } from '../src/format.js'

test('sample summary reports a uniform per-point count', () => {
  assert.deepEqual(summarizeSamples([5, 5, 5]), {
    n: '5',
    phrase: '5 independent samples',
  })
})

test('sample summary reports the full range when point counts differ', () => {
  assert.deepEqual(summarizeSamples([10, 5, 15, 10]), {
    n: '5–15',
    phrase: '5–15 independent samples',
  })
})

test('sample summary handles singular and missing counts', () => {
  assert.deepEqual(summarizeSamples([1]), {
    n: '1',
    phrase: '1 independent sample',
  })
  assert.deepEqual(summarizeSamples([0, null, undefined, NaN]), {
    n: '—',
    phrase: 'no independent samples',
  })
})
