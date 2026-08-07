module
public import Std.Time.Duration
public import TimeIt.Basic

/-- checks if array non-decreasing? -/
def sortedOk (a : Array UInt32) : Bool := Id.run do
  for i in [1:a.size] do
    if a[i]! < a[i-1]! then return false
  return true

public abbrev TimedFn α β := α → IO (Std.Time.Duration × β)



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

public def processLines (validate : Bool) (timeTarget : TimedFn (Array UInt32) (Array UInt32)): IO UInt32 := do
  let hIn ← IO.getStdin
  let hOut ← IO.getStdout

  let rec proc (line : String) := do
    let (id, originalArray) ← parseLine line
    if originalArray.isEmpty then return

    let (dur, arr) ← timeTarget originalArray

    if validate && !sortedOk arr then
      throw $ IO.userError s!"Error: Result not sorted for data_id '{id}'."

    hOut.putStrLn s!"{dur.toNanoseconds.toInt}|{id}"
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
