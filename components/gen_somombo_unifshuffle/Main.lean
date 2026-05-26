import UnifShuffle.RandomArray
import UnifShuffle.GenParams

import Cli

def generateUnifData (params: GenParams) (reps : Nat := 1) (seed : Option Nat := none) : IO Unit := do
  let ⟨cardinality, multiplicity, swaps, descending, runs⟩ := params
  let out ← IO.getStdout
  if let some s := seed then
    IO.setRandSeed s

  for run_index in [0:runs] do
    let arr ← Array.unifRandNats
      (cardinality := cardinality) (multiplicity := multiplicity)
      (swaps := swaps) (descending := descending)

    if _' : arr.size > 0 then
      let arr : String := arr.extract 1 |>.foldl (s!"{·},{·}") s!"{arr[0]}"
      let data_hash := hash arr
      for rep_index in [0:reps] do
        out.putStrLn s!"{rep_index}_{run_index}_{data_hash}|{arr}"
        out.flush
    else
      throw $ IO.userError "Error:Generated array is empty"

/-- info: 0_0_11546041020033230969|2,1,0,0,2,2,1,1,1,2,0,0
1_0_11546041020033230969|2,1,0,0,2,2,1,1,1,2,0,0
2_0_11546041020033230969|2,1,0,0,2,2,1,1,1,2,0,0
3_0_11546041020033230969|2,1,0,0,2,2,1,1,1,2,0,0
4_0_11546041020033230969|2,1,0,0,2,2,1,1,1,2,0,0
5_0_11546041020033230969|2,1,0,0,2,2,1,1,1,2,0,0
0_1_15662867278514177437|0,1,1,0,2,0,1,1,2,2,2,0
1_1_15662867278514177437|0,1,1,0,2,0,1,1,2,2,2,0
2_1_15662867278514177437|0,1,1,0,2,0,1,1,2,2,2,0
3_1_15662867278514177437|0,1,1,0,2,0,1,1,2,2,2,0
4_1_15662867278514177437|0,1,1,0,2,0,1,1,2,2,2,0
5_1_15662867278514177437|0,1,1,0,2,0,1,1,2,2,2,0 -/
#guard_msgs(info) in
#eval generateUnifData (seed := some 5) (reps := 6) ⟨3, 4, none, false, 2⟩

open Cli


