---
name: create-generator
description: Generates a benchmark data generator component for the sort-bench pipeline.
---

# Create Benchmark Data Generator

Generate the complete source code and project files for a command-line Data Generator program. This program creates datasets with specific patterns and streams them to standard output for consumption by algorithm components within the impalab framework.

## Contractual Interface

### 1. Output Format
* The generator streams output to standard output.
* Each line represents a single test array, formatted as a comma-separated list.
* The first token must be a unique string ID for the generated array (e.g., `random_1000_1`).
* The remaining tokens are the numeric values comprising the array.

Example output:
```csv
unif_100_1,54,12,99,23,5,101,88
unif_100_2,12,77,43,1,90,32,14
```

### 2. Configuration and Determinism
* Accept configuration via command-line arguments (e.g., `--size`, `--seed`, `--count`) as defined in the associated `impafile.toml`.
* Generation must be strictly deterministic. Given the same seed, the generator must produce the exact same sequence of arrays.

## Task Details

* **Memory Efficiency:** Do not hold entire datasets in memory. Generate an array, print it, flush it to standard output, release the associated memory, and proceed to the next iteration.
* **Data Types:** Generate strictly unsigned 32-bit integers unless specified otherwise by the framework or argument.
* **Randomness:** Utilize high-quality Pseudo-Random Number Generators (PRNGs) seeded appropriately to ensure reproducible distributions.

## Deliverables

1. The complete source code for the data generator program.
2. Standard language-specific project files and environment configurations (e.g., `requirements.txt`, `pyproject.toml`, `go.mod`).
3. An `impafile.toml` configuration file specifying the executable `run` command and defining the arguments passed by the framework.