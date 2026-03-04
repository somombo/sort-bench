---
name: create-algorithm
description: Generates a sorting algorithm component executable for the sort-bench pipeline.
---

# Create Sorting Benchmark Executable

Generate the complete source code and project files for a command-line Sorter program in a target programming language. This program reads benchmark data from standard input, times the execution of internal sorting functions, and outputs performance metrics to standard output.

This program is a component of a multi-part benchmark pipeline built on the impalab framework. It must be treated as a self-contained workspace or subproject.

## Contractual Interface

### 1. Input Format
* The program receives a data stream from standard input.
* Each line represents a single test case formatted as a comma-separated list.
* The first token is a string ID for the test case.
* The remaining tokens are the numeric values of the array.

Example input:
```csv
array1,123,45,678,9
array2,5,2,8,1

```

### 2. Output Format

* The output must be a 3-column CSV written to standard output with no header.
* For every single sort executed, print one line in the exact format: `id,funcName,dur_nanoseconds\n`
* The duration must be an integer representing the total nanoseconds elapsed.

Example output:

```csv
array1,std_sort,8900
array1,std_stable_sort,9250

```

### 3. Command Line Interface

* The program must accept exactly one command-line argument format: `--functions=func1,func2` (a comma-separated list of function names to benchmark).

## Strict Technical Requirements

* **Standard Libraries Only:** Do not use any third-party packages or dependencies for the sorting logic or benchmarking.
* **Identify Standard Sorts:** Automatically identify and implement wrappers for all general-purpose sorting functions provided by the target language or its standard library (e.g., standard sorts, stable sorts).
* **Fail Loudly:** The program must immediately exit with a non-zero exit code and write an error message to standard error if it encounters a malformed input line, a parsing error, or an unrecognized function name.
* **Strict Number Parsing:** Ignore empty lines and ignore empty tokens (like trailing commas). However, every non-empty numeric token must be strictly parsed as a 32-bit unsigned integer (uint32).
* **Robust Input Reading and Fast IO:** Maximize I/O throughput. Do not perform unbuffered character-by-character or line-by-line system calls. You must use the language's most efficient buffered standard I/O mechanisms, whether that is an explicit wrapper class, a specialized stream module, or disabling default I/O synchronization.
* **Memory Efficiency:** Minimize allocations in the main execution loop. For systems languages, clear and reuse memory buffers to prevent allocation bottlenecks. For functional or dynamic scripting languages, use the most performant native stream processing and idiomatic allocation strategies.
* **No Correctness Checks:** Assume the sorting algorithms are correct.

## Task Details

Process the standard input stream one line at a time. For each line read, strictly follow these steps:

1. Parse the line into its string ID and a single master in-memory array of uint32 values.
2. For each function name provided in the command line argument:
   a. Create a fresh identical copy of the master array. This memory allocation must happen before the timer starts.
   b. Start a high-resolution monotonic timer (e.g., `time.perf_counter`, `performance.now`, `System.nanoTime`). Wall-clock time is strictly forbidden.
   c. Run the specified sort function on the array copy.
   d. Stop the monotonic timer immediately after the function returns.
   e. Print the result to standard output and immediately flush standard output to prevent pipeline stalls.
3. Discard the master array and all copies before reading the next line to free up memory.

## Deliverables

1. The complete source code for the sorter program.
2. Standard language-specific project files (e.g., `go.mod`, `package.json`, `Cargo.toml`, or a component-level `.gitignore`) establishing the component as a self-contained subproject.
3. An `impafile.toml` configuration file to integrate this component into the impalab framework.
4. If the language requires specific build steps or environment variables to achieve a fully optimized release build, provide a `build.sh` script and reference it in the `impafile.toml`. Performance is critical so release optimizations must be enabled.