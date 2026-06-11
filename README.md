# sort-bench

> A high-precision, cross-language benchmarking suite for sorting algorithms.

`sort-bench` is a testing environment designed to measure, compare, and analyze how well sorting algorithms perform across different programming languages. Powered by the [`impalab`](https://github.com/somombo/impalab) framework, it provides an isolated, reproducible, and fair way to test algorithms.

## Key Features

* **Cross-Language Support:** Benchmark algorithms written in C, C++, C#, Go, Java, JavaScript, Lean, OCaml, Python, Rust, and Zig within a single pipeline.
* **Strict Fairness:** Timings strictly measure the sorting algorithm itself. File I/O, string parsing, memory allocation, and framework overhead are explicitly excluded from the measured execution time.
* **High-Resolution Metrics:** Captures execution times down to the nanosecond using monotonic, high-precision timers.
* **Reproducible Workloads:** Data generators use deterministic seeding, ensuring that every algorithm sorts the exact same sequence of pseudo-random arrays.
* **Rich Analysis:** Includes a Python-based lab environment with Jupyter notebooks, Pandas, and Matplotlib/Seaborn for data exploration and visualization.

## Architecture

The benchmark suite is built on a pipeline-based architecture managed by the `impalab` framework:

1. **Generators (`components/gen_*`):** Standalone programs that deterministically generate datasets based on specific distributions (like uniform, nearly sorted, or many duplicates) and stream them to standard output. For a detailed breakdown of parameters and distribution modeling, see the [Uniform Shuffle Generator README](components/gen_somombo_unifshuffle/README.md).
2. **Executors (`components/exec-*`):** Standalone sorting algorithms that read arrays from standard input, run specific sorting functions, and report the nanosecond execution time to standard output.
3. **Orchestrator (`impa`):** A Rust-based binary that manages the build process, pipes data from Generators to Executors, and collects the resulting CSV metrics.
4. **Python SDK (`impalab_py`):** An external Python API that wraps the `impa` orchestrator. It allows for programmable benchmark sweeps and integration directly into data science workflows.

### Directory Structure

```text
sort-bench/
├── components/
│   ├── exec-*/          # Language-specific sorting algorithms (e.g., exec-cpp_sorter)
│   └── gen_*/           # Data distribution generators (e.g., gen_somombo_unifshuffle)
├── lab/                 # Python analysis environment & Jupyter notebooks
├── .agents/skills/      # Specialized instructions for AI-assisted development
└── README.md
```

## Scientific Methodology

To ensure that performance comparisons across disparate languages and runtimes are fair, rigorous, and statistically sound, `sort-bench` enforces a strict methodology:

1. **Deterministic Execution:** The data pipeline relies on seeded pseudo-random number generators (PRNGs). Every algorithm under test receives the exact same sequence of elements.
2. **System Jitter Mitigation (Min-over-Reps):** Operating system noise (e.g., CPU context switches, GC pauses) is an unavoidable reality. The orchestrator runs multiple repetitions (`reps`) of the exact same data array for each algorithm. The analysis layer then takes the **minimum execution time** across those repetitions (`duration.idxmin()`) to represent the true, unhindered algorithm performance.
3. **Advanced Parameter Space Sampling:** The lab environment utilizes intelligent sampling strategies (e.g., Highly Composite Numbers, Farthest Point Sampling, and geometric scaling sequences) via `sample_factors.py`. This ensures that experiments explore a broad, unbiased space of array sizes and distribution complexities without combinatorial explosion.
4. **Execution Isolation:** All standard I/O overhead, string parsing, and memory allocation associated with reading the dataset are completely excluded from the recorded timings. Algorithms measure only the nanoseconds spent inside the active sorting routine.
5. **Robust Aggregations:** When visualizing trends across multiple random arrays of the same type (`runs`), the lab defaults to using median performance aggregates to further guard against systemic outliers.

## Getting Started: Data Analysis Workflow

The primary way to interact with `sort-bench` is through the Python lab environment. This workflow allows you to define studies, run the pipeline, and visualize the output using standard data science tools.

### Prerequisites

* **Python 3.13+**
* **uv** (recommended for fast Python dependency management)
* Compilers for the languages you wish to benchmark (e.g., `g++`, `go`, `rustc`, `lean`).

### Setup the Laboratory

1. Navigate to the lab directory:
   ```bash
   cd lab
   ```

2. Install dependencies using `uv` (or standard `pip`):
   ```bash
   uv sync
   ```

3. Start Jupyter Lab to view existing studies or create a new one:
   ```bash
   uv run jupyter lab
   ```

### Running a Benchmark Study

To run a benchmark programmatically, define an `Impa` study within a Jupyter notebook. The Python SDK will automatically invoke the `impa` orchestrator to build the required components, execute the data pipeline, and return the metrics as a Pandas DataFrame.

Check out `lab/qsort_study.ipynb` or `lab/faster_sort_study.ipynb` for concrete examples of how to define study parameters, execute the pipeline, and generate visualizations.

## Adding New Components

Both generators and algorithms are self-contained executable projects. To integrate a new component into the pipeline, create a new directory inside `components/` and include an `impafile.toml` that defines how to build and run the executable.

```toml
# Example impafile.toml for a C++ Executor

[[components]]
name = "cpp_sorter"
type = "executor"

[components.build]
command = "c++"
args = [
    "-DNDEBUG",
    "-std=c++17",
    "-O3",
    "-Wall",
    "-Wextra",
    "sorter.cpp",
    "-o",
    "sorter_cpp_exe",
]

[components.run]
command = "./sorter_cpp_exe"
```

Please ensure that new components:
1. Include a valid `impafile.toml`.
2. Compile with maximum optimizations (e.g., `-O3`, `--release`).
3. Adhere to the strict memory and timing fairness constraints defined by the framework.

### AI-Assisted Development

If you are using an AI coding assistant or an autonomous agent, point it to the instructions in `AGENTS.md`. The repository contains standard specifications in `.agents/skills/` to help AI generate fully compliant algorithms and generators.

## Contributing

Contributions are welcome. Whether you want to add a new sorting algorithm, implement a generator for a new data distribution, or improve the Python analysis tools, please open a Pull Request.

## License

This project is licensed under the MIT License.
