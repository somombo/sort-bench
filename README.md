# sort-bench

> A high-precision, cross-language benchmarking suite for sorting algorithms.

`sort-bench` is a testing environment designed to measure, compare, and analyze how well sorting algorithms perform across different programming languages. Powered by the [`impalab`](https://github.com/somombo/impalab) framework, it provides an isolated, reproducible, and fair way to test algorithms.

## Key Features

* **Cross-Language Support:** Benchmark algorithms written in C++, Go, Rust, Python, Lean, and more, all within a single pipeline.

* **Strict Fairness:** Timings strictly measure the sorting algorithm itself. File I/O, string parsing, memory allocation, and framework overhead are explicitly excluded from the measured execution time.

* **High-Resolution Metrics:** Captures execution times down to the nanosecond using monotonic, high-precision timers.

* **Reproducible Workloads:** Data generators use deterministic seeding, ensuring that every algorithm across every language sorts the exact same sequence of pseudo-random arrays.

* **Rich Analysis:** Includes a Python-based lab environment with Jupyter notebooks, Pandas, and Matplotlib/Seaborn for data exploration and visualization.

## Architecture

The benchmark suite is built on a pipeline-based architecture managed by the `impa` binary:

1. **Generators (`gen_*`):** Standalone programs that deterministically generate datasets based on specific distributions (like uniform, nearly sorted, or many duplicates) and stream them to standard output.

2. **Algorithms (`algo-*`):** Standalone programs (Sorters) that read arrays from standard input, run specific sorting functions, and report the nanosecond execution time to standard output.

3. **Orchestrator (`impa`):** A Rust-based binary that manages the build process, pipes data from Generators to Algorithms, and collects the resulting CSV metrics.

4. **Laboratory (`lab/`):** A Python API (`benchmarking.py`) that wraps the `impa` orchestrator, allowing for programmable benchmark sweeps and Jupyter-based analysis.

### Directory Structure


```

sort-bench/
├── algo-<lang>*sorter/   # Language-specific sorting algorithms (e.g., algo-cpp_sorter)
├── gen*<author>_<type>/  # Data distribution generators (e.g., gen_somombo_unifshuffle)
├── lab/                  # Python analysis environment & Jupyter notebooks
├── skills/               # Specialized instructions for AI-assisted development
└── README.md

```

## Getting Started

### Prerequisites

* **Python 3.10+** (for the analysis lab)

* **uv** (recommended for fast Python dependency management)

* Compilers for the languages you wish to benchmark (e.g., `g++`/`clang++`, `go`, `rustc`, `lean`).

### Setup the Laboratory

The primary way to interact with `sort-bench` is through the Python lab environment.

1. Navigate to the lab directory:


```
cd lab
```

2. Install dependencies using `uv` (or standard `pip`):


```
uv sync
```

3. Start Jupyter Lab to view existing studies or create a new one:


```
uv run jupyter lab
```

### Running a Benchmark

Check out `lab/template_study.ipynb` or `lab/qsort_study.ipynb` for examples of how to run a benchmark programmatically. Under the hood, the Python wrapper will automatically download the `impa` orchestrator into `.bin/`, build the requested components, and execute the pipeline.

## Adding New Components

Both generators and algorithms are self-contained executable projects. To integrate a new component into the pipeline, it must include an `impafile.toml` that defines how to build and run it.


```toml
# Example impafile.toml for a C++ Sorter

name = "algo-cpp_sorter"
type = "algorithm"
language = "cpp"

[build]
command = "g++"
args = ["-O3", "-std=c++20", "sorter.cpp", "-o", "sorter"]

[run]
command = "./sorter"
args = []
```

### AI-Assisted Development

If you are using an AI coding assistant (like GitHub Copilot, Cursor, or an autonomous agent), you can point it to the instructions in `AGENTS.md`. The repository contains standard `SKILL.md` specifications to help AI generate fully compliant algorithms and generators.

## Contributing

Contributions are welcome. Whether you want to add a new sorting algorithm, implement a generator for a new data distribution, or improve the Python analysis tools, feel free to open a Pull Request.

Please ensure that new components:

1. Include an `impafile.toml`.

2. Compile with maximum optimizations (e.g., `-O3`, `--release`).

3. Adhere to the strict memory and timing fairness constraints.

## License

This project is licensed under the MIT License.

