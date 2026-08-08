import test from 'node:test'
import assert from 'node:assert/strict'

import {
  adjacentMeasuredX,
  compareAt,
  taskDisplayName,
} from '../src/comparison.js'

const tasks = [
  { task_label: 'cpp', executor: 'cpp', alg: '' },
  { task_label: 'java quick', executor: 'java', alg: 'quick' },
  { task_label: 'lean', executor: 'lean', alg: '' },
]

const byTask = new Map([
  ['cpp', new Map([[100, { y: 50 }]])],
  ['java quick', new Map([[100, { y: 75 }]])],
])

test('comparison keeps stable rows and excludes hidden or missing tasks', () => {
  const result = compareAt(tasks, new Set(['cpp', 'lean']), byTask, 100)

  assert.deepEqual(
    result.map(({ visible, value, fastest, relative }) => ({
      visible,
      value,
      fastest,
      relative,
    })),
    [
      { visible: true, value: 50, fastest: true, relative: 1 },
      { visible: false, value: null, fastest: false, relative: null },
      { visible: true, value: null, fastest: false, relative: null },
    ],
  )
})

test('comparison marks exact ties and supports normalized values', () => {
  const tied = new Map([
    ['cpp', new Map([[100, { y: 50 }]])],
    ['java quick', new Map([[100, { y: 50 }]])],
  ])
  const result = compareAt(
    tasks,
    new Set(['cpp', 'java quick']),
    tied,
    100,
    true,
  )

  assert.equal(result[0].value, 0.5)
  assert.equal(result[0].fastest, true)
  assert.equal(result[1].fastest, true)
})

test('task names omit the separator when args are absent', () => {
  assert.equal(taskDisplayName(tasks[0]), 'cpp')
  assert.equal(taskDisplayName(tasks[1]), 'java · quick')
})

test('inspection steps through measured x values and wraps at boundaries', () => {
  const xs = [10, 50, 100]

  assert.equal(adjacentMeasuredX(xs, null, -1), 100)
  assert.equal(adjacentMeasuredX(xs, null, 1), 10)
  assert.equal(adjacentMeasuredX(xs, 10, -1), 100)
  assert.equal(adjacentMeasuredX(xs, 10, 1), 50)
  assert.equal(adjacentMeasuredX(xs, 100, 1), 10)
})

test('inspection recovers from a current x outside the measured set', () => {
  const xs = [10, 50, 100]

  assert.equal(adjacentMeasuredX(xs, 40, -1), 10)
  assert.equal(adjacentMeasuredX(xs, 40, 1), 50)
  assert.equal(adjacentMeasuredX(xs, 5, -1), 100)
  assert.equal(adjacentMeasuredX(xs, 101, 1), 10)
})
