# gen_somombo_unifshuffle

This component is a data generator for the `sort-bench` pipeline, implemented in Lean 4. It generates arrays of uniform integers with highly configurable parameters, allowing for the creation of various data distributions ranging from fully random to nearly sorted or reverse sorted arrays.

The component primarily relies on **`somombo_unifshuffle_multi`**, a variant that accepts multiple generation configurations via JSON payloads and embeds rich base64-encoded metadata into its output. It also provides `somombo_unifshuffle` as a basic CLI-flag-based single generator.

---

## `somombo_unifshuffle_multi` (Primary Generator)

The multi-variant is designed to batch multiple generation profiles into a single invocation. It reads a JSON payload containing a list of parameter objects and relies on an environment variable for the random seed.

### Input Parameters (JSON Payload)

The executable takes a single command-line argument: a valid JSON array of parameter objects.

Each parameter object accepts the following fields:

* **`cardinality`** (Integer, Default: 1)
  * **Description:** The number of unique elements in the base array. The elements range from `0` to `cardinality - 1`.
  * **Example:** `{"cardinality": 3}` uses the elements `{0, 1, 2}`.
* **`multiplicity`** (Integer, Required)
  * **Description:** The number of times each unique element appears. The total array length is `cardinality * multiplicity`.
  * **Example:** `{"cardinality": 3, "multiplicity": 2}` produces a base array of `{0, 0, 1, 1, 2, 2}`.
* **`descending`** (Boolean, Optional)
  * **Description:** If `true`, the base array is sorted in descending order *before* any swaps are applied.
* **`swaps`** (Integer, Optional)
  * **Description:** The number of random swaps to perform. If omitted or `null`, the array is randomly shuffled using a full Fisher-Yates style shuffle.
* **`runs`** (Integer, Default: 1)
  * **Description:** The number of distinct arrays to generate for this specific parameter object.

**Global Seed:**
The random seed is controlled via the `IMPALAB_SEED` environment variable. If set to an integer, it initializes the PRNG to guarantee reproducible generation across the entire batch.

### Example Invocation

```bash
lake build data_generator_multi -R
IMPALAB_SEED=42 .lake/build/bin/data_generator_multi \
  '[{"cardinality": 1000, "multiplicity": 1, "swaps": 10, "descending": false, "runs": 3}, {"cardinality": 4, "multiplicity": 250, "runs": 1}]'
```

### Output Format

The generator outputs to `stdout`. Each line represents a generated array with embedded metadata:
`meta:<base64_encoded_json>|<comma_separated_array>`

* **`meta:<base64_encoded_json>`**: A base64-encoded JSON object detailing the exact parameters used to generate the array. When decoded, it looks like:
  ```json
  {
    "id": "0_0_11546041020033230969", 
    "cardinality": 1000,
    "multiplicity": 1,
    "swaps": 10,
    "descending": false,
    "seed": "42"
  }
  ```
  *(Note: The `id` field format is `<datagen_index>_<run_index>_<data_hash>`)*
* **`comma_separated_array`**: The actual data elements (e.g., `0,2,1`).

---

## `somombo_unifshuffle` (Standard Single Generator)

The single generator accepts parameters via standard CLI flags. It is useful for quick, standalone tests without JSON formatting.

### Core Flags

* `--cardinality=<Nat>` (Default: 1)
* `--multiplicity=<Nat>` (Required)
* `--swaps=<Nat>` (Optional, full shuffle if omitted)
* `--descending` (Optional flag)
* `--seed=<Nat>` (Optional)
* `--runs=<Nat>` (Default: 1)
* `--reps=<Nat>` (Default: 1) - The number of times to output each generated array.

### Output Format

Outputs directly as `<rep_index>_<run_index>_<data_hash>|<comma_separated_array>`

### Example Invocation

```bash
lake build data_generator -R
.lake/build/bin/data_generator --cardinality=3 --multiplicity=2 --swaps=1 --descending --seed=42 --runs=2
```

---

## Common Configurations & Example Arrays

By combining `cardinality`, `multiplicity`, `descending`, and `swaps`, you can generate specific sorting benchmark distributions. Below are simple concrete examples with small sizes to illustrate the resulting arrays:

* **Fully Random Array:**
  Omit `swaps` to perform a full shuffle.
  * **Payload:** `{"cardinality": 5, "multiplicity": 1}`
  * **Example Output Array:** `3,0,1,4,2`

* **Few Unique Elements (Many Duplicates):**
  Use a small `cardinality` and large `multiplicity`.
  * **Payload:** `{"cardinality": 3, "multiplicity": 3}`
  * **Example Output Array:** `1,2,0,2,1,0,0,1,2`

* **Nearly Sorted Array:**
  Use a large array but a small number of swaps (relative to the size).
  * **Payload:** `{"cardinality": 8, "multiplicity": 1, "swaps": 1}`
  * **Example Output Array:** `0,1,6,3,4,5,2,7` *(Notice 2 and 6 are swapped)*

* **Reverse Sorted Array:**
  Use the `descending` flag and `0` swaps.
  * **Payload:** `{"cardinality": 5, "multiplicity": 1, "descending": true, "swaps": 0}`
  * **Example Output Array:** `4,3,2,1,0`

* **Nearly Reverse Sorted Array:**
  Use the `descending` flag and a small number of swaps.
  * **Payload:** `{"cardinality": 5, "multiplicity": 1, "descending": true, "swaps": 1}`
  * **Example Output Array:** `4,1,2,3,0` *(Notice 1 and 3 are swapped from reverse order)*

* **Organized Blocks of Duplicates:**
  If you want blocks of reverse-sorted duplicates, combine `multiplicity` with `descending`.
  * **Payload:** `{"cardinality": 3, "multiplicity": 2, "descending": true, "swaps": 0}`
  * **Example Output Array:** `2,2,1,1,0,0`

---

## Standard Orchestrator Usage

When used within the `sort-bench` pipeline, the orchestrator handles building and execution using the configurations defined in `impafile.toml`. 

The component provides two execution targets:
* `somombo_unifshuffle_multi`: (Primary) The multi-parameter generator variant. The python lab environment maps study definitions to the JSON payload and handles `IMPALAB_SEED`.
* `somombo_unifshuffle`: The standard single generator.
