// Formatting helpers — durations, counts, and per-axis copy.

/** Nanoseconds → adaptive human string (ns / µs / ms / s). */
export function fmtTime(ns, terse = false) {
  if (ns == null || Number.isNaN(ns)) return '—'
  const abs = Math.abs(ns)
  let v, unit
  if (abs < 1e3) {
    v = ns
    unit = 'ns'
  } else if (abs < 1e6) {
    v = ns / 1e3
    unit = 'µs'
  } else if (abs < 1e9) {
    v = ns / 1e6
    unit = 'ms'
  } else {
    v = ns / 1e9
    unit = 's'
  }
  const digits = Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2
  const num = v.toFixed(unit === 'ns' ? 0 : digits)
  return terse ? `${num}${unit}` : `${num} ${unit}`
}

/** Compact axis-tick label for nanosecond values on a log scale. */
export function fmtTimeAxis(ns) {
  if (ns == null) return ''
  return fmtTime(ns, true)
}

/** Normalized duration: nanoseconds spent per swept-axis element. */
export function fmtRate(ns, terse = false) {
  if (ns == null || Number.isNaN(ns)) return '—'
  const abs = Math.abs(ns)
  let v, unit
  if (abs < 1e3) {
    v = ns
    unit = 'ns'
  } else if (abs < 1e6) {
    v = ns / 1e3
    unit = 'µs'
  } else {
    v = ns / 1e6
    unit = 'ms'
  }
  const a = Math.abs(v)
  const digits = a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3
  return terse ? `${v.toFixed(digits)}${unit}` : `${v.toFixed(digits)} ${unit}/el`
}

/** Integers with thousands separators. */
export function fmtInt(n) {
  if (n == null) return '—'
  return Number(n).toLocaleString('en-US')
}

/** Short SI-ish integer (1.2k, 110k, 1.1M) for dense axes. */
export function fmtIntShort(n) {
  if (n == null) return ''
  const abs = Math.abs(n)
  if (abs < 1e3) return String(n)
  if (abs < 1e6) return `${+(n / 1e3).toFixed(abs < 1e4 ? 1 : 0)}k`
  return `${+(n / 1e6).toFixed(1)}M`
}

const AXIS = {
  cardinality: {
    label: 'Cardinality',
    unit: 'distinct keys',
    blurb:
      'Array length grows while each value stays unique. The classic size-vs-time scaling curve.',
  },
  multiplicity: {
    label: 'Multiplicity',
    unit: 'copies per key',
    blurb:
      'Total array size is held fixed; raising multiplicity means fewer distinct keys, each repeated more — a stress test for duplicate handling.',
  },
  swaps: {
    label: 'Swaps',
    unit: 'random swaps',
    blurb:
      'Total size is fixed; the array starts sorted and receives this many random swaps. Few swaps ≈ nearly sorted, the maximum ≈ fully shuffled — probing adaptivity.',
  },
}

export function axisInfo(axis) {
  return AXIS[axis] ?? AXIS.cardinality
}
