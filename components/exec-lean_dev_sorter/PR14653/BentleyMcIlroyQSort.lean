import Impalab
import Upstream.BentleyMcIlroyQSort.Basic

def main (args : List String) : IO UInt32 := do
  processLines (args.contains "--validate") (IO.timeFn qsort_bentleyMcIlroy)
