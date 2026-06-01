import UnifShuffle.Base64encode
import UnifShuffle.GenParams
import UnifShuffle.RandomArray

import Lean.Data.Json
open Lean

def generateUnifData (seed : Option Nat := none) (paramsList : List GenParams) (out : IO.FS.Stream) : IO Unit := do
  if let some s := seed then
    IO.setRandSeed s
  let max_runs := paramsList <&> GenParams.runs |>.max?.getD 1

  for run_index in [0:max_runs] do
    for _':datagen_index in [0:paramsList.length] do
      let ⟨cardinality, multiplicity, swaps, descending, runs⟩ := paramsList[datagen_index]
      if run_index >= runs then
        continue

      let arr ← Array.unifRandNats
        (cardinality := cardinality) (multiplicity := multiplicity)
        (swaps := swaps) (descending := descending)

      if _' : arr.size > 0 then
        let arr : String := arr.extract 1 |>.foldl (s!"{·},{·}") s!"{arr[0]}"
        let data_hash := hash arr

        let fields : List (String × Json) := [
          ("id",   toJson s!"{datagen_index}_{run_index}_{data_hash}"),
          ("cardinality", toJson cardinality),
          ("multiplicity",   toJson multiplicity),
          ("swaps",  toJson swaps),
          ("descending",   toJson descending),
          ("seed",   toJson (toString <$> seed)), -- seed should be a string for filtering purposes in the final dataset
        ]
        let gen_meta := (Json.mkObj fields).compress

        let data_token := s!"meta:{base64.encode gen_meta}"
        out.putStrLn s!"{data_token}|{arr}"
        out.flush
      else
        throw $ IO.userError "Generated array is empty"

section unit_tests
/--
info: meta:eyJjYXJkaW5hbGl0eSI6NywiZGVzY2VuZGluZyI6dHJ1ZSwiaWQiOiIwXzBfNTI1NDM0NzcyMzgyMDE2NDA2NiIsIm11bHRpcGxpY2l0eSI6NSwic2VlZCI6IjYiLCJzd2FwcyI6Mn0=|6,6,6,6,6,5,5,5,5,5,4,4,0,4,4,3,3,3,3,3,2,2,2,2,2,1,1,1,1,1,0,0,4,0,0
meta:eyJjYXJkaW5hbGl0eSI6NSwiZGVzY2VuZGluZyI6ZmFsc2UsImlkIjoiMV8wXzQ1NjI2MjE4OTI2NjEzOTg5MzYiLCJtdWx0aXBsaWNpdHkiOjcsInNlZWQiOiI2Iiwic3dhcHMiOm51bGx9|0,2,1,2,2,2,1,0,2,3,0,3,2,4,1,0,1,4,4,3,4,4,4,0,3,2,3,4,1,1,3,3,0,0,1
meta:eyJjYXJkaW5hbGl0eSI6NywiZGVzY2VuZGluZyI6dHJ1ZSwiaWQiOiIwXzFfNzQ1MzA5MTMwNzg3Mzk4MDkzNiIsIm11bHRpcGxpY2l0eSI6NSwic2VlZCI6IjYiLCJzd2FwcyI6Mn0=|6,6,6,6,6,5,0,5,5,5,4,2,4,4,4,3,3,3,3,3,2,2,2,4,2,1,1,1,1,1,0,0,0,0,5
meta:eyJjYXJkaW5hbGl0eSI6NSwiZGVzY2VuZGluZyI6ZmFsc2UsImlkIjoiMV8xXzEyMDU2MjMxNjI2OTY3MzY3NzkzIiwibXVsdGlwbGljaXR5Ijo3LCJzZWVkIjoiNiIsInN3YXBzIjpudWxsfQ==|2,3,3,1,3,0,0,0,2,3,3,1,1,3,0,1,0,4,4,1,4,4,4,2,2,0,0,2,3,1,1,2,4,4,2
meta:eyJjYXJkaW5hbGl0eSI6NywiZGVzY2VuZGluZyI6dHJ1ZSwiaWQiOiIwXzJfNzU3MjYwMTg1MjQxNTc5MjEwMiIsIm11bHRpcGxpY2l0eSI6NSwic2VlZCI6IjYiLCJzd2FwcyI6Mn0=|6,6,6,6,6,5,5,5,5,5,4,4,4,4,4,3,3,3,3,3,2,2,0,1,2,1,1,1,1,2,0,2,0,0,0
---
info: ok: ()
-/
#guard_msgs(info) in
#eval do generateUnifData (some 6) [⟨7, 5, some 2, true, 3⟩, ⟨5, 7, none, false, 2⟩] (← IO.getStdout) |>.toBaseIO

