// Categorical series palette — single source for canvas strokes and DOM swatches.
// Luminous traces tuned for the app's dark indigo plotting surface.
export const SERIES_COLORS = [
  'oklch(0.72 0.17 252)', // blue
  'oklch(0.74 0.15 33)', // coral
  'oklch(0.74 0.12 192)', // teal
  'oklch(0.79 0.14 82)', // gold
  'oklch(0.68 0.18 322)', // plum
  'oklch(0.73 0.15 148)', // green
  'oklch(0.70 0.19 295)', // violet
  'oklch(0.75 0.15 52)', // orange
  'oklch(0.70 0.15 25)', // red
  'oklch(0.76 0.14 358)', // rose
]

function hashLabel(label) {
  let hash = 2166136261
  for (let i = 0; i < label.length; i += 1) {
    hash ^= label.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Deterministic colors with collision avoidance within the current study. */
export function colorsFor(labels) {
  const used = new Set()
  return labels.map((label) => {
    let index = hashLabel(label) % SERIES_COLORS.length
    if (used.size < SERIES_COLORS.length) {
      while (used.has(index)) index = (index + 1) % SERIES_COLORS.length
      used.add(index)
    }
    return SERIES_COLORS[index]
  })
}
