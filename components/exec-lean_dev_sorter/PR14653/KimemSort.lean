import Impalab
import Upstream.KimemSort

def main (args : List String) : IO UInt32 := do
  processLines (args.contains "--validate") (IO.timeFn Array.qsort_three_way)