/--
info: meta:eyJjYXJkaW5hbGl0eSI6NCwiZGVzY2VuZGluZyI6dHJ1ZSwiaWQiOiIwXzBfMjUzMjU0NDk4ODI2ODk3NzA5NSIsIm11bHRpcGxpY2l0eSI6Mywic2VlZCI6IjYiLCJzd2FwcyI6Mn0=|2,3,3,2,3,2,1,1,1,0,0,0
meta:eyJjYXJkaW5hbGl0eSI6NCwiZGVzY2VuZGluZyI6dHJ1ZSwiaWQiOiIwXzFfMTc1MzY2Nzg1MjY0ODIxMzcxNTMiLCJtdWx0aXBsaWNpdHkiOjMsInNlZWQiOiI2Iiwic3dhcHMiOjJ9|3,2,3,2,3,2,1,1,1,0,0,0
meta:eyJjYXJkaW5hbGl0eSI6NCwiZGVzY2VuZGluZyI6dHJ1ZSwiaWQiOiIwXzJfMTMzOTAwODc1OTA2NzU0NzYyOTEiLCJtdWx0aXBsaWNpdHkiOjMsInNlZWQiOiI2Iiwic3dhcHMiOjJ9|3,3,3,2,1,2,1,1,2,0,0,0
---
info: ok: ()
-/
#guard_msgs(info) in
#eval do generateUnifData (some 6) [⟨4, 3, some 2, true, 3⟩] (← IO.getStdout) |>.toBaseIO

end unit_tests

section parseArgs
-- def findArgVal (pref : String) (args : List String) : Option String :=
--   match args with
--   | [] => none
--   | head :: tail =>
--     if head.startsWith pref then
--       some (toString (head.drop pref.length))
--     else
--       findArgVal pref tail

-- public def parseArgsMulti (args : List String) : Except String (Nat × List GenParams) := do
--   let seedStr ← match (findArgVal "--seed=" args) with
--     | some s => Except.ok s
--     | none => Except.error "Missing --seed argument"
--   let seed ← match seedStr.toNat? with
--     | some n => Except.ok n
--     | none => Except.error s!"Invalid seed: {seedStr}"
--   let payloadStr ← match findArgVal "--payload=" args with
--     | some p => Except.ok p
--     | none => Except.error "Missing --payload argument"
--   let json ← Lean.Json.parse payloadStr
--   let params : List GenParams ← Lean.fromJson? json
--   Except.ok (seed, params)

def parseArgsMulti (args : List String) : Except String (List GenParams) := do
  let payloadStr ← match args with
  | [] => .error "Missing <payload> argument"
  | a :: _ => .ok  a
  let json ← Lean.Json.parse payloadStr
  let params : List GenParams ← Lean.fromJson? json
  .ok params


/--
info: Except.error "Missing <payload> argument"
-/
#guard_msgs(info) in
#eval parseArgsMulti []

/--
info: Except.error "offset 0: unexpected input"
-/
#guard_msgs(info) in
#eval parseArgsMulti ["invalid-json"]

/--
info: Except.error "expected JSON array, got '123'"
-/
#guard_msgs(info) in
#eval parseArgsMulti ["123"]

/--
info: Except.error "GenParams.cardinality: Natural number expected"
-/
#guard_msgs(info) in
#eval parseArgsMulti ["[1, 2, 3]"]

/--
info: Except.ok [{ cardinality := 10, multiplicity := 1, swaps := some 2, descending := false, runs := 3 }]
-/
#guard_msgs(info) in
#eval parseArgsMulti ["[{\"cardinality\": 10, \"multiplicity\": 1, \"swaps\": 2, \"descending\": false, \"runs\": 3}]"]

/--
info: Except.ok [{ cardinality := 10, multiplicity := 1, swaps := none, descending := false, runs := 3 }]
-/
#guard_msgs(info) in
#eval parseArgsMulti ["[{\"cardinality\": 10, \"multiplicity\": 1, \"descending\": false, \"runs\": 3}]"]

/--
info: Except.ok [{ cardinality := 10, multiplicity := 1, swaps := none, descending := false, runs := 3 },
 { cardinality := 20, multiplicity := 2, swaps := none, descending := true, runs := 1 }]
-/
#guard_msgs(info) in
#eval parseArgsMulti ["[{\"cardinality\": 10, \"multiplicity\": 1, \"descending\": false, \"runs\": 3}, {\"cardinality\": 20, \"multiplicity\": 2, \"descending\": true, \"runs\": 1}]"]


end parseArgs


def main (args : List String) : IO UInt32 := do
  try
    let seed? ← do
      let some s ← IO.getEnv "IMPALAB_SEED" | pure none
      let some n := s.toNat? | throw $ IO.userError s!"Invalid seed `{s}` is not a `Nat`"
      pure (some n)

    let paramsList ← match parseArgsMulti args with
      | Except.ok params => pure params
      | Except.error err => throw $ IO.userError err

    generateUnifData seed? paramsList (← IO.getStdout)
    return 0
  catch e =>
    IO.eprintln s!"Fatal Error: {e}"
    return 1
