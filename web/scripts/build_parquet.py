from pathlib import Path

import duckdb

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_GLOB = REPO_ROOT / "data" / "*.jsonl"
OUTPUT_PATH = REPO_ROOT / "web" / "dist" / "benchmark_data.parquet"

EXPORT_QUERY = f"""
COPY (
    SELECT
       *
    FROM read_json_auto('{DATA_GLOB.as_posix()}', filename = true)
) TO '{OUTPUT_PATH.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD);
"""


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    duckdb.sql(EXPORT_QUERY)
    rows = duckdb.sql(
        f"SELECT count(*) FROM read_parquet('{OUTPUT_PATH.as_posix()}')"
    ).fetchone()[0]
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"Wrote {rows} rows to {OUTPUT_PATH} ({size_kb:.1f} KiB)")


if __name__ == "__main__":
    main()
