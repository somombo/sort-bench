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
* Each line represents a single test case formatted with a pipe (`|`) delimiter.
* The token before the pipe is the unique string `data_token` (ID) for the test case.
* The tokens after the pipe are the comma-separated numeric values of the array.

Example input:
```text
array1|123,45,678,9
array2|5,2,8,1
```

### 2. Output Format

* The output must be written to standard output in a pipe-delimited format: `dur_nanoseconds|id\n`
* The duration must be an integer representing the total nanoseconds elapsed.

Example output:

```text
8900|array1
9250|array2
```

### 3. Command Line Interface

* The program must accept exactly one command-line argument specifying the function name to execute (e.g., `std::sort` or `slice::sort`).

### 4. Environmental Variables

The executor program receives the following environment variables from the framework:
* `IMPALAB_COMPONENT_NAME`: The unique name of the executor component (e.g., `rust`).
* `IMPALAB_TASK_INDEX`: The 0-based index of the task within the configuration's tasks list.
* `IMPALAB_REP_INDEX`: The current repetition run index (0-based) for the task.
* `IMPALAB_REPS`: The total number of repetitions planned for this task.
* `IMPALAB_ATTRIBUTES`: A minified, single-line JSON string containing the merged attributes of the benchmark configuration.

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
2. Create a fresh identical copy of the master array. This memory allocation must happen before the timer starts.
3. Start a high-resolution monotonic timer (e.g., `time.perf_counter`, `performance.now`, `System.nanoTime`). Wall-clock time is strictly forbidden.
4. Run the specified sort function on the array copy.
5. Stop the monotonic timer immediately after the function returns.
6. Print the result to standard output in `dur_nanoseconds|id\n` format and immediately flush standard output to prevent pipeline stalls.
7. Discard the master array and all copies before reading the next line to free up memory.

## Deliverables

1. The complete source code for the sorter program.
2. Standard language-specific project files (e.g., `go.mod`, `package.json`, `Cargo.toml`, or a component-level `.gitignore`) establishing the component as a self-contained subproject.
3. An `impafile.toml` configuration file to integrate this component into the impalab framework. You must adhere to the [impafile schema](assets/impafile_schema.json) for the required format.
   - The root configuration must define a list of components under `components` using the TOML array of tables syntax `[[components]]`.
   - Each component must set `type = "executor"`.
   - Example configuration for a C++ Sorter:
     ```toml
     [[components]]
     name = "cpp"
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
4. If the language requires specific build steps or environment variables to achieve a fully optimized release build, provide a `build.sh` script and reference it in the `impafile.toml`. Performance is critical so release optimizations must be enabled.