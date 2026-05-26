use std::env;
use std::io::{self, BufRead, BufWriter, Write};
use std::time::Instant;

type SortRoutine = fn(&mut [u32]);

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
        eprintln!("Error: Usage: {} <function>", args[0]);
        std::process::exit(1);
    }

    let target_algorithm_name = &args[1];
    if target_algorithm_name.is_empty() {
        eprintln!("Error: Empty function name requested.");
        std::process::exit(1);
    }

    let sort_routine = resolve_algorithm(target_algorithm_name);

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

        let mut pipe_parts = trimmed_line.splitn(2, '|');

        let id = pipe_parts.next().unwrap_or("").trim();
        if id.is_empty() {
            eprintln!("Error: Malformed line. Empty or missing ID.");
            std::process::exit(1);
        }

        let array_data = match pipe_parts.next() {
            Some(d) => d,
            None => {
                eprintln!("Error: Malformed line. Missing pipe character '|'.");
                std::process::exit(1);
            }
        };

        let parts = array_data.split(',');

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

        let start = Instant::now();
        sort_routine(&mut original_array);
        let duration = start.elapsed();

        writeln!(writer, "{}|{}", duration.as_nanos(), id).unwrap();
        writer.flush().unwrap();
    }
}