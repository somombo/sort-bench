import process from "node:process";

/**
 * Parses command line arguments to extract the requested sorting function.
 * @param {string[]} args
 * @returns {string}
 */
function parseArguments(args) {
    const userArgs = args.slice(2);
    if (userArgs.length !== 1) {
        process.stderr.write("Error: Must specify exactly one function argument.\n");
        process.exit(1);
    }
    const func = userArgs[0].trim();
    if (!func) {
        process.stderr.write("Error: Empty function name requested.\n");
        process.exit(1);
    }
    return func;
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
 * @param {string} func 
 */
function processLine(line, func) {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    const pipeParts = trimmedLine.split('|');
    if (pipeParts.length < 2) {
        process.stderr.write("Error: Malformed line. Expected pipe separator '|'.\n");
        process.exit(1);
    }

    const id = pipeParts[0].trim();
    if (!id) {
        process.stderr.write("Error: Malformed line. Empty or missing ID.\n");
        process.exit(1);
    }

    const arrayData = pipeParts[1];
    const parts = arrayData.split(',');

    const tempArray = new Uint32Array(parts.length);
    let validCount = 0;

    for (let i = 0; i < parts.length; i++) {
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

    let duration = 0n;
    const compare = (a, b) => {
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    }
    if (func === "TypedArray.sort") {
        const start = process.hrtime.bigint();
        masterArray.sort();
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

    process.stdout.write(`${duration.toString()}|${id}\n`);
}

async function main() {
    const func = parseArguments(process.argv);
    validateFunction(func);

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
            processLine(line, func);
        }
    }
    
    if (buffer.length > 0) {
        processLine(buffer, func);
    }
}

main().catch(err => {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(1);
});