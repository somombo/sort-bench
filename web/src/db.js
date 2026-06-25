// DuckDB-WASM bootstrap + query helpers.
// All aggregation happens locally in the browser against the parquet bundle.
import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0/+esm'

let conn = null

/** Boot DuckDB-WASM, register the parquet, expose a `data` view. */
export async function initDB(onStatus = () => {}) {
  onStatus('Initializing in-browser engine…')
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles())

  // Web Workers need a same-origin Blob URL to importScripts the CDN worker.
  const workerBlob = new Blob([`importScripts("${bundle.mainWorker}");`], {
    type: 'text/javascript',
  })
  const workerUrl = URL.createObjectURL(workerBlob)
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), new Worker(workerUrl))
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  URL.revokeObjectURL(workerUrl)

  onStatus('Loading benchmark corpus…')
  const res = await fetch('benchmark_data.parquet')
  if (!res.ok) throw new Error(`Could not fetch benchmark_data.parquet (${res.status})`)
  const buf = new Uint8Array(await res.arrayBuffer())
  await db.registerFileBuffer('benchmark_data.parquet', buf)

  conn = await db.connect()
  await conn.query(
    `CREATE VIEW data AS SELECT * FROM read_parquet('benchmark_data.parquet')`,
  )
  return db
}

/** Run a SQL query, return plain JS objects (BigInt coerced where asked). */
export async function query(sql) {
  const res = await conn.query(sql)
  return res.toArray().map((r) => r.toJSON())
}

