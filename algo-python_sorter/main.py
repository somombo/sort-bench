import sys
import time
import heapq

def main():
    """Reads benchmark data from standard input, times the execution of internal sorting functions, and outputs performance metrics to standard output."""
    if len(sys.argv) != 2 or not sys.argv[1].startswith("--functions="):
        sys.stderr.write("Error: Must specify exactly one argument in the format --functions=func1,func2\n")
        sys.exit(1)

    functions_arg = sys.argv[1][12:]
    if not functions_arg:
        sys.stderr.write("Error: No functions specified.\n")
        sys.exit(1)

    funcs = [f for f in functions_arg.split(",") if f]
    for f in funcs:
        if f not in ("list.sort", "sorted", "heapq.nsmallest"):
            sys.stderr.write(f"Error: Unrecognized function {f}\n")
            sys.exit(1)

    stdin = sys.stdin
    stdout = sys.stdout

    for line in stdin:
        line = line.strip()
        if not line:
            continue
        
        parts = line.split(',')
        if len(parts) < 1:
            sys.stderr.write("Error: Invalid line format.\n")
            sys.exit(1)

        id_str = parts[0]
        master_arr = []
        
        try:
            for x in parts[1:]:
                if x:
                    val = int(x)
                    if val < 0 or val > 4294967295:
                        raise ValueError()
                    master_arr.append(val)
        except ValueError:
            sys.stderr.write("Error: Invalid uint32 token.\n")
            sys.exit(1)

        for func in funcs:
            copy_arr = master_arr.copy()
            
            if func == "list.sort":
                t0 = time.perf_counter_ns()
                copy_arr.sort()
                t1 = time.perf_counter_ns()
            elif func == "sorted":
                t0 = time.perf_counter_ns()
                _ = sorted(copy_arr)
                t1 = time.perf_counter_ns()
            elif func == "heapq.nsmallest":
                t0 = time.perf_counter_ns()
                _ = heapq.nsmallest(len(copy_arr), copy_arr)
                t1 = time.perf_counter_ns()
            
            dur = t1 - t0
            stdout.write(f"{id_str},{func},{dur}\n")
            stdout.flush()

if __name__ == "__main__":
    main()