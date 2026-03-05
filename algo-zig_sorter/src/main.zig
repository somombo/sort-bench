const std = @import("std");

const SortFn = *const fn ([]u32) void;

const Algorithm = struct {
    name: []const u8,
    func: SortFn,
};

/// Evaluates if the left-hand side is strictly less than the right-hand side.
fn lessThan(_: void, lhs: u32, rhs: u32) bool {
    return lhs < rhs;
}

fn pdqSort(arr: []u32) void {
    std.sort.pdq(u32, arr, {}, lessThan);
}

fn blockSort(arr: []u32) void {
    std.sort.block(u32, arr, {}, lessThan);
}

const registry = [_]Algorithm{
    .{ .name = "std.sort.pdq", .func = pdqSort },
    .{ .name = "std.sort.block", .func = blockSort },
};

const LineReader = struct {
    file: std.fs.File,
    buffer: [64 * 1024]u8 = undefined,
    pos: usize = 0,
    len: usize = 0,

    fn readLine(self: *LineReader, allocator: std.mem.Allocator, out: *std.ArrayListUnmanaged(u8)) !bool {
        out.clearRetainingCapacity();
        while (true) {
            if (self.pos >= self.len) {
                self.len = try self.file.read(&self.buffer);
                self.pos = 0;
                if (self.len == 0) return out.items.len > 0;
            }
            const slice = self.buffer[self.pos..self.len];
            if (std.mem.indexOfScalar(u8, slice, '\n')) |idx| {
                try out.appendSlice(allocator, slice[0..idx]);
                self.pos += idx + 1;
                return true;
            } else {
                try out.appendSlice(allocator, slice);
                self.pos = self.len;
            }
        }
    }
};

/// Reads benchmark datasets from standard input, executes the requested sorting algorithms,
/// and writes the elapsed nanoseconds to standard output.
pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var args = try std.process.argsWithAllocator(allocator);
    defer args.deinit();

    var target_algorithms = try parseAlgorithms(allocator, &args);
    defer target_algorithms.deinit(allocator);

    var line_reader = LineReader{ .file = std.fs.File.stdin() };
    const stdout_file = std.fs.File.stdout();

    var master_array: std.ArrayListUnmanaged(u32) = .{};
    defer master_array.deinit(allocator);

    var copy_array: std.ArrayListUnmanaged(u32) = .{};
    defer copy_array.deinit(allocator);

    var line_buf: std.ArrayListUnmanaged(u8) = .{};
    defer line_buf.deinit(allocator);

    while (try line_reader.readLine(allocator, &line_buf)) {
        if (line_buf.items.len == 0) continue;

        master_array.clearRetainingCapacity();

        const id = try parseLineIntoArray(line_buf.items, &master_array, allocator);
        if (id.len == 0) continue;

        try runBenchmarks(
            stdout_file,
            id,
            target_algorithms.items,
            master_array.items,
            &copy_array,
            allocator,
        );
    }
}

/// Matches a string name to an algorithm in the registry.
fn resolveAlgorithm(name: []const u8) !SortFn {
    for (registry) |algo| {
        if (std.mem.eql(u8, algo.name, name)) {
            return algo.func;
        }
    }
    return error.UnknownAlgorithm;
}

/// Parses command-line arguments to extract and resolve the requested sorting functions.
fn parseAlgorithms(
    allocator: std.mem.Allocator,
    args: *std.process.ArgIterator,
) !std.ArrayListUnmanaged(Algorithm) {
    var list: std.ArrayListUnmanaged(Algorithm) = .{};

    _ = args.next();

    while (args.next()) |arg| {
        if (std.mem.startsWith(u8, arg, "--functions=")) {
            const funcs_str = arg["--functions=".len..];
            var it = std.mem.splitScalar(u8, funcs_str, ',');

            while (it.next()) |func_name| {
                const trimmed = std.mem.trim(u8, func_name, " \t\r\n");
                if (trimmed.len > 0) {
                    const func = try resolveAlgorithm(trimmed);
                    try list.append(allocator, .{ .name = trimmed, .func = func });
                }
            }
        }
    }

    if (list.items.len == 0) {
        return error.NoValidFunctionsProvided;
    }

    return list;
}

/// Splits a comma-separated line, updates the array with parsed integers, and returns the row ID.
fn parseLineIntoArray(
    line: []const u8,
    array: *std.ArrayListUnmanaged(u32),
    allocator: std.mem.Allocator,
) ![]const u8 {
    var it = std.mem.splitScalar(u8, line, ',');
    const id_raw = it.next() orelse return "";
    const id = std.mem.trim(u8, id_raw, " \t\r\n");

    while (it.next()) |val_str| {
        const trimmed = std.mem.trim(u8, val_str, " \t\r\n");
        if (trimmed.len == 0) continue;

        const val = try std.fmt.parseInt(u32, trimmed, 10);
        try array.append(allocator, val);
    }

    return id;
}

/// Cycles through requested algorithms, isolates the array copy step, and times the sort execution.
fn runBenchmarks(
    stdout_file: std.fs.File,
    id: []const u8,
    algorithms: []const Algorithm,
    master_array: []const u32,
    copy_array: *std.ArrayListUnmanaged(u32),
    allocator: std.mem.Allocator,
) !void {
    var out_buf: [2048]u8 = undefined;

    for (algorithms) |algo| {
        copy_array.clearRetainingCapacity();
        try copy_array.appendSlice(allocator, master_array);

        var timer = try std.time.Timer.start();
        algo.func(copy_array.items);
        const elapsed = timer.read();

        const msg = try std.fmt.bufPrint(&out_buf, "{s},{s},{d}\n", .{ id, algo.name, elapsed });
        try stdout_file.writeAll(msg);
    }
}
