using System;
using System.Diagnostics;
using System.IO;
using System.Linq;

namespace AlgoCSharpSorter;

/// <summary>
/// Execution entry point for the C# sorting benchmark component.
/// </summary>
public static class Program
{
    /// <summary>
    /// Reads arrays from standard input, executes the requested sorting function,
    /// and writes the elapsed nanoseconds to standard output.
    /// </summary>
    public static int Main(string[] args)
    {
        if (args.Length != 1)
        {
            Console.Error.WriteLine("Error: Must specify exactly one argument for the function name.");
            return 1;
        }

        string functionToRun = args[0];
        if (functionToRun != "std_sort" && functionToRun != "linq_order_by")
        {
            Console.Error.WriteLine($"Error: Unrecognized function '{functionToRun}'");
            return 1;
        }

        using var stdin = new StreamReader(Console.OpenStandardInput(), bufferSize: 65536);
        using var stdout = new StreamWriter(Console.OpenStandardOutput(), new System.Text.UTF8Encoding(false), 65536);

        uint[] buffer = new uint[65536];

        string? line;
        while ((line = stdin.ReadLine()) != null)
        {
            var trimmedLine = line.AsSpan().Trim();
            if (trimmedLine.IsEmpty)
            {
                continue;
            }

            int pipeIndex = trimmedLine.IndexOf('|');
            if (pipeIndex < 0)
            {
                Console.Error.WriteLine("Error: Malformed line. Missing pipe character '|'.");
                return 1;
            }

            var idSpan = trimmedLine.Slice(0, pipeIndex).Trim();
            if (idSpan.IsEmpty)
            {
                Console.Error.WriteLine("Error: Malformed line. Empty or missing ID.");
                return 1;
            }

            var arrayData = trimmedLine.Slice(pipeIndex + 1);
            int count = 0;

            var remaining = arrayData;
            while (true)
            {
                int commaIndex = remaining.IndexOf(',');
                ReadOnlySpan<char> token;

                if (commaIndex < 0)
                {
                    token = remaining.Trim();
                    remaining = ReadOnlySpan<char>.Empty;
                }
                else
                {
                    token = remaining.Slice(0, commaIndex).Trim();
                    remaining = remaining.Slice(commaIndex + 1);
                }

                if (!token.IsEmpty)
                {
                    if (count >= buffer.Length)
                    {
                        Array.Resize(ref buffer, buffer.Length * 2);
                    }

                    if (!TryParseStrictUint32(token, out uint value))
                    {
                        Console.Error.WriteLine($"Error: Invalid numeric token '{token.ToString()}' in line ID '{idSpan.ToString()}'.");
                        return 1;
                    }

                    buffer[count] = value;
                    count++;
                }

                if (remaining.IsEmpty)
                {
                    break;
                }
            }

            if (count == 0)
            {
                Console.Error.WriteLine($"Error: Malformed line. No numeric data found for ID '{idSpan.ToString()}'.");
                return 1;
            }

            long startTicks;
            TimeSpan elapsed;

            if (functionToRun == "std_sort")
            {
                startTicks = Stopwatch.GetTimestamp();
                Array.Sort(buffer, 0, count);
                elapsed = Stopwatch.GetElapsedTime(startTicks);
            }
            else
            {
                var segment = new ArraySegment<uint>(buffer, 0, count);
                startTicks = Stopwatch.GetTimestamp();
                _ = Enumerable.ToArray(Enumerable.OrderBy(segment, x => x));
                elapsed = Stopwatch.GetElapsedTime(startTicks);
            }

            long nanos = (long)elapsed.TotalNanoseconds;

            stdout.Write(nanos);
            stdout.Write('|');
            stdout.Write(idSpan);
            stdout.Write('\n');
            stdout.Flush();
        }

        return 0;
    }

    private static bool TryParseStrictUint32(ReadOnlySpan<char> s, out uint result)
    {
        result = 0;
        if (s.IsEmpty) return false;

        for (int i = 0; i < s.Length; i++)
        {
            char c = s[i];
            if (c < '0' || c > '9')
            {
                return false;
            }
        }

        return uint.TryParse(s, out result);
    }
}