def main (args : List String) : IO UInt32 := Cmd.validate (args:=args)
$ (fun run => `[Cli|
  data_generator VIA run;
  "The data_generator command generates the arrays to be tested \
  \n\nUsage: data_generator  --cardinality=<cardinality> --multiplicity=<multiplicity>  \
  [--swaps=<swaps>] [--descending] [--runs=<runs>] [--reps=<reps>] [--seed=<seed>]
  "

  FLAGS:
    "cardinality" : Nat; ""
    "multiplicity" : Nat; ""
    "swaps" : Nat; ""
    "descending"; ""
    "seed" : Nat; ""
    "runs" : Nat; ""
    "reps" : Nat; ""

])
$ (fun p => do

  let runs := match p.flag? "runs" with | some f => f.as! Nat | none => 1
  let reps := match p.flag? "reps" with | some f => f.as! Nat | none => 1
  let cardinality := match p.flag? "cardinality" with | some f => f.as! Nat | none => 1
  let multiplicity := p.flag! "multiplicity" |>.as! Nat
  let seed := p.flag? "seed" |>.map (·.as! Nat)
  let swaps := p.flag? "swaps" |>.map (·.as! Nat)

  let descending :=
    match (p.flag? "descending") with
    | some _ => true
    | none => false

  generateUnifData ⟨cardinality, multiplicity, swaps, descending, runs⟩ (reps := reps) (seed := seed)
  return 0

)



/-- info: 0_0_2532544988268977095|2,3,3,2,3,2,1,1,1,0,0,0
1_0_2532544988268977095|2,3,3,2,3,2,1,1,1,0,0,0
0_1_17536678526482137153|3,2,3,2,3,2,1,1,1,0,0,0
1_1_17536678526482137153|3,2,3,2,3,2,1,1,1,0,0,0
0_2_13390087590675476291|3,3,3,2,1,2,1,1,2,0,0,0
1_2_13390087590675476291|3,3,3,2,1,2,1,1,2,0,0,0
0_3_6194845278013640722|3,3,3,2,2,2,1,1,0,1,0,0
1_3_6194845278013640722|3,3,3,2,2,2,1,1,0,1,0,0
0_4_5967368678831171111|3,2,3,0,3,2,1,1,1,0,0,2
1_4_5967368678831171111|3,2,3,0,3,2,1,1,1,0,0,2
---
info: 0
-/
#guard_msgs(info) in
#eval main ["--seed=6", "--runs=5", "--reps=2", "--cardinality=4", "--multiplicity=3", "--swaps=2", "--descending"]




-----------------------------------------------------------------




-- import RandomArray
-- import Cli

-- def main (args : List String) : IO UInt32 := do
--   -- let mut params : List (Nat × Nat × Nat × Option Nat × Bool × Option Nat × Nat × Nat) := []
--   let argss := args.splitOn "--"
--   let out ← IO.getStdout
--   for _' : args_index in [0:argss.length] do
--     let ret_code ← Cli.Cmd.validate (args:=argss[args_index])
--       <| (fun run => `[Cli|
--         data_generator VIA run;
--         ""

--         FLAGS:
--           "cardinality" : Nat; ""
--           "multiplicity" : Nat; ""
--           "datagenindex" : Nat; ""
--           "swaps" : Nat; ""
--           "descending"; ""
--           "seed" : Nat; ""
--           "runs" : Nat; ""
--           "reps" : Nat; ""

--       ])
--       <| (fun p => do

--         -- let runs := match p.flag? "runs" with | some f => f.as! Nat | none => 1
--         let datagenindex := p.flag! "datagenindex" |>.as! Nat
--         let cardinality := match p.flag? "cardinality" with | some f => f.as! Nat | none => 1
--         let multiplicity := p.flag! "multiplicity" |>.as! Nat
--         let swaps := p.flag? "swaps" |>.map (·.as! Nat)

--         let descending :=
--           match (p.flag? "descending") with
--           | some _ => true
--           | none => false

--         let seed := p.flag? "seed" |>.map (·.as! Nat)
--         let reps := match p.flag? "reps" with | some f => f.as! Nat | none => 1
--         let runs := match p.flag? "runs" with | some f => f.as! Nat | none => 1

--         -- params := params.cons (datagenindex, cardinality, multiplicity, swaps, descending, seed, reps, runs)
--         for _rep in [0:reps] do
--           if let some s := seed then
--             IO.setRandSeed s

--           for run in [0:runs] do
--             let arr ← Array.unifRandNats
--               (cardinality := cardinality) (multiplicity := multiplicity)
--               (swaps := swaps) (descending := descending)

--             if _' : arr.size > 0 then
--               let arr : String := arr.extract 1 |>.foldl (s!"{·},{·}") s!"{arr[0]}"
--               let id := hash arr
--               out.putStrLn s!"{datagenindex}_{args_index}_{id},{arr}"
--               out.flush
--             else
--               throw $ IO.userError "Error:Generated array is empty"

--         return 0
--       )
--     if ret_code != 0 then
--       return ret_code

--   return 0




-- ----------------------------------------



-- import RandomArray
-- import ParseArgs

-- def main (args : List String) : IO UInt32 := do
--   match parseArgsMulti args with
--   | Except.ok paramsList =>
--     let out ← IO.getStdout
--     -- let mut global_seed := none
--     -- let mut global_reps := 1
--     -- let mut global_runs := 1

--     let ⟨_, _, _, _, _, global_seed, global_reps, global_runs⟩ := paramsList[0]!

--     let mut rep := 0
--     while rep < global_reps do
--       if let some s := global_seed then
--         IO.setRandSeed s

--       let mut run := 0
--       while run < global_runs do
--         for ⟨datagenindex, cardinality, multiplicity, swaps, descending, seed, reps, runs⟩ in paramsList do
--           -- if let some s := seed then
--           --   global_seed := s

--           -- global_reps := reps
--           -- global_runs := runs
--           let arr ← Array.unifRandNats
--             (cardinality := cardinality) (multiplicity := multiplicity)
--             (swaps := swaps) (descending := descending)

--           if _' : arr.size > 0 then
--             let arr : String := arr.extract 1 |>.foldl (s!"{·},{·}") s!"{arr[0]}"
--             let id := hash arr
--             -- out.putStrLn s!"{rep}_{run}_{id}:{datagenindex},{arr}"
--             out.putStrLn s!"{datagenindex}_{run}_{id},{arr}"
--             out.flush
--           else
--             throw $ IO.userError "Error:Generated array is empty"
--         run := run + 1
--       rep := rep + 1
--     return 0
--   | Except.error err =>
--     IO.eprintln s!"Error: {err}"
--     return 1



----------------------------------------
