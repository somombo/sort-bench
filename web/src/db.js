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
      count(DISTINCT executor || array_to_string(args, ' '))    AS algos
    FROM data
  `)
  return {
    rows: num(row.rows),
    studies: num(row.studies),
    langs: num(row.langs),
    algos: num(row.algos),
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

/**
 * The core trend pipeline, faithful to the lab's methodology:
 *   1. min over repetitions  (per generated array × algorithm)
 *   2. median over the independent random arrays at each axis value
 * Returns one row per (task_label, x).
 */
export async function trend(study, experiment) {
  const axis = classifyExperiment(experiment).axis
  const xExpr = {
    cardinality: 'gen_meta.cardinality',
    multiplicity: 'gen_meta.multiplicity',
    // a null swaps count means "maximal" — the full array size
    swaps: 'coalesce(gen_meta.swaps, gen_meta.cardinality * gen_meta.multiplicity)',
  }[axis]

  const rows = await query(`
    WITH base AS (
      SELECT
        executor || ' ' || array_to_string(args, ' ') AS task_label,
        gen_meta.id                                    AS gid,
        ${xExpr}                                       AS x,
        metric                                         AS metric
      FROM data
      WHERE attributes.study = ${sqlStr(study)}
        AND attributes.experiment_name = ${sqlStr(experiment)}
    ),
    min_reps AS (
      SELECT task_label, gid, any_value(x) AS x, min(metric) AS metric
      FROM base GROUP BY task_label, gid
    )
    SELECT
      task_label,
      x,
      median(metric)::DOUBLE AS y,
      count(*)               AS runs
    FROM min_reps GROUP BY task_label, x ORDER BY x
  `)
  return rows.map((r) => ({
    task_label: r.task_label,
    x: num(r.x),
    y: num(r.y),
    runs: num(r.runs),
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
