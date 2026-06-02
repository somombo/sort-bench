import Quicksort.Basic
import Quicksort.Partition.BentleyMcIlroy.Basic
import Batteries.Data.BinaryHeap

import SortExperiments.PDQSort

import SortExperiments.Adapt

import SortExperiments.Partitioning.Dutch

import SortExperiments.HeapSort

-- @[noinline]
def timeAx (ax : IO α) : IO (Nat × α)  := do
  let start ← IO.monoNanosNow
  let a ←  ax
  let stop ← IO.monoNanosNow
  let dur := stop - start
  -- IO.eprintln s!"{a[0]?} {dur}"
  return (dur, a)

-- @[specialize]
def timeSort (id funcName : String) (originalArray : Array UInt32) (out : IO.FS.Stream) : IO Unit := do
  match funcName with
  | "Array.qsort" =>
    time_and_print (Array.qsort <$> pure originalArray)
  | "List.mergeSort" =>

    let copy := originalArray.toList
    time_and_print (List.mergeSort <$> pure copy)

  | "Array.mergeSort" =>
    time_and_print (Array.mergeSort <$> pure originalArray)

  | "Array.insertionSort" =>
    time_and_print (Array.insertionSort <$> pure originalArray)

  | "Batteries.Array.heapSort" =>
    time_and_print ((Array.heapSort · (· < ·)) <$> pure originalArray)

  | "Somombo.Vector.insertionSort" =>
    let copy := originalArray.toVector
    time_and_print (Vector.insertionSort <$> pure copy)

  | "Somombo.Vector.heapSort" =>
    let copy := originalArray.toVector

    if h_valid_range : 0 < copy.size - 1 then
      time_and_print ((Vector.heapSort  · (n := copy.size) (h_valid_range :=  h_valid_range) (h_bound := Nat.le.refl)) <$> pure copy)
    else
      throw $ IO.userError s!"Error: Invalid array size {originalArray.size} for target: '{funcName}'"


  | "Somombo.qs.hoare" =>
    time_and_print ((qs · (part := Partition.hoare)) <$> pure originalArray)
  | "Somombo.qs.hoare.eager" =>
    time_and_print ((qs · (part := Partition.hoare.eager)) <$> pure originalArray)
  | "Somombo.qs.hoare.classic" =>
    time_and_print ((qs · (part := Partition.hoare.classic)) <$> pure originalArray)
  | "Somombo.qs.hoare_adapt44" =>
    time_and_print ((qs_adapt · (part := Partition.hoare) (M := 44)) <$> pure originalArray)
  | "Somombo.qs.hoare.classic_adapt44" =>
    time_and_print ((qs_adapt · (part := Partition.hoare.classic) (M := 44)) <$> pure originalArray)




  | "Somombo.qs.dutch" =>
    time_and_print ((qs · (part := Partition.dutch)) <$> pure originalArray)


  | "Somombo.qs.bentleyMcIlroy" =>
    time_and_print ((qs · (part := Partition.bentleyMcIlroy)) <$> pure originalArray)
  | "Somombo.qs.bentleyMcIlroy.classic" =>
    time_and_print ((qs · (part := Partition.bentleyMcIlroy.classic)) <$> pure originalArray)
  | "Somombo.qs.bentleyMcIlroy.eager" =>
    time_and_print ((qs · (part := Partition.bentleyMcIlroy.eager)) <$> pure originalArray)
  | "Somombo.qs.bentleyMcIlroy_adapt44" =>
    time_and_print ((qs_adapt · (part := Partition.bentleyMcIlroy) (M := 44)) <$> pure originalArray)
  | "Somombo.qs.bentleyMcIlroy.classic_adapt44" =>
    time_and_print ((qs_adapt · (part := Partition.bentleyMcIlroy.classic) (M := 44)) <$> pure originalArray)


  | "Somombo.qs.lomuto" =>
    time_and_print ((qs · (part := Partition.lomuto)) <$> pure originalArray)



  | "Somombo.pdqsort" =>
    time_and_print ((pdqsort · (M := 44)) <$> pure originalArray)

  | _ =>
    throw $ IO.userError s!"Error: Unknown function '{funcName}' requested."
where
  -- @[inline]
  time_and_print {α : Type} (ax : IO α) : IO Unit := do
    let ⟨dur_nanoseconds, _⟩ ← timeAx ax
    out.putStrLn s!"{dur_nanoseconds}|{id}"



def parseLine (line : String) : IO (String × Array UInt32) := do
  let line := line.trimAscii.copy.splitOn "|"

  let id::data_str::_ := line | throw $ IO.userError s!"Error: Malformed line."
  let ls := data_str.trimAscii.copy.splitOn ","

  let mut arr := Array.emptyWithCapacity ls.length
  for x in ls do
    let x := x.trimAscii
    if x.isEmpty then continue
    if let some n := x.toNat? then
      arr := arr.push n.toUInt32
    else
      throw $ IO.userError s!"Error: Malformed line. Failed to parse array element: {x}"
  return (id, arr)

/-- info: ("", #[]) -/
#guard_msgs(info) in
#eval parseLine "|"

/-- info: ("a", #[3, 4]) -/
#guard_msgs(info) in
#eval parseLine "a|3,4 "

/-- error: Error: Malformed line. Failed to parse array element: g -/
#guard_msgs(error) in
#eval parseLine "a|g,4 "

def processLines (target : String) : IO UInt32 := do
  let hIn ← IO.getStdin
  let hOut ← IO.getStdout

  let rec proc (line : String) := do
    let (id, originalArray) ← parseLine line
    if !originalArray.isEmpty then
      timeSort id target originalArray hOut
      hOut.flush

  let mut isEOF := false
  repeat do
    if isEOF then break

    let mut lines : Array String := #[]
    for _ in [:1000] do
      let mut line ← hIn.getLine
      if line.length == 0 then
        isEOF := true
        break

      let hasNewline := line.back == '\n'
      if hasNewline then
        line := line.dropEnd 1 |>.copy
        if line.back == '\r' then
          line := line.dropEnd 1 |>.copy

      lines := lines.push line

      if !hasNewline then
        isEOF := true
        break

    for line in lines do
      let _ ← proc line

  return 0

def main (args : List String) : IO UInt32 := do
  match args with
  | [arg] =>
    if arg.isEmpty then
      IO.eprintln "Invalid argument: No functions provided."
      return 1
    processLines arg
  | _ =>
    IO.eprintln "Usage: sorter func1"
    return 1
