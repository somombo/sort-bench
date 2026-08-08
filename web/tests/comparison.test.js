import test from 'node:test'
import assert from 'node:assert/strict'

import { compareAt, taskDisplayName } from '../src/comparison.js'

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
