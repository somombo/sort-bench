import Quicksort.Basic
import Quicksort.Partition.Yaroslavskiy.Basic
import Quicksort.Partition.BentleyMcIlroy.Basic
import Quicksort.Partition.Dutch.Basic
import Quicksort.Adapt
import Batteries.Data.BinaryHeap

import SortBench


def parseTarget (arg : String) : Except String String := do
  if arg.isEmpty then
    throw "Invalid argument: No functions provided."

  return arg

def timeAx (ax : IO α) : IO (Nat × α)  := do
  let start ← IO.monoNanosNow
  let a ←  ax
  let stop ← IO.monoNanosNow
  let dur := stop - start
  return (dur, a)


def timeSort (id funcName : String) (originalArray : Array UInt32) (out : IO.FS.Stream) : IO Unit := do
  match funcName with
  | "Array.qsort" =>
    time_and_print (Array.qsort <$> pure originalArray)
  | "List.mergeSort" =>

    let copy := originalArray.toList
    time_and_print (List.mergeSort <$> pure copy)
  | "Array.insertionSort" =>
    time_and_print (Array.insertionSort <$> pure originalArray)
  | "Vector.insertionSort" =>
    let copy := originalArray.toVector
    time_and_print (Vector.insertionSort <$> pure copy)

  | "Batteries.Array.heapSort" =>
    time_and_print ((Array.heapSort · (· < ·)) <$> pure originalArray)


  | "Somombo.qs.hoare" =>
    time_and_print ((qs · (part := Partition.hoare)) <$> pure originalArray)
  | "Somombo.qs.hoare.eager" =>
    time_and_print ((qs · (part := Partition.hoare.eager)) <$> pure originalArray)
  | "Somombo.qs.hoare.classic" =>
    time_and_print ((qs · (part := Partition.hoare.classic sorry sorry)) <$> pure originalArray)
  | "Somombo.qs.hoare_adapt34" =>
    time_and_print ((qs_adapt · (part := Partition.hoare) (M := 34)) <$> pure originalArray)
  | "Somombo.qs.hoare.classic_adapt34" =>
    time_and_print ((qs_adapt · (part := Partition.hoare.classic sorry sorry) (M := 34)) <$> pure originalArray)




  | "Somombo.qs.dutch" =>
    time_and_print ((qs · (part := Partition.dutch)) <$> pure originalArray)


  | "Somombo.qs.bentleyMcIlroy" =>
    time_and_print ((qs · (part := Partition.bentleyMcIlroy)) <$> pure originalArray)
  | "Somombo.qs.bentleyMcIlroy.classic" =>
    time_and_print ((qs · (part := Partition.bentleyMcIlroy.classic sorry sorry)) <$> pure originalArray)
  | "Somombo.qs.bentleyMcIlroy.eager" =>
    time_and_print ((qs · (part := Partition.bentleyMcIlroy.eager)) <$> pure originalArray)
  | "Somombo.qs.bentleyMcIlroy_adapt34" =>
    time_and_print ((qs_adapt · (part := Partition.bentleyMcIlroy) (M := 34)) <$> pure originalArray)
  | "Somombo.qs.bentleyMcIlroy.classic_adapt34" =>
    time_and_print ((qs_adapt · (part := Partition.bentleyMcIlroy.classic sorry sorry) (M := 34)) <$> pure originalArray)


  | "Somombo.qs.lomuto" =>
    time_and_print ((qs · (part := Partition.lomuto)) <$> pure originalArray)




  | _ =>
    throw $ IO.userError s!"Error: Unknown function '{funcName}' requested."
where
  time_and_print {α : Type} (ax : IO α) : IO Unit := do
    let ⟨dur_nanoseconds, _⟩ ← timeAx ax
    out.putStrLn s!"{dur_nanoseconds}|{id}"



def parseLine (line : String) : IO (String × Array UInt32) := do
  let line := line.trim.splitOn "|"

  let id::data_str::_ := line | throw $ IO.userError s!"Error: Malformed line."
  let ls := data_str.trim.splitOn ","

  let mut arr := Array.emptyWithCapacity ls.length
  for x in ls do
    let x := x.trim
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
        line := line.dropRight 1
        if line.back == '\r' then
          line := line.dropRight 1

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
    match parseTarget arg with
    | .ok target =>
      processLines target
    | .error msg =>
      IO.eprintln msg
      return 1
  | _ =>
    IO.eprintln "Usage: sorter func1"
    return 1
