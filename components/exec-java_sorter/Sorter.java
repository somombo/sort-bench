import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.util.Arrays;

/**
 * Executor program for the impalab sorting benchmark in Java.
 * Reads pipe-delimited lines from standard input, parses the numeric values,
 * and measures the execution time of standard library sorting functions.
 */
public class Sorter {

    /**
     * Main execution entry point.
     *
     * @param args Command-line arguments containing the sorting function to execute.
     */
    public static void main(String[] args) {
        if (args.length != 1) {
            System.err.println("Error: Must specify exactly one argument for the function name.");
            System.exit(1);
        }

        String functionToRun = args[0];
        if (!functionToRun.equals("Arrays.sort") && !functionToRun.equals("Arrays.parallelSort")) {
            System.err.println("Error: Unrecognized function '" + functionToRun + "'");
            System.exit(1);
        }

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(System.in), 65536);
             BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(System.out), 65536)) {

            int[] buffer = new int[65536];
            String line;

            while ((line = reader.readLine()) != null) {
                String trimmedLine = line.trim();
                if (trimmedLine.isEmpty()) {
                    continue;
                }

                int pipeIndex = trimmedLine.indexOf('|');
                if (pipeIndex < 0) {
                    System.err.println("Error: Malformed line. Missing pipe character '|'.");
                    System.exit(1);
                }

                String id = trimmedLine.substring(0, pipeIndex).trim();
                if (id.isEmpty()) {
                    System.err.println("Error: Malformed line. Empty or missing ID.");
                    System.exit(1);
                }

                String arrayData = trimmedLine.substring(pipeIndex + 1);
                int count = 0;

                int pos = 0;
                int len = arrayData.length();
                while (pos < len) {
                    int commaIndex = arrayData.indexOf(',', pos);
                    String token;
                    if (commaIndex < 0) {
                        token = arrayData.substring(pos).trim();
                        pos = len;
                    } else {
                        token = arrayData.substring(pos, commaIndex).trim();
                        pos = commaIndex + 1;
                    }

                    if (!token.isEmpty()) {
                        if (!isStrictDigits(token)) {
                            System.err.println("Error: Invalid numeric token '" + token + "' in line ID '" + id + "'.");
                            System.exit(1);
                        }

                        int parsedValue = 0;
                        try {
                            parsedValue = Integer.parseUnsignedInt(token);
                        } catch (NumberFormatException e) {
                            System.err.println("Error: Invalid numeric token '" + token + "' in line ID '" + id + "'.");
                            System.exit(1);
                        }

                        if (count >= buffer.length) {
                            buffer = Arrays.copyOf(buffer, buffer.length * 2);
                        }
                        buffer[count++] = parsedValue;
                    }
                }

                if (count == 0) {
                    System.err.println("Error: Malformed line. No numeric data found for ID '" + id + "'.");
                    System.exit(1);
                }

                long start;
                long duration;

                if (functionToRun.equals("Arrays.sort")) {
                    start = System.nanoTime();
                    Arrays.sort(buffer, 0, count);
                    duration = System.nanoTime() - start;
                } else {
                    start = System.nanoTime();
                    Arrays.parallelSort(buffer, 0, count);
                    duration = System.nanoTime() - start;
                }

                writer.write(Long.toString(duration));
                writer.write('|');
                writer.write(id);
                writer.write('\n');
                writer.flush();
            }
        } catch (IOException e) {
            System.err.println("Error reading/writing stream: " + e.getMessage());
            System.exit(1);
        }
    }

    private static boolean isStrictDigits(String s) {
        if (s.isEmpty()) {
            return false;
        }
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c < '0' || c > '9') {
                return false;
            }
        }
        return true;
    }
}
