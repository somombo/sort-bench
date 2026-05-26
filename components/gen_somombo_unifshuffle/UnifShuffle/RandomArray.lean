-- module

import ShuffleSample
attribute [grind →] Membership.mem.upper -- TODO: somombo) should be added upstream
def dbg {α : Type u} [ToString α]  (a : α) (s : String) : α :=
  dbgTrace s!"{s}" (fun _ => a)

private def Float.toNatFloor (f : Float) := f.floor.toUSize.toNat
private def Float.toNatCeil (f : Float) := f.ceil.toUSize.toNat


def Array.toPopulation {α : Type} (counts: Array Nat)
    (populationFn : Fin counts.size → α := by exact fun i => i.1)
    (reverse := false) : Array α := Id.run do
  let mut population := Array.emptyWithCapacity counts.sum
  for _' : i in [:counts.size] do
    let i_ : Fin counts.size := ⟨if reverse then counts.size - 1 - i else i, by grind⟩
    for _ in [:counts[i_]] do population := population.push (populationFn i_)

  return population


/- public -/ def Array.unifRandNats (cardinality : Nat) (multiplicity : Nat := 1)
    (swaps : Option Nat := none) (descending := false) : IO (Array Nat) := do
  if cardinality ≤ 0 then
    throw $ IO.userError s!"ERROR: The cardinality {cardinality} must be a positive natural number."
  if multiplicity ≤ 0 then
    throw $ IO.userError s!"ERROR: The mean-multiplicity {multiplicity} must be a positive natural number."

  /- mean_multiplicity d is dupes_per_unique. So  1 ≤ d ≤ s -/
  /- cardinality c is the number of unique elements. So 1 ≤ c ≤ s -/
  let size := cardinality * multiplicity
  if size = 1 then return #[0]
  let swaps := swaps.getD (size - 1)

  Array.replicate cardinality multiplicity
  |>.toPopulation (reverse := descending)
  |>.partialShuffleSample (sample_size := size) (swaps := swaps)



/--
TODO: Deprecate this in favor of Array.unifRandNats
Generates an array of random natural numbers with specific characteristics
controlled by the following.

- `size`: The desired number of elements in the output array.
- `nmm`: Normalized Mean Multiplicity (NMM). The ratio of mean multiplicity to size.
  A float between 0.0 and 1.0  that controls the proportion of duplicate values in the array.
- `swaps_ratio`: A float that determines how many random swaps to perform.
  The number of swaps is (roughly speaking) `(size * swaps_ratio).toNat`.
  - 0.0 means no swaps (perfectly sorted).
  - 1.0 means `size` number of swaps.
- `reverse`: If true, the initial array is sorted in descending order;
  otherwise, it's ascending.

The function operates in the `IO` monad to handle the random number generation.
-/
private def Array.randNats (size : Nat) (nmm : Float := 0)
    (swaps_ratio : Float := 1) (reverse := false)
    : IO (Array Nat) := do
  if size = 0 then return #[]

  let swaps := ((size - 1).toFloat * swaps_ratio).toNatCeil

  /- mean_multiplicity d is dupes_per_unique. So  1 ≤ d ≤ s -/
  let mean_multiplicity : Float := max 1.0 (min (nmm * size.toFloat) size.toFloat)

  /- cardinality c is the number of unique elements. So 1 ≤ c ≤ s -/
  let card : Float := max 1.0 (min (size.toFloat / mean_multiplicity) size.toFloat) --

  if card.floor != card then
    throw $ IO.userError s!"ERROR: The cardinality {card} must be a positive natural number."
  if mean_multiplicity.floor != mean_multiplicity then
    throw $ IO.userError s!"ERROR: The mean-multiplicity {mean_multiplicity} must be a positive natural number."

  -- println! s!"(size := {size.toFloat}) (nmm := {nmm}) (swaps_ratio := {swaps_ratio}), (reverse := {reverse})\
  -- \n(cardinality := {card.toNatFloor}) (multiplicity := {mean_multiplicity.toNatCeil}) (swaps := {swaps}) (descending := {reverse})"

  Array.unifRandNats card.toNatFloor mean_multiplicity.toNatCeil swaps reverse


/--
Generates an array of random natural numbers where one value is duplicated
many times and other values are unique.

- `size`: The desired number of elements in the output array.
- `duplicate_ratio`: A float between 0.0 and 1.0 that controls the
  proportion of duplicate values. `duplicate_ratio * size` gives the number
  of that are not unique.
- `swaps_ratio`: A float that determines how many random swaps to perform.
  The number of swaps is `(size * swaps_ratio).toNat`.
  - 0.0 means no swaps (initial array is sorted).
  - 1.0 means `size` number of swaps.
- `reverse`: If true, the initial array is sorted in descending order;
  otherwise, it's ascending.

The function operates in the `IO` monad to handle random number generation.
-/
/- public -/ def Array.randNatsWithDominantVal (size : Nat) (duplicate_ratio : Float := 0)
    (swaps_ratio : Float := 1) (reverse := false)
    : IO (Array Nat) := do
  if size = 0 then return #[]

  let swaps := ((size - 1).toFloat * swaps_ratio).toNatCeil
  let dupes_num : Float := max 1.0 (min (duplicate_ratio * size.toFloat) size.toFloat)

  let dupes_num := dupes_num.toNatFloor
  let u := size - dupes_num

  let dominant_val ← IO.rand 0 u

  Array.replicate (u + 1) 1 -- size of this is u + 1
  |>.set! dominant_val dupes_num
  |>.toPopulation (reverse := reverse)
  |>.partialShuffleSample (sample_size := size) (swaps := swaps)


