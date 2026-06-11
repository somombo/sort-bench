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

// parseAlgorithms extracts a list of algorithm names from the command-line argument.
// It expects the argument to be in the format "--functions=func1,func2".
func parseAlgorithms(cliArg string) []string {
	const prefix = "--functions="
	if !strings.HasPrefix(cliArg, prefix) {
		fmt.Fprintf(os.Stderr, "Error: Invalid argument format. Expected %s...\n", prefix)
		os.Exit(1)
	}

	csvList := strings.TrimPrefix(cliArg, prefix)
	if csvList == "" {
		fmt.Fprintf(os.Stderr, "Error: No functions provided in argument.\n")
		os.Exit(1)
	}

	var algorithms []string
	for _, algoName := range strings.Split(csvList, ",") {
		algoName = strings.TrimSpace(algoName)
		if algoName != "" {
			algorithms = append(algorithms, algoName)
		}
	}

	if len(algorithms) == 0 {
		fmt.Fprintf(os.Stderr, "Error: No valid functions extracted from argument.\n")
		os.Exit(1)
	}

	return algorithms
}

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintf(os.Stderr, "Error: Usage: %s --functions=func1,func2\n", os.Args[0])
		os.Exit(1)
	}

	targetAlgorithms := parseAlgorithms(os.Args[1])

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

	for _, algoName := range targetAlgorithms {
		if _, exists := algorithmRegistry[algoName]; !exists {
			fmt.Fprintf(os.Stderr, "Error: Unknown function '%s' requested.\n", algoName)
			os.Exit(1)
		}
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
						benchmarkArray(string(lineBuffer), targetAlgorithms, algorithmRegistry, writer)
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

		benchmarkArray(string(lineBuffer), targetAlgorithms, algorithmRegistry, writer)
	}
}

// benchmarkArray parses a single CSV line, executes the requested sorting algorithms,
// and writes the timing results to the provided buffered writer.
func benchmarkArray(line string, targetAlgorithms []string, algorithmRegistry map[string]SortRoutine, writer *bufio.Writer) {
	line = strings.TrimSpace(line)
	if line == "" {
		return
	}

	parts := strings.Split(line, ",")
	if len(parts) == 0 {
		return
	}

	id := strings.TrimSpace(parts[0])
	if id == "" {
		return
	}

	var originalArray []uint32

	if len(parts) > 1 {
		originalArray = make([]uint32, 0, len(parts)-1)
		for _, token := range parts[1:] {
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

	for _, algoName := range targetAlgorithms {
		sortRoutine := algorithmRegistry[algoName]

		arrayCopy := make([]uint32, len(originalArray))
		copy(arrayCopy, originalArray)

		start := time.Now()
		sortRoutine(arrayCopy)
		duration := time.Since(start)

		fmt.Fprintf(writer, "%s,%s,%d\n", id, algoName, duration.Nanoseconds())
		writer.Flush()
	}
}
