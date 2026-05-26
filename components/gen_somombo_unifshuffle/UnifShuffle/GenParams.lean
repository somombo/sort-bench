module
public import Lean.Data.Json

public structure GenParams where
  cardinality: Nat
  multiplicity: Nat
  swaps: Option Nat
  descending: Bool
  runs: Nat
deriving Lean.FromJson, Lean.ToJson, Repr
