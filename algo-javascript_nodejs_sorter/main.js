import process from "node:process";

/**
 * Parses command line arguments to extract the requested sorting functions.
 * @param {string[]} args
 * @returns {string[]}
 */
function parseArguments(args) {
    const prefix = "--functions=";
    const targetArg = args.find(arg => arg.startsWith(prefix));
    
    if (!targetArg) {
        process.stderr.write("Error: Must specify exactly one argument in the format --functions=func1,func2\n");
        process.exit(1);
    }

    const functionsList = targetArg.slice(prefix.length);
    if (!functionsList) {
        process.stderr.write("Error: No functions specified.\n");
        process.exit(1);
    }

    const functions = functionsList.split(',').map(f => f.trim()).filter(Boolean);
    if (functions.length === 0) {
        process.stderr.write("Error: No valid functions extracted from argument.\n");
        process.exit(1);
    }

    return functions;
}

/**
 * Validates that the requested function is supported by this component.
 * @param {string} funcName 
 */
function validateFunction(funcName) {
    const supported = [
        "TypedArray.sort", 
        "TypedArray.toSorted", 
        "Array.sort", 
        "Array.toSorted"
    ];
    if (!supported.includes(funcName)) {
        process.stderr.write(`Error: Unrecognized function ${funcName}\n`);
        process.exit(1);
    }
}

/**
 * Processes a single comma-separated string of benchmark data, sorts it, and outputs the timing.
 * @param {string} line 
 * @param {string[]} functions 
 */
function processLine(line, functions) {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    const parts = trimmedLine.split(',');
    const id = parts[0].trim();
    
    if (!id) {
        process.stderr.write("Error: Malformed line. Empty or missing ID.\n");
        process.exit(1);
    }

    const maxTokens = parts.length - 1;
    const tempArray = new Uint32Array(maxTokens);
    let validCount = 0;

    for (let i = 1; i < parts.length; i++) {
        const token = parts[i].trim();
        if (!token) continue;

        const val = Number(token);
        if (!Number.isInteger(val) || val < 0 || val > 4294967295) {
            process.stderr.write(`Error: Invalid uint32 token '${token}' in line ID '${id}'\n`);
            process.exit(1);
        }
        tempArray[validCount++] = val;
    }

    if (validCount === 0) {
        process.stderr.write(`Error: Malformed line. No numeric data found for ID '${id}'\n`);
        process.exit(1);
    }

    const masterArray = new Uint32Array(tempArray.buffer, 0, validCount);

    for (const func of functions) {
        let duration = 0n;
        const compare = (a, b) => {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        }
        if (func === "TypedArray.sort") {
            const arrayCopy = new Uint32Array(masterArray);
            const start = process.hrtime.bigint();
            arrayCopy.sort();
            const end = process.hrtime.bigint();
            duration = end - start;
        } else if (func === "TypedArray.toSorted") {
            const start = process.hrtime.bigint();
            masterArray.toSorted();
            const end = process.hrtime.bigint();
            duration = end - start;
        } else if (func === "Array.sort") {
            const arrayCopy = Array.from(masterArray);
            const start = process.hrtime.bigint();
            arrayCopy.sort(compare);
            const end = process.hrtime.bigint();
            duration = end - start;
        } else if (func === "Array.toSorted") {
            const arrayCopy = Array.from(masterArray);
            const start = process.hrtime.bigint();
            arrayCopy.toSorted(compare);
            const end = process.hrtime.bigint();
            duration = end - start;
        }

        process.stdout.write(`${id},${func},${duration.toString()}\n`);
    }
}

async function main() {
    const functions = parseArguments(process.argv);
    functions.forEach(validateFunction);

    let stdinStream;
    if (typeof Deno !== "undefined") {
        stdinStream = Deno.stdin.readable;
    } else if (typeof Bun !== "undefined") {
        stdinStream = Bun.stdin.stream();
    } else if (typeof process !== "undefined" && process.versions && process.versions.node) {
        const { Readable } = await import("node:stream");
        stdinStream = Readable.toWeb(process.stdin);
    } else {
        process.stderr.write("Error: Standard input stream not implemented for this runtime.\n");
        process.exit(1);
    }

    const textStream = stdinStream.pipeThrough(new TextDecoderStream());
    const reader = textStream.getReader();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += value;
        let newlineIndex;
        
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);
            processLine(line, functions);
        }
    }
    
    if (buffer.length > 0) {
        processLine(buffer, functions);
    }
}

main().catch(err => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
});