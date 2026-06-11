import RandomArray
import Cli



def generateUnifData (cardinality : Nat) (multiplicity : Nat)
    (swaps : Option Nat := none) (descending := false)
    (runs : Nat := 1) (seed : Option Nat := none) : IO Unit := do
  let out ← IO.getStdout
  if let some s := seed then
    IO.setRandSeed s

  for run in [0:runs] do
    let arr ← Array.unifRandNats
      (cardinality := cardinality) (multiplicity := multiplicity)
      (swaps := swaps) (descending := descending)


    if _' : arr.size > 0 then
      let arr : String := arr.extract 1 |>.foldl (s!"{·},{·}") s!"{arr[0]}"
      let id := hash arr
      out.putStrLn s!"{run+1}_{id},{arr}"
      out.flush

/-- info: 1_2462006083735398306,2,2,0,2,2,0,1,0,0,0,1,1,0,1,0,1,1,2,2,2,1,1,2,2,1,1,2,0,0,0 -/
#guard_msgs(info) in
#eval generateUnifData 3 10 (seed := some 42)
open Cli


def main (args : List String) : IO UInt32 := Cmd.validate (args:=args)
$ (fun run => `[Cli|
  data_generator VIA run;
  "The data_generator command generates the arrays to be tested \
  \n\nUsage: data_generator  --cardinality=<cardinality> --multiplicity=<multiplicity>  \
  [--swaps=<swaps>] [--descending] [--runs=<runs>] [--seed=<seed>]
  "

  FLAGS:
    "cardinality" : Nat; ""
    "multiplicity" : Nat; ""
    "swaps" : Nat; ""
    "descending"; ""
    "seed" : Nat; ""
    "runs" : Nat; ""

])
$ (fun p => do

  let runs := match p.flag? "runs" with | some f => f.as! Nat | none => 1
  let cardinality := match p.flag? "cardinality" with | some f => f.as! Nat | none => 1
  let multiplicity := p.flag! "multiplicity" |>.as! Nat
  let seed := p.flag? "seed" |>.map (·.as! Nat)
  let swaps := p.flag? "swaps" |>.map (·.as! Nat)

  let descending :=
    match (p.flag? "descending") with
    | some _ => true
    | none => false

  generateUnifData (cardinality := cardinality) (multiplicity := multiplicity)
    (swaps := swaps) (descending := descending) (runs := runs) (seed := seed)
  return 0

)



/-- info: 1_2532544988268977095,2,3,3,2,3,2,1,1,1,0,0,0
2_17536678526482137153,3,2,3,2,3,2,1,1,1,0,0,0
3_13390087590675476291,3,3,3,2,1,2,1,1,2,0,0,0
4_6194845278013640722,3,3,3,2,2,2,1,1,0,1,0,0
5_5967368678831171111,3,2,3,0,3,2,1,1,1,0,0,2
---
info: 0
-/
#guard_msgs(info) in
#eval main ["--seed=6", "--runs=5", "--cardinality=4", "--multiplicity=3", "--swaps=2", "--descending"]
