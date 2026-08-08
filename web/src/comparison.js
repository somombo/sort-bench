/** Build a stable, task-ordered comparison at one measured x value. */
export function compareAt(tasks, selected, byTask, x, normalize = false) {
  const rows = tasks.map((task) => {
    const visible = selected.has(task.task_label)
    const raw = visible ? byTask.get(task.task_label)?.get(x)?.y ?? null : null
    const value = raw == null ? null : normalize ? raw / x : raw
    return { task, visible, value }
  })

  const measured = rows.filter((row) => row.visible && row.value != null)
  const fastest = measured.length
    ? Math.min(...measured.map((row) => row.value))
    : null

  return rows.map((row) => ({
    ...row,
    fastest: row.value != null && row.value === fastest,
    relative:
      row.value != null && fastest != null ? row.value / fastest : null,
  }))
}

export function taskDisplayName(task) {
  const args = task.alg?.trim()
  return args ? `${task.executor} · ${args}` : task.executor
}

/** Return the adjacent measured x value, wrapping at either boundary. */
export function adjacentMeasuredX(xs, current, direction) {
  if (!Array.isArray(xs) || xs.length === 0 || direction === 0) return null

  if (!Number.isFinite(current))
    return direction > 0 ? xs[0] : xs[xs.length - 1]

  const index = xs.indexOf(current)
  if (index >= 0)
    return xs[(index + Math.sign(direction) + xs.length) % xs.length]

  if (direction > 0) return xs.find((x) => x > current) ?? xs[0]
  return xs.findLast((x) => x < current) ?? xs[xs.length - 1]
}
