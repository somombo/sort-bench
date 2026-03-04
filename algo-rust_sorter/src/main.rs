use std::env;
use std::io::{self, BufRead, BufWriter, Write};
use std::time::Instant;

type SortRoutine = fn(&mut [u32]);

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

    let algorithms: Vec<String> = csv_list
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .collect();

    if algorithms.is_empty() {
        eprintln!("Error: No valid functions extracted from argument.");
        std::process::exit(1);
    }

    algorithms
}

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

    let target_algorithms: Vec<(&String, SortRoutine)> = target_algorithms_names
        .iter()
        .map(|name| (name, resolve_algorithm(name)))
        .collect();

    let stdin = io::stdin();
    let mut handle = stdin.lock();
    
    let stdout = io::stdout();
    let mut writer = BufWriter::new(stdout.lock());

    let mut line_buffer = String::new();
    let mut original_array: Vec<u32> = Vec::new();

    loop {
        line_buffer.clear();
        match handle.read_line(&mut line_buffer) {
            Ok(0) => break,
            Ok(_) => {}
            Err(e) => {
                eprintln!("Error reading from standard input: {}", e);
                std::process::exit(1);
            }
        }

        let trimmed_line = line_buffer.trim();
        if trimmed_line.is_empty() {
            continue;
        }

        let mut parts = trimmed_line.split(',');

        let id = parts.next().unwrap_or("").trim();
        if id.is_empty() {
            eprintln!("Error: Malformed line. Empty or missing ID.");
            std::process::exit(1);
        }

        original_array.clear();
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

            writeln!(writer, "{},{},{}", id, algo_name, duration.as_nanos()).unwrap();
            writer.flush().unwrap();
        }
    }
}