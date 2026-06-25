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
  from the per-run minima behind each median).
- **Per-array reduction** — `Min` (the lab default: the fastest of an array's
  reps, jitter-free) or `Warm-up` (only the last rep, treating the earlier reps
  as warm-ups). Built on a per-group window, so it is robust to varying rep
  counts.
- **Algorithms** — toggle any subset of the language/algorithm series.

The trend chart gives a crosshair readout of every series; the ranking panel
orders algorithms by median duration at the largest axis value. **Click any
point** to open a drawer showing the full distribution of its individual runs —
a box-whisker plus every random-array result and the five-number summary.

## Source layout

```
web/
├── index.html            # app shell + boot overlay
├── src/
│   ├── app.js            # state + control wiring
│   ├── db.js             # DuckDB-WASM bootstrap + the trend query pipeline
│   ├── chart.js          # themed uPlot wrapper
│   ├── format.js         # duration / count / axis formatting
│   ├── palette.js        # categorical series colors
│   └── style.css         # design system
└── scripts/
    └── build_parquet.py  # JSONL → Parquet
```