------------------------- TESTS FOR THE ABOVE  ----------------------------

-- Helper function to run a test and print its output neatly.
private def runAndPrint (name : String) (testAction : IO (Array Nat)) : IO Unit := do
  IO.println s!"--- {name} ---"
  let result ← testAction
  IO.println s!"Example: {result}\n"


#eval do
  -- Example 1: Edge case with size 0.
  runAndPrint "Size 0" $
    Array.randNats 0 (nmm := 0)

/-
(size := 10.000000) (nmm := 0.000000) (swaps_ratio := 0.000000), (reverse := false)
(cardinality := 10) (multiplicity := 1) (swaps := 0) (descending := false)
Example: #[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
-/
#eval do
  -- Example 2: Perfectly sorted (default parameters).
  runAndPrint "Size 10, Sorted, 0% swaps" $
    Array.randNats 10 (nmm := 0) (swaps_ratio := 0)
/-
(size := 10.000000) (nmm := 0.000000) (swaps_ratio := 0.000000), (reverse := true)
(cardinality := 10) (multiplicity := 1) (swaps := 0) (descending := true)
Example: #[9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
-/
#eval do
  -- Example 3: Perfectly reverse-sorted.
  runAndPrint "Size 10, Reversed, 0% swaps" $
    Array.randNats 10 (nmm := 0) (swaps_ratio := 0) (reverse := true)

/-
(size := 10.000000) (nmm := 0.000000) (swaps_ratio := 0.200000), (reverse := false)
(cardinality := 10) (multiplicity := 1) (swaps := 2) (descending := false)
Example: #[0, 5, 2, 3, 4, 1, 6, 7, 8, 9]
-/
#eval do
  -- Example 4: A few swaps on a sorted array.
  -- swap_ratio = 0.2 means ceil(10 * 0.2) = 2 swaps.
  runAndPrint "Size 10, Sorted, 20% swaps (2 swaps)" $
    Array.randNats 10 (nmm := 0) (swaps_ratio := 0.2)

/-
(size := 12.000000) (nmm := 0.000000) (swaps_ratio := 0.166667), (reverse := false)
(cardinality := 12) (multiplicity := 1) (swaps := 2) (descending := false)
Example: #[9, 4, 2, 3, 1, 5, 6, 7, 8, 0, 10, 11]
-/
#eval do
  -- Test 12 of uniques.
  runAndPrint "Size 12, Sorted, with ceil((12-1)/12)*2 = 2 swaps" $
    Array.randNats 12 (nmm := 0) (swaps_ratio := 2.0/12.0) /- (reverse := false) -/

/-
(size := 10.000000) (nmm := 0.000000) (swaps_ratio := 0.200000), (reverse := true)
(cardinality := 10) (multiplicity := 1) (swaps := 2) (descending := true)
Example: #[1, 2, 7, 6, 5, 4, 3, 8, 9, 0]
-/
#eval do
  -- Example 5: A few swaps on a reverse-sorted array.
  runAndPrint "Size 10, Reversed, 20% swaps (2 swaps)" $
    Array.randNats 10 (nmm := 0) (swaps_ratio := 0.2) (reverse := true)

/-
(size := 10.000000) (nmm := 0.000000) (swaps_ratio := 1.000000), (reverse := false)
(cardinality := 10) (multiplicity := 1) (swaps := 9) (descending := false)
Example: #[4, 1, 2, 5, 0, 8, 3, 6, 7, 9]
-/
#eval do
  -- Example 6: Heavily swapped, almost random.
  -- swap_ratio = 1.0 means floor(10 * 1.0) = 10 swaps.
  runAndPrint "Size 10, Sorted, 100% swaps (10 swaps)" $
    Array.randNats 10 (nmm := 0) (swaps_ratio := 1.0)



---
/-
(size := 10.000000) (nmm := 0.050000) (swaps_ratio := 1.000000), (reverse := false)
(cardinality := 10) (multiplicity := 1) (swaps := 9) (descending := false)
Example: #[7, 4, 1, 0, 9, 8, 6, 3, 5, 2]
-/
#eval do
  runAndPrint "Size 10, Low Duplicates (effectively a shuffle)" $
    Array.randNats 10 (nmm := 0.05)

----

/-
(size := 10.000000) (nmm := 1.200000) (swaps_ratio := 1.000000), (reverse := false)
(cardinality := 1) (multiplicity := 10) (swaps := 9) (descending := false)
Example: #[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
-/
#eval do
  runAndPrint "Size 10, All Duplicates" $
    Array.randNats 10 (nmm := 1.2)

/-
(size := 20.000000) (nmm := 0.250000) (swaps_ratio := 1.000000), (reverse := false)
(cardinality := 4) (multiplicity := 5) (swaps := 19) (descending := false)
Example: #[3, 3, 1, 1, 3, 0, 2, 0, 1, 0, 1, 2, 2, 2, 1, 2, 3, 0, 0, 3]
-/
#eval do
  runAndPrint "Size 20, Medium Duplicates (ratio = 0.25). max val be 3" $
    Array.randNats 20 (nmm := 0.25)


#eval do
  -- Example x: Perfectly sorted with duplicats.
  runAndPrint "Size 10, Sorted, 0% swaps" $
    Array.randNatsWithDominantVal 10 (duplicate_ratio := 0.6) (swaps_ratio := 0)

#eval do
  runAndPrint "Size 20, High Duplicates. 16 duplicates, 4 non-duplicates" $
    Array.randNatsWithDominantVal 20 (duplicate_ratio := 0.8)
