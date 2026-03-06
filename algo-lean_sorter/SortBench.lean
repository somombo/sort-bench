import Quicksort.Partition.BentleyMcIlroy.Basic


def Partition.bentleyMcIlroy [Ord α] (arr : Vector α n) (left : Nat)  (right : Nat) (hlr : left < right) (hr : right < n) : {x : Partition α n // (left < x.i') ∧ (x.j' < right)} :=
  have hl : left < n := by omega

  let mid := left + ((right - left)/2)
  have hm : mid < n := by omega
  let arr_ := arr
    |> (Vector.maybeSwap · ⟨left, hl⟩ ⟨mid, hm⟩)
    |> (Vector.maybeSwap · ⟨left, hl⟩ ⟨right, hr⟩)
    |> (Vector.maybeSwap · ⟨mid, hm⟩ ⟨right, hr⟩)

  let pivot := arr_[mid]

  if hmo3sortd : ¬lt pivot arr_[left] ∧ ¬lt arr_[right] pivot then
    have _ : right - 1 + 1 = right := by omega
    bentleyMcIlroy.classic.loop left right hlr hr pivot arr_ (left + 1) (right - 1) (left + 1) (right - 1)
      (by omega) (by omega) (by omega) (by omega) (by omega) (by omega) (by grind) (by grind)
  else
    have := bentleyMcIlroy.eager.loop left right hlr hr pivot arr_ (left + 1) (right - 1) (left + 1) (right - 1)
      (by omega) (by omega) (by omega) (by omega) (by omega) (by omega)
    |> (Inhabited.mk ·)
    panic! "non-asymmetric or non-transitive comparitor. falling back to eager version of hoare partition scheme"



@[inline]
def Vector.insertionSort [Ord α] {n : Nat} (xs : Vector α n) -- (lt : α → α → Bool := by exact (· < ·))
    (left := 0) (right := n - 1) (hr : right ≤ n - 1 := by omega) : Vector α n :=
  traverse xs (left + 1)
where
  @[specialize]
  traverse (xs : Vector α n) (i : Nat)  : Vector α n :=
    if h : i ≤ right then
      traverse (swapLoop xs i (by omega)) (i+1)
    else
      xs
    termination_by right + 1 - i

  @[specialize]
  swapLoop (xs : Vector α n) (j : Nat) (h : j ≤ n - 1) :  Vector α n :=
    if _ : left < j then
      let j' := j - 1
      if lt xs[j] xs[j'] then
        swapLoop (xs.swap j j') j' (by omega)
      else
        xs
    else
      xs
