package main

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"
)

// SortRoutine defines the signature for sorting algorithms benchmarked by this tool.
type SortRoutine func([]uint32)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintf(os.Stderr, "Error: Usage: %s <function>\n", os.Args[0])
		os.Exit(1)
	}

	targetAlgo := os.Args[1]
	if targetAlgo == "" {
		fmt.Fprintf(os.Stderr, "Error: Empty function name requested.\n")
		os.Exit(1)
	}

	algorithmRegistry := map[string]SortRoutine{
		"slices.Sort": func(v []uint32) {
			slices.Sort(v)
		},
		"sort.SliceStable": func(v []uint32) {
			sort.SliceStable(v, func(i, j int) bool {
				return v[i] < v[j]
			})
		},
		"slices.SortStableFunc": func(v []uint32) {
			slices.SortStableFunc(v, func(a, b uint32) int {
				if a < b {
					return -1
				}
				if a > b {
					return 1
				}
				return 0
			})
		},
	}

	if _, exists := algorithmRegistry[targetAlgo]; !exists {
		fmt.Fprintf(os.Stderr, "Error: Unknown function '%s' requested.\n", targetAlgo)
		os.Exit(1)
	}

	reader := bufio.NewReader(os.Stdin)
	writer := bufio.NewWriter(os.Stdout)

	for {
		var lineBuffer []byte

		for {
			chunk, isPrefix, err := reader.ReadLine()
			if err != nil {
				if err == io.EOF {
					if len(lineBuffer) > 0 {
						benchmarkArray(string(lineBuffer), targetAlgo, algorithmRegistry, writer)
					}
					return
				}
				fmt.Fprintf(os.Stderr, "Error reading from standard input: %v\n", err)
				os.Exit(1)
			}
			lineBuffer = append(lineBuffer, chunk...)

			if !isPrefix {
				break
			}
		}

		benchmarkArray(string(lineBuffer), targetAlgo, algorithmRegistry, writer)
	}
}

// benchmarkArray parses a single pipe-delimited line, executes the requested sorting algorithm,
// and writes the timing results to the provided buffered writer.
func benchmarkArray(line string, targetAlgo string, algorithmRegistry map[string]SortRoutine, writer *bufio.Writer) {
	line = strings.TrimSpace(line)
	if line == "" {
		return
	}

	pipeParts := strings.SplitN(line, "|", 2)
	if len(pipeParts) < 2 {
		fmt.Fprintf(os.Stderr, "Error: Malformed line (missing '|' separator): '%s'\n", line)
		os.Exit(1)
	}

	id := strings.TrimSpace(pipeParts[0])
	if id == "" {
		return
	}

	arrayData := pipeParts[1]
	parts := strings.Split(arrayData, ",")

	var originalArray []uint32
	if len(parts) > 0 {
		originalArray = make([]uint32, 0, len(parts))
		for _, token := range parts {
			token = strings.TrimSpace(token)
			if token == "" {
				continue
			}

			val, err := strconv.ParseUint(token, 10, 32)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error: Invalid numeric token '%s' in line ID '%s'\n", token, id)
				os.Exit(1)
			}
			originalArray = append(originalArray, uint32(val))
		}
	}

	if len(originalArray) == 0 {
		return
	}

	sortRoutine := algorithmRegistry[targetAlgo]

	start := time.Now()
	sortRoutine(originalArray)
	duration := time.Since(start)

	fmt.Fprintf(writer, "%d|%s\n", duration.Nanoseconds(), id)
	writer.Flush()
}
