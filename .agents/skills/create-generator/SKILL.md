---
name: create-generator
description: Generates a benchmark data generator component for the sort-bench pipeline.
---

# Create Benchmark Data Generator

Generate the complete source code and project files for a command-line Data Generator program. This program produces deterministic, seeded test data for a sorting benchmark.

This program is the first component of a multi-part benchmark pipeline. Its standard output will be piped directly into the standard input of one or more Sorter executables. The output format must be exact to ensure compatibility.

## Contractual Interface

### 1. Command Line Interface

The program must accept the following standard command-line flags:
* `--runs=<Nat>`: (Optional, default 1) The total number of arrays (test cases) to generate.
* `--seed=<Nat>`: (Optional) A natural number used to seed the program's random number generator (RNG). If not provided, a default seed (e.g., 42) must be used.

The program can also accept additional command-line arguments or flags required to define its specific data generation logic. These are implementation-specific.

Examples of specific flags:
* `--size=<Nat>` and `--max-val=<Nat>` for a simple uniform generator.
* `--cardinality=<Nat>`, `--multiplicity=<Nat>`, and `--swaps=<Nat>` for a shuffle-based generator.
* `--size=<Nat>` and `--alpha=<Float>` for a Zipf distribution generator.

### 2. Output Format (to standard output)

This is the critical contractual interface.
* The generator streams output to standard output.
* Each test case must be formatted as a single line of comma-separated values (CSV).
* The first token is a string `id` for the test case.
* The `id` must be formatted as `{run_number}_{hash_of_arraycsv}`, where:
  * `run_number` is the 1-based index of the array being generated (i.e., from 1 to `runs`).
  * `hash_of_arraycsv` is a hash of the subsequent array data (e.g., `hash "1,0,2"`).
* The remaining tokens are the numeric values comprising the array.
* Every line, including the very last one, must be terminated by a single newline character (`\n`).

Example standard output for `runs=2`:
```csv
1_2091873,1,0,2
2_9834712,0,2,1

```

## Task Details

* **Data Generation Logic:** The RNG must be initialized with the provided seed or the default. Iterate `runs` times. In each run, generate a single array based on the specific command-line parameters.
* **Memory Efficiency:** Do not hold entire datasets in memory. Generate an array, print it, flush it to standard output, release the associated memory, and proceed to the next iteration.
* **Data Types:** Generate strictly unsigned 32-bit integers unless specified otherwise by the framework or argument.

## Deliverables

1. The complete source code for the data generator program.
2. Standard language-specific project files and environment configurations (e.g., `requirements.txt`, `pyproject.toml`, `go.mod`).
3. An `impafile.toml` configuration file specifying the executable `run` command and defining the arguments passed by the framework.