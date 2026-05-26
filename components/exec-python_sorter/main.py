import sys
import time
import heapq

def main():
    """Reads benchmark data from standard input, times the execution of internal sorting functions, and outputs performance metrics to standard output."""
    if len(sys.argv) != 2:
        sys.stderr.write("Usage: python main.py <function>\n")
        sys.exit(1)

    func = sys.argv[1]
    if not func:
        sys.stderr.write("Error: Empty function name requested.\n")
        sys.exit(1)

    if func not in ("list.sort", "sorted", "heapq.nsmallest"):
        sys.stderr.write(f"Error: Unrecognized function {func}\n")
        sys.exit(1)

    stdin = sys.stdin
    stdout = sys.stdout

    for line in stdin:
        line = line.strip()
        if not line:
            continue
        
        pipe_parts = line.split('|', 1)
        if len(pipe_parts) < 2:
            sys.stderr.write("Error: Invalid line format. Expected pipe character.\n")
            sys.exit(1)

        id_str = pipe_parts[0]
        parts = pipe_parts[1].split(',')
        master_arr = []
        
        try:
            for x in parts:
                if x:
                    val = int(x)
                    if val < 0 or val > 4294967295:
                        raise ValueError()
                    master_arr.append(val)
        except ValueError:
            sys.stderr.write("Error: Invalid uint32 token.\n")
            sys.exit(1)

        if func == "list.sort":
            t0 = time.perf_counter_ns()
            master_arr.sort()
            t1 = time.perf_counter_ns()
        elif func == "sorted":
            t0 = time.perf_counter_ns()
            _ = sorted(master_arr)
            t1 = time.perf_counter_ns()
        elif func == "heapq.nsmallest":
            t0 = time.perf_counter_ns()
            _ = heapq.nsmallest(len(master_arr), master_arr)
            t1 = time.perf_counter_ns()
        
        dur = t1 - t0
        stdout.write(f"{dur}|{id_str}\n")
        stdout.flush()

if __name__ == "__main__":
    main()