# sort-bench Agent Instructions

`sort-bench` is a multi-language benchmarking suite for sorting algorithms. It measures, compares, and analyzes performance across different programming languages and data distributions using the [impalab framework](https://github.com/somombo/impalab).

## Architecture & Directory Structure

The system uses a modular architecture managed by a Rust-based binary orchestrator (`impa`), which is wrapped by Python for execution and analysis.

* `algo-<lang>_sorter/`: Implementations of sorting algorithms (Sorters) in specific languages.
* `gen_<author>_<type>/`: Data generators that create specific test datasets.
* `lab/`: The Python-based laboratory for running experiments. It contains the orchestrator API (`benchmarking.py`), analysis tools (`exploration.py`), and Jupyter notebooks.
* `.agents/skills/`: Contains specialized instructions for adding new components to the pipeline.

Each generator and algorithm component is a self-contained executable defined by a local `impafile.toml`.

## Available Skills

Do not guess or hallucinate component I/O interfaces. When asked to create new components, you must load and strictly follow the contractual interfaces defined in these skills:

* [create-algorithm](skills/create-algorithm/SKILL.md): Use to implement a new sorting algorithm executable in a target language.
* [create-generator](skills/create-generator/SKILL.md): Use to implement a new benchmark data distribution generator.

## General Rules

* **Performance:** Always enable maximum compiler optimizations in component build configurations (e.g., `-O3` for C++, `--release` for Rust).
* **Fairness:** Sorting benchmarks must strictly isolate the sorting function by excluding memory allocation, parsing, and standard I/O overhead from the measured time.
* **Clean Code Practices:** Prioritize self-documenting variable and function names over inline comments. Use standard docstrings for public interfaces only. Limit inline comments to non-obvious intent or complexity. Never explain basic syntax.
* **Idiomatic Language Features:** Use idiomatic language patterns where applicable. Write code that is safe and feels native to the target language.
* **Reference Material:** When writing Python analysis scripts or interfacing with the orchestrator, refer to `lab/benchmarking.py` and `lab/template_study.ipynb` for correct usage.


- Limit inline comments to non-obvious intent or complexity e.g. it should never never explain syntax via comments. 
- Prefer to make changes that are as easy as possible for human to review e.g by inspecting git diff.