const num = (v) => (typeof v === 'bigint' ? Number(v) : v)
const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`

/** Whole-corpus headline counts. */
export async function corpusStats() {
  const [row] = await query(`
    SELECT
      count(*)                                                  AS rows,
      count(DISTINCT attributes.study)                          AS studies,
      count(DISTINCT executor)                                  AS langs,
      count(DISTINCT executor || array_to_string(args, ' '))    AS algos,
      max(rep_index) + 1                                        AS maxReps
    FROM data
  `)
  return {
    rows: num(row.rows),
    studies: num(row.studies),
    langs: num(row.langs),
    algos: num(row.algos),
    maxReps: num(row.maxReps),
  }
}

/** Studies, ordered by size (rows) then name. */
export async function listStudies() {
  const rows = await query(`
    SELECT attributes.study AS study, count(*) AS n
    FROM data GROUP BY 1 ORDER BY n DESC, study
  `)
  return rows.map((r) => ({ study: r.study, n: num(r.n) }))
}

/** Experiments within a study, with the axis each one sweeps. */
export async function listExperiments(study) {
  const rows = await query(`
    SELECT
      attributes.experiment_name AS experiment,
      bool_or(gen_meta.descending) AS descending,
      count(*) AS n
    FROM data WHERE attributes.study = ${sqlStr(study)}
    GROUP BY 1 ORDER BY experiment
  `)
  return rows.map((r) => ({
    experiment: r.experiment,
    descending: r.descending,
    n: num(r.n),
    ...classifyExperiment(r.experiment),
  }))
}

/** Algorithms (executor + args) present in a study. */
export async function listTasks(study) {
  const rows = await query(`
    SELECT DISTINCT
      executor || ' ' || array_to_string(args, ' ') AS task_label,
      executor                                       AS executor,
      array_to_string(args, ' ')                     AS alg
    FROM data WHERE attributes.study = ${sqlStr(study)}
    ORDER BY executor, alg
  `)
  return rows
}

// a null swaps count means "maximal" — the full array size
const AXIS_EXPR = {
  cardinality: 'gen_meta.cardinality',
  multiplicity: 'gen_meta.multiplicity',
  swaps: 'coalesce(gen_meta.swaps, gen_meta.cardinality * gen_meta.multiplicity)',
}

// Sanitize the warm-up count to a non-negative integer (it is interpolated into
// SQL, so it must never be anything but a number).
const warmInt = (w) => Math.max(0, Math.floor(Number(w) || 0))

/**
 * Per-array reduction over repetitions, robust to varying rep counts. For each
 * array we keep the last `reps_n - warmups` repetitions (run order = rep_index,
 * descending), but never fewer than one, then take the min of those — discarding
 * the first `warmups` reps as warm-ups. `warmups = 0` is plain min-over-all-reps
 * (the lab default). The clamp via a per-group window means a low-rep array can
 * never lose all of its measurements.
 */
function perArrayCTE({ study, experiment, xExpr, warmups, extraCols = '' }) {
  const w = warmInt(warmups)
  return `
    raw AS (
      SELECT
        executor || ' ' || array_to_string(args, ' ') AS task_label,
        gen_meta.id                                    AS gid,
        ${xExpr}                                       AS x,
        rep_index, metric${extraCols ? ',\n        ' + extraCols : ''}
      FROM data
      WHERE attributes.study = ${sqlStr(study)}
        AND attributes.experiment_name = ${sqlStr(experiment)}
    ),
    ranked AS (
      SELECT *,
        count(*)     OVER (PARTITION BY task_label, gid)                       AS reps_n,
        row_number() OVER (PARTITION BY task_label, gid ORDER BY rep_index DESC) AS rn
      FROM raw
    )`
}

/**
 * The core trend pipeline, faithful to the lab's methodology:
 *   1. reduce repetitions  (per generated array × algorithm) — see perArrayCTE
 *   2. median over the independent random arrays at each axis value
 * Alongside the median, the spread of the per-array values is summarised as a
 * five-number (min / Q1 / median / Q3 / max) so the chart can draw whiskers.
 * Returns one row per (task_label, x).
 */
export async function trend(study, experiment, warmups = 0) {
  const xExpr = AXIS_EXPR[classifyExperiment(experiment).axis]
  const w = warmInt(warmups)

  const rows = await query(`
    WITH ${perArrayCTE({ study, experiment, xExpr, warmups })},
    per_array AS (
      SELECT task_label, gid, any_value(x) AS x, min(metric) AS metric
      FROM ranked
      WHERE rn <= greatest(1, reps_n - ${w})
      GROUP BY task_label, gid
    )
    SELECT
      task_label,
      x,
      count(*)                            AS runs,
      median(metric)::DOUBLE              AS y,
      min(metric)::DOUBLE                 AS lo,
      quantile_cont(metric, 0.25)::DOUBLE AS q1,
      quantile_cont(metric, 0.75)::DOUBLE AS q3,
      max(metric)::DOUBLE                 AS hi
    FROM per_array GROUP BY task_label, x ORDER BY x
  `)
  return rows.map((r) => ({
    task_label: r.task_label,
    x: num(r.x),
    runs: num(r.runs),
    y: num(r.y),
    lo: num(r.lo),
    q1: num(r.q1),
    q3: num(r.q3),
    hi: num(r.hi),
  }))
}

/**
 * The individual per-run results behind a single plotted point: one value per
 * independent random array, each reduced over its (kept) repetitions exactly as
 * the trend does. Also reports the total reps and how many were kept.
 */
export async function runDistribution(study, experiment, taskLabel, xValue, warmups = 0) {
  const xExpr = AXIS_EXPR[classifyExperiment(experiment).axis]
  const w = warmInt(warmups)
  const rows = await query(`
    WITH ${perArrayCTE({
      study,
      experiment,
      xExpr,
      warmups,
      extraCols: 'gen_meta.seed AS seed',
    })}
    SELECT
      gid,
      any_value(seed)        AS seed,
      any_value(reps_n)      AS reps,
      count(*)               AS kept,
      min(metric)::DOUBLE    AS metric
    FROM ranked
    WHERE task_label = ${sqlStr(taskLabel)}
      AND x = ${Number(xValue)}
      AND rn <= greatest(1, reps_n - ${w})
    GROUP BY gid ORDER BY metric
  `)
  return rows.map((r) => ({
    gid: r.gid,
    seed: r.seed,
    reps: num(r.reps),
    kept: num(r.kept),
    metric: num(r.metric),
  }))
}

/** Derive the swept axis + a fixed-size hint from an experiment name. */
export function classifyExperiment(name) {
  const descending = /descending/i.test(name)
  let axis = 'cardinality'
  if (/multiplicity/i.test(name)) axis = 'multiplicity'
  else if (/swaps/i.test(name)) axis = 'swaps'
  else if (/cardinality/i.test(name)) axis = 'cardinality'
  const fixed = name.match(/Fixed Size\s*=\s*([\d,]+)/i)
  const fixedSize = fixed ? Number(fixed[1].replace(/,/g, '')) : null
  return { axis, descending, fixedSize }
}
