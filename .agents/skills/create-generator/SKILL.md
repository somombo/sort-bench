---
name: create-generator
description: Generates a benchmark data generator component for the sort-bench pipeline.
---

# Create Benchmark Data Generator

Generate the complete source code and project files for a command-line Data Generator program. This program produces deterministic, seeded test data for a sorting benchmark.

This program is the first component of a multi-part benchmark pipeline. Its standard output will be piped directly into the standard input of one or more Sorter executables. The output format must be exact to ensure compatibility.

## Contractual Interface

### 1. Command Line Interface & Environment

The program receives framework configurations via the following environment variables:
* `IMPALAB_SEED`: A 64-bit unsigned integer (`u64`) seed (e.g., `42`) to seed the RNG and guarantee reproducibility.
* `IMPALAB_COMPONENT_NAME`: The unique name of the generator component (e.g., `somombo_unifshuffle`).
* `IMPALAB_ATTRIBUTES`: A minified, single-line JSON string containing the merged attributes of the benchmark configuration.

The program can also accept custom command-line arguments or flags required to define its specific data generation logic (e.g. `--runs`, `--size`, etc.). These are implementation-specific.

Examples of custom flags:
* `--size=<Nat>` and `--max-val=<Nat>` for a simple uniform generator.
* `--cardinality=<Nat>`, `--multiplicity=<Nat>`, and `--swaps=<Nat>` for a shuffle-based generator.
* `--size=<Nat>` and `--alpha=<Float>` for a Zipf distribution generator.

### 2. Output Format (to standard output)

This is the critical contractual interface.
* The generator streams output to standard output.
* Each test case must be formatted as: `data_token|array_values\n`
* The `data_token` is the unique ID for the test case, formatted as `{run_number}_{hash_of_arraycsv}`, where:
  * `run_number` is the 1-based index of the array being generated.
  * `hash_of_arraycsv` is a hash of the subsequent array data (e.g., `hash "1,0,2"`).
* The `array_values` contains the comma-separated numeric values comprising the array.
* Every line, including the very last one, must be terminated by a single newline character (`\n`).

Example standard output:
```text
1_2091873|1,0,2
2_9834712|0,2,1
```

## Task Details

* **Data Generation Logic:** The RNG must be initialized with the seed provided via `IMPALAB_SEED` (falling back to a default seed like 42 if not set). Iterate to produce the requested test cases. In each run, generate a single array based on the specified parameters.
* **Memory Efficiency:** Do not hold entire datasets in memory. Generate an array, print it, flush it to standard output, release the associated memory, and proceed to the next iteration.
* **Data Types:** Generate strictly unsigned 32-bit integers unless specified otherwise by the framework or argument.

## Deliverables

1. The complete source code for the data generator program.
2. Standard language-specific project files and environment configurations (e.g., `requirements.txt`, `pyproject.toml`, `go.mod`).
3. An `impafile.toml` configuration file specifying the executable `run` command and defining the arguments passed by the framework. You must adhere to the [impafile schema](assets/impafile_schema.json) for the required format.
   - The root configuration must define a list of components under `components` using the TOML array of tables syntax `[[components]]`.
   - Each component must set `type = "generator"`.
   - Example configuration for an interpreted Python Generator:
     ```toml
     [[components]]
     name = "python-generator"
     type = "generator"

     [components.run]
     command = "python3"
     args = ["generate.py"]
     ```