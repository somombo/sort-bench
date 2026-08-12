# sort·bench explorer

An interactive, in-browser explorer for the `sort-bench` benchmark corpus. It
reproduces the lab's analysis methodology — **minimum over repetitions**, then
**median over the independent random arrays** — directly in the browser, so you
can compare how sorting algorithms scale across languages and input shapes
without running a notebook.

Everything runs client-side: the JSONL studies in `../data` are compiled to a
single compressed Parquet file, and [DuckDB-WASM](https://duckdb.org/docs/api/wasm/overview.html)
executes the aggregation queries locally. Nothing is uploaded.

## Quick start

```bash
cd web
npm run dev        # build the data + app, then serve dist/ on localhost
```

Then open the printed URL. The first load fetches the DuckDB-WASM and
[uPlot](https://github.com/leeoniya/uPlot) bundles from a CDN.

## How it works

| Step | Command | Output |
| --- | --- | --- |
| Compile data | `npm run build_db` | `dist/benchmark_data.parquet` (all `../data/*.jsonl`, ZSTD) |
| Stage app | `npm run build_app` | `dist/index.html` + `dist/src/*` |
| Both | `npm run build` | a self-contained `dist/` |

`build_db` shells out to `uv` in the `../lab` workspace, so it needs the same
Python toolchain the lab uses. The app itself has **no build step and no
`node_modules`** — `index.html` loads ES modules directly and pulls DuckDB-WASM
and uPlot from a CDN.

## What you can explore

- **Study** — one benchmark campaign (e.g. the cross-language `fast_sort_study`,
  or the Lean-focused `lean_experimental_study`).
- **Experiment** — each sweeps one axis: **cardinality** (array size),
  **multiplicity** (duplicate density at fixed size), or **swaps**
  (pre-sortedness at fixed size), in ascending or descending base order.
- **View** — log/linear on either axis, *normalize* to show time per element,
  and *spread* to overlay per-point **error bars** (min · median · max, built
  from the per-sample minima behind each median). The legend header reports the
  exact number of independent samples behind each plotted point.
- **Per-array reduction** — `Min` (the lab default: the fastest timing for an
  array, jitter-free) or `Warm-up` (only the last timing, treating the earlier
  repetitions as warm-ups). Built on a per-group window, so it is robust to
  varying repetition counts.
- **Task legend** — identify every line by its stable color, hide/show tasks,
  and compare median time plus relative speed at any measured x value.
- **Remembered views** — each study reopens its most recently used experiment,
  and each experiment remembers its reduction, axes, normalization, spread, and
  visible tasks until the page is reloaded.
- **Shareable URLs** — the active study, experiment, view controls, visible
  tasks, inspected x value, and zoom bounds are encoded in the URL so copying
  the address reproduces the same chart and legend comparison for another
  viewer.

The trend chart retains the last inspected x value as a vertical guide, colored
task markers, and a labeled x-axis callout after the pointer leaves. The legend
compares every visible task at that slice and flags when it falls outside the
current zoom; hover a legend row or trace to focus its counterpart. Drag to
zoom, use **Reset zoom** to restore the full domain, and **click any point** to
open a drawer showing the full distribution of its independent samples — a
box-whisker plus every random-array result and the five-number summary.

## Source layout

```
web/
├── index.html            # app shell + boot overlay
├── src/
│   ├── app.js            # state + control wiring
│   ├── comparison.js     # at-cursor task comparison logic
│   ├── db.js             # DuckDB-WASM bootstrap + the trend query pipeline
│   ├── chart.js          # themed uPlot wrapper
│   ├── format.js         # duration / count / axis formatting
│   ├── palette.js        # categorical series colors
│   └── style.css         # design system
└── scripts/
    └── build_parquet.py  # JSONL → Parquet
```
