# sort-bench Agent Instructions

`sort-bench` is a multi-language benchmarking suite for sorting algorithms using the [impalab framework](https://github.com/somombo/impalab).
It uses a Rust orchestrator (`impa`) wrapped by Python (`lab/`).
Algorithms (`components/exec-*/`) and data generators (`components/gen_*/`) are self-contained executables defined by `impafile.toml`.

## General Rules

* **Performance:** Enable maximum compiler optimizations (e.g., `-O3` for C++, `--release` for Rust).
* **Fairness:** Exclude memory allocation, parsing, and standard I/O overhead from the measured sorting time.
* **Idiomatic & Clean Code:** Write native-feeling code. Prioritize self-documenting names. Use standard docstrings.
* **Comments:** Limit inline comments to non-obvious intent or complexity. Never explain basic syntax.
* **Reviewability:** Prefer changes that are easy to review via git diff.
* **Reference:** Refer to `lab/template.ipynb` when writing Python analysis scripts or interfacing with `impa`.
* **Ignored Directories:** Do not use or modify anything in directories named `__delete` or `.ignore` unless explicitly directed to.