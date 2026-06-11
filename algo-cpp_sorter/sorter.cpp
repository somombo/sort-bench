#include <iostream>
#include <string>
#include <vector>
#include <sstream>
#include <cstdint>
#include <chrono>
#include <map>
#include <functional>
#include <algorithm>
#include <stdexcept>
#include <cstdlib>

using SortRoutine = std::function<void(std::vector<uint32_t>&)>;

/**
 * @brief Removes leading and trailing whitespace from a string.
 * @param s The string to trim.
 * @return A new string with whitespace removed from both ends.
 */
static inline std::string trim(const std::string& s) {
    size_t start = s.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) return "";
    size_t end = s.find_last_not_of(" \t\r\n");
    return s.substr(start, end - start + 1);
}

/**
 * @brief Validates and converts a string token into a 32-bit unsigned integer.
 * Terminates the program immediately if the token contains invalid characters or overflows.
 * @param token The string representation of the number.
 * @return The parsed uint32_t value.
 */
uint32_t parseStrictUint32(const std::string& token) {
    for (char c : token) {
        if (!std::isdigit(c)) {
            std::cerr << "Error: Invalid numeric token (non-digit characters found): " << token << "\n";
            std::exit(1);
        }
    }

    try {
        size_t parsedLength = 0;
        unsigned long long val = std::stoull(token, &parsedLength);
        if (parsedLength != token.size()) {
            std::cerr << "Error: Invalid numeric token format: " << token << "\n";
            std::exit(1);
        }
        
        if (val > 4294967295ULL) {
            std::cerr << "Error: Numeric token out of bounds for uint32: " << token << "\n";
            std::exit(1);
        }
        
        return static_cast<uint32_t>(val);
    } catch (const std::exception&) {
        std::cerr << "Error: Numeric token out of bounds for uint32: " << token << "\n";
        std::exit(1);
    }
}

/**
 * @brief Extracts a list of algorithm names from the command-line argument.
 * Terminates the program if the format is invalid or missing.
 * @param cliArg The command-line argument string.
 * @return A vector of parsed algorithm names.
 */
std::vector<std::string> parseAlgorithms(const std::string& cliArg) {
    const std::string prefix = "--functions=";

    if (cliArg.rfind(prefix, 0) != 0) {
        std::cerr << "Error: Invalid argument format. Expected " << prefix << "...\n";
        std::exit(1);
    }

    std::string csvList = cliArg.substr(prefix.length());
    if (csvList.empty()) {
        std::cerr << "Error: No functions provided in argument.\n";
        std::exit(1);
    }

    std::vector<std::string> algorithms;
    std::stringstream ss(csvList);
    std::string algoName;
    while (std::getline(ss, algoName, ',')) {
        algoName = trim(algoName);
        if (!algoName.empty()) {
            algorithms.push_back(algoName);
        }
    }

    if (algorithms.empty()) {
        std::cerr << "Error: No valid functions extracted from argument.\n";
        std::exit(1);
    }

    return algorithms;
}

/**
 * @brief Parses a single line of CSV, executes requested sorts, and outputs timing data.
 * @param line The raw input string containing the ID and comma-separated array values.
 * @param targetAlgorithms The list of algorithm names to execute.
 * @param algorithmRegistry The mapping of algorithm names to callable functions.
 */
void benchmarkArray(const std::string& line, const std::vector<std::string>& targetAlgorithms, const std::map<std::string, SortRoutine>& algorithmRegistry) {
    std::stringstream ss(line);
    std::string idToken;
    
    if (!std::getline(ss, idToken, ',')) {
        return;
    }
    
    std::string id = trim(idToken);
    if (id.empty()) {
        return;
    }

    std::vector<uint32_t> originalArray;
    std::string token;
    
    while (std::getline(ss, token, ',')) {
        token = trim(token);
        if (token.empty()) {
            continue;
        }
        originalArray.push_back(parseStrictUint32(token));
    }

    if (originalArray.empty()) {
        return;
    }

    for (const std::string& algoName : targetAlgorithms) {
        auto it = algorithmRegistry.find(algoName);
        if (it == algorithmRegistry.end()) {
            std::cerr << "Error: Unknown function '" << algoName << "' requested.\n";
            std::exit(1);
        }

        std::vector<uint32_t> arrayCopy = originalArray;
        const SortRoutine& sortRoutine = it->second;

        auto start = std::chrono::steady_clock::now();
        sortRoutine(arrayCopy);
        auto end = std::chrono::steady_clock::now();

        auto duration = std::chrono::duration_cast<std::chrono::nanoseconds>(end - start).count();

        std::cout << id << "," << algoName << "," << duration << "\n" << std::flush;
    }
}

int main(int argc, char* argv[]) {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(NULL);

    if (argc != 2) {
        std::cerr << "Error: Usage: " << argv[0] << " --functions=func1,func2\n";
        std::exit(1);
    }

    std::vector<std::string> targetAlgorithms = parseAlgorithms(argv[1]);

    std::map<std::string, SortRoutine> algorithmRegistry = {
        {"std::sort", [](std::vector<uint32_t>& v) { 
            std::sort(v.begin(), v.end()); 
        }},
        {"std::stable_sort", [](std::vector<uint32_t>& v) { 
            std::stable_sort(v.begin(), v.end()); 
        }}
    };

    std::string line;
    while (std::getline(std::cin, line)) {
        line = trim(line);
        if (line.empty()) {
            continue;
        }
        benchmarkArray(line, targetAlgorithms, algorithmRegistry);
    }

    return 0;
}