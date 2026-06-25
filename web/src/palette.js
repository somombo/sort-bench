// Categorical series palette — single source for canvas strokes and DOM swatches.
// Editorial register: muted, ink-on-paper chroma, well-separated hues. Tuned to
// read as distinct fine lines on a warm near-white ground (Tufte/Distill-ish).
export const SERIES_COLORS = [
  'oklch(0.47 0.13 252)', // ink-blue
  'oklch(0.54 0.15 33)', // brick-red
  'oklch(0.55 0.09 192)', // teal
  'oklch(0.63 0.12 82)', // ochre
  'oklch(0.49 0.14 322)', // plum
  'oklch(0.55 0.11 148)', // green
  'oklch(0.52 0.15 295)', // violet
  'oklch(0.52 0.13 52)', // sienna
  'oklch(0.46 0.06 222)', // steel
  'oklch(0.58 0.10 358)', // rose
]

export function colorFor(index) {
  return SERIES_COLORS[index % SERIES_COLORS.length]
}
