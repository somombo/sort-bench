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

