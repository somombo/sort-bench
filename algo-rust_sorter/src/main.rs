use std::env;
use std::io::{self, BufRead, Write};
use std::time::Instant;

/// Defines the signature for sorting algorithms benchmarked by this tool.
type SortRoutine = fn(&mut [u32]);

/// Extracts a list of algorithm names from the command-line argument.
/// Terminates the program if the format is invalid or missing.
fn parse_algorithms(cli_arg: &str) -> Vec<String> {
    const PREFIX: &str = "--functions=";
    if !cli_arg.starts_with(PREFIX) {
        eprintln!("Error: Invalid argument format. Expected {}...", PREFIX);
        std::process::exit(1);
    }

    let csv_list = &cli_arg[PREFIX.len()..];
    if csv_list.is_empty() {
        eprintln!("Error: No functions provided in argument.");
        std::process::exit(1);
    }

    let mut algorithms = Vec::new();
    for algo_name in csv_list.split(',') {
        let trimmed = algo_name.trim();
        if !trimmed.is_empty() {
            algorithms.push(trimmed.to_string());
        }
    }

    if algorithms.is_empty() {
        eprintln!("Error: No valid functions extracted from argument.");
        std::process::exit(1);
    }

    algorithms
}

/// Resolves a string algorithm name to its corresponding function pointer.
/// Terminates the program if an unknown algorithm is requested.
fn resolve_algorithm(name: &str) -> SortRoutine {
    match name {
        "slice::sort" => |arr| arr.sort(),
        "slice::sort_unstable" => |arr| arr.sort_unstable(),
        _ => {
            eprintln!("Error: Unknown function '{}' requested.", name);
            std::process::exit(1);
        }
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() != 2 {
        eprintln!("Error: Usage: {} --functions=func1,func2", args[0]);
        std::process::exit(1);
    }

    let target_algorithms_names = parse_algorithms(&args[1]);

    let mut target_algorithms: Vec<(&String, SortRoutine)> = Vec::new();
    for name in &target_algorithms_names {
        target_algorithms.push((name, resolve_algorithm(name)));
    }

    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let handle = stdin.lock();

    for line_result in handle.lines() {
        let line = match line_result {
            Ok(l) => l,
            Err(e) => {
                eprintln!("Error reading from standard input: {}", e);
                std::process::exit(1);
            }
        };

        let trimmed_line = line.trim();
        if trimmed_line.is_empty() {
            continue;
        }

        let mut parts = trimmed_line.split(',');

        let id_part = parts.next();
        if id_part.is_none() {
            eprintln!("Error: Malformed line. Missing ID.");
            std::process::exit(1);
        }

        let id = id_part.unwrap().trim();
        if id.is_empty() {
            eprintln!("Error: Malformed line. Empty ID.");
            std::process::exit(1);
        }

        let mut original_array: Vec<u32> = Vec::new();
        for token in parts {
            let token = token.trim();
            if token.is_empty() {
                continue;
            }
            match token.parse::<u32>() {
                Ok(val) => original_array.push(val),
                Err(_) => {
                    eprintln!(
                        "Error: Invalid numeric token '{}' in line ID '{}'",
                        token, id
                    );
                    std::process::exit(1);
                }
            }
        }

        if original_array.is_empty() {
            eprintln!(
                "Error: Malformed line. No numeric data found for ID '{}'",
                id
            );
            std::process::exit(1);
        }

        for (algo_name, sort_routine) in &target_algorithms {
            let mut array_copy = original_array.clone();

            let start = Instant::now();
            sort_routine(&mut array_copy);
            let duration = start.elapsed();

            writeln!(stdout, "{},{},{}", id, algo_name, duration.as_nanos()).unwrap();
            stdout.flush().unwrap();
        }
    }
}
