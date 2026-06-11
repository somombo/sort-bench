import Std.Data
open Std
-- def dbg {α : Type u} [ToString α]  (a : α) (s : String) : α :=
--   dbgTrace s!"{s}" (fun _ => a)


-- /- Algorithm P Fisher-Yates Sampling-/
-- def Array.sample' {α : Type} (arr : Array α) (sample_size : Nat) :
--     IO (Array α) := do
--   if sample_size > arr.size then
--     throw $ IO.userError s!"Error: sample size ({sample_size}) cannot \
--     be greater than size of array ({arr.size}) that is being sampled from"

--   let mut arr := arr

--   for i in [:sample_size] do
--     let j ← IO.rand i (arr.size - 1)
--     arr := arr.swapIfInBounds i j

--   return arr[:sample_size]

/-- Partial Fisher-Yates at provided indices -/
def Array.shuffle (arr : Array α) (indices : HashSet Nat := Array.range (arr.size - 1) |> HashSet.ofArray) :
    IO (Array α) := do
  if arr.size < 2 then return arr
  if indices.isEmpty then return arr
  let mut arr := arr

  for i in [:arr.size - 1] do
    if i ∈ indices then
      let j ← IO.rand i (arr.size - 1)
      arr := arr.swapIfInBounds i j

  return arr

/-- Algorithm S Resevior Sampling-/
def Array.sample {α : Type} (arr : Array α) (sample_size : Nat) :
    IO (Array α) := do
  if sample_size > arr.size then
    throw $ IO.userError s!"Error: sample size ({sample_size}) cannot \
    be greater than size of array ({arr.size}) that is being sampled from"
  if sample_size = 0 then return #[]
  if sample_size = arr.size then return arr

  let mut k := sample_size
  let mut result := Array.emptyWithCapacity k
  let mut n := arr.size

  for item in arr do
    if k = 0 then break
    let r ← IO.rand 1 n

    if r ≤ k then
      result := result.push item
      k := k - 1
    n := n - 1
  return result


/--
Performs up to `swaps` Fisher–Yates style swaps at selected indices of `arr`,
then returns `sample_size` elements using Algorithm S (reservoir sampling).

- `arr` : source array.
- `sample_size` : number of elements to return (default `arr.size`).
- `swaps` : max number of swaps performed in the shuffle
  (default `sample_size - 1`, clamped to `arr.size - 1`).

Returns an `IO (Array α)` containing the sampled elements.
-/
def Array.partialShuffleSample  {α : Type} (arr : Array α) (sample_size : Nat := arr.size)
    (swaps : Nat := sample_size - 1)  : IO (Array α) := do
  let swaps := min swaps (arr.size - 1)

  let mut idxs := Array.range (arr.size - 1)
  if swaps < sample_size - 1 then
    idxs ← idxs |>.sample swaps

  let arr ← arr.shuffle $ idxs |> HashSet.ofArray
  arr.sample sample_size










-- /--
-- Produces a sample of `size` elements from an array.

-- This is achieved by partially shuffling the input array using a variant of the
-- Fisher-Yates algorithm and then taking the first `size` elements. This process
-- guarantees that the result is a subset of the original array's elements. The
-- swaps for the shuffle are determined by the `indices` parameter which can allow
-- for control .

-- - `arr`: The array to sample elements from.
-- - `size`: The number of elements to sample, which determines the size of the resulting array.
--   Defaults to `arr.size`.
-- - `indices`: The indices at which to perform the swaps. Defaults to `0, ..., size - 2`.
-- -/
-- def Array.sampleWithIndices {α : Type} [ToString α] (arr : Array α) (size : Nat := arr.size) (indices := Array.range (size - 1)) : IO (Array α) := do
--   if size > arr.size then
--     throw $ IO.userError s!"sample size ({size}) cannot be greater than size of array ({arr.size}) that's being sampled from"

--   if size = 0 then return #[]

--   let mut arr := arr
--   if indices.size > 0 then

--     let indices := indices[:min indices.size (size - 1)]
--     let mut g ← IO.stdGenRef.get
--     for i in indices do
--       let (j, g') := randNat g i (arr.size - 1); g := g'

--       -- if indices.size < size - 1 then println! s!"swaps# {indices.size}, i: {i}, j: {j}"
--       arr := dbg arr s!"{arr}\nswaps# {indices.size}, i: {i}, j: {j}"
--       arr := arr.swapIfInBounds i j
--     IO.stdGenRef.set g

--   if size = arr.size then
--     return arr
--   else
--     return arr[:size]

-- /--
-- Produces a random sample of `size` element from the input array.

-- The degree of shuffling is controlled by the `swaps` parameter. It determines how many
-- random swaps are performed on the initial elements of the array. If `swaps` is at least
-- `size - 1`, a full shuffle is performed on the first `size` elements. Otherwise, a partial
-- shuffle is done by randomly selecting `swaps` positions to initiate a swap from.

-- - `arr`: The array to sample from.
-- - `size`: The size of the resulting array. Defaults to `arr.size`.
-- - `swaps`: The number of swaps to perform. Defaults to `size - 1`.
-- -/
-- def Array.sample {α : Type} [ToString α] (arr : Array α) (size := arr.size) (swaps := size - 1) : IO (Array α) := do
--   if size > arr.size then
--     throw $ IO.userError s!"sample size ({size}) cannot be greater than size of array ({arr.size}) that's being sampled from"

--   if size = 0 then return #[]
--   if swaps = 0 then return if size = arr.size then arr else arr[:size]

--   let idxs := range (size - 1)
--   if swaps < size - 1 then
--     arr.sampleWithIndices size $ ←idxs.sample (size:=swaps)
--   else
--     arr.sampleWithIndices size $ idxs

-- #eval Array.range 9 -- |>.sample  (size :=1) (swaps := 11)
-- #eval Array.range 9 |>.sample  (size :=1) (swaps := 11)
-- #eval do
--   -- let idxs := Array.range 9
--   -- let ii ←idxs.sample (size:=1)
--   (Array.range 10
--   |>.sampleWithIndices 10 ·) $ ←(Array.range 9).sample  (size:=1)
-- #eval "---------TEST Array.sample ------"
-- #eval Array.range 10 |>.sample (swaps := 1)
-- #eval Array.range 10 |>.sample (swaps := 1)
-- #eval Array.range 10 |>.sample (swaps := 1)
-- #eval Array.range 10 |>.sample (swaps := 1)
-- #eval Array.range 10 |>.sample (swaps := 1)
-- #eval Array.range 10 |>.sample (swaps := 1)
-- #eval Array.range 10 |>.sample (swaps := 1)
-- #eval Array.range 10 |>.sample (swaps := 1)
-- #eval Array.range 10 |>.sample (swaps := 1)
-- #eval Array.range 10 |>.sample (swaps := 1)


-- #eval "---------END Array.sample ------"

-- #eval do Array.range 5 |>.sample (swaps := 2)
-- #eval Array.replicate 10 1 |>.toPopulation |>.sample 5 (swaps := 2)
