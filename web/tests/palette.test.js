import test from 'node:test'
import assert from 'node:assert/strict'

import { colorsFor, SERIES_COLORS } from '../src/palette.js'

test('task colors are deterministic and avoid collisions within the palette', () => {
  const labels = ['cpp', 'java', 'lean', 'python']
  const first = colorsFor(labels)
  const second = colorsFor(labels)

  assert.deepEqual(first, second)
  assert.equal(new Set(first).size, labels.length)
  assert.ok(first.every((color) => SERIES_COLORS.includes(color)))
})
