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

/// Reads benchmark datasets from standard input, executes the requested sorting algorithm,
/// and writes the elapsed nanoseconds to standard output.
pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var args = try std.process.argsWithAllocator(allocator);
    defer args.deinit();

    // Skip executable name
    _ = args.next();

    const target_algo_name = args.next() orelse {
        std.debug.print("Error: Usage: sorter <function>\n", .{});
        std.process.exit(1);
    };

    const sort_fn = try resolveAlgorithm(target_algo_name);

    var line_reader = LineReader{ .file = std.fs.File.stdin() };
    const stdout_file = std.fs.File.stdout();

    var master_array: std.ArrayListUnmanaged(u32) = .{};
    defer master_array.deinit(allocator);

    var line_buf: std.ArrayListUnmanaged(u8) = .{};
    defer line_buf.deinit(allocator);

    while (try line_reader.readLine(allocator, &line_buf)) {
        if (line_buf.items.len == 0) continue;

        master_array.clearRetainingCapacity();

        const id = try parseLineIntoArray(line_buf.items, &master_array, allocator);
        if (id.len == 0) continue;

        try runBenchmark(
            stdout_file,
            id,
            sort_fn,
            master_array.items,
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
    std.debug.print("Error: Unknown algorithm '{s}' requested.\n", .{name});
    return error.UnknownAlgorithm;
}

/// Splits a pipe-delimited line, updates the array with parsed integers, and returns the row ID.
fn parseLineIntoArray(
    line: []const u8,
    array: *std.ArrayListUnmanaged(u32),
    allocator: std.mem.Allocator,
) ![]const u8 {
    var pipe_it = std.mem.splitScalar(u8, line, '|');
    const id_raw = pipe_it.next() orelse return error.MalformedLine;
    const id = std.mem.trim(u8, id_raw, " \t\r\n");

    const array_data = pipe_it.next() orelse return error.MalformedLine;
    var it = std.mem.splitScalar(u8, array_data, ',');

    while (it.next()) |val_str| {
        const trimmed = std.mem.trim(u8, val_str, " \t\r\n");
        if (trimmed.len == 0) continue;

        const val = try std.fmt.parseInt(u32, trimmed, 10);
        try array.append(allocator, val);
    }

    return id;
}

/// Isolates the timing of the sort execution.
fn runBenchmark(
    stdout_file: std.fs.File,
    id: []const u8,
    sort_fn: SortFn,
    array: []u32,
) !void {
    var out_buf: [2048]u8 = undefined;

    var timer = try std.time.Timer.start();
    sort_fn(array);
    const elapsed = timer.read();

    const msg = try std.fmt.bufPrint(&out_buf, "{d}|{s}\n", .{ elapsed, id });
    try stdout_file.writeAll(msg);
}
