// Categorical series palette — single source for canvas strokes and DOM swatches.
// Tuned for a white ground: roughly constant lightness, well-separated hues.
export const SERIES_COLORS = [
  'oklch(0.52 0.19 264)', // indigo
  'oklch(0.62 0.18 32)', // coral
  'oklch(0.55 0.11 188)', // teal
  'oklch(0.66 0.15 72)', // amber
  'oklch(0.55 0.20 330)', // magenta
  'oklch(0.58 0.15 142)', // green
  'oklch(0.56 0.16 232)', // sky
  'oklch(0.52 0.19 300)', // violet
  'oklch(0.56 0.15 16)', // brick
  'oklch(0.50 0.09 220)', // steel
]

export function colorFor(index) {
  return SERIES_COLORS[index % SERIES_COLORS.length]
}
