#define _GNU_SOURCE
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <time.h>
#include <ctype.h>
#include <errno.h>

void* safe_realloc(void* ptr, size_t size) {
    void* new_ptr = realloc(ptr, size);
    if (!new_ptr) {
        fprintf(stderr, "Error: Memory allocation failed.\n");
        exit(1);
    }
    return new_ptr;
}

char* safe_strdup(const char* s) {
    char* new_str = strdup(s);
    if (!new_str) {
        fprintf(stderr, "Error: Memory allocation failed.\n");
        exit(1);
    }
    return new_str;
}

int compare_uint32(const void* a, const void* b) {
    uint32_t arg1 = *(const uint32_t*)a;
    uint32_t arg2 = *(const uint32_t*)b;
    if (arg1 < arg2) return -1;
    if (arg1 > arg2) return 1;
    return 0;
}

void libc_qsort(uint32_t* array, size_t n) {
    qsort(array, n, sizeof(uint32_t), compare_uint32);
}

typedef void (*sort_func_t)(uint32_t*, size_t);

typedef struct {
    const char* name;
    sort_func_t func;
} algorithm_entry_t;

algorithm_entry_t registry[] = {
    {"qsort", libc_qsort},
    {NULL, NULL}
};

char* trim_whitespace(char* str) {
    char* end;
    while (isspace((unsigned char)*str)) str++;
    if (*str == 0) return str;
    end = str + strlen(str) - 1;
    while (end > str && isspace((unsigned char)*end)) end--;
    end[1] = '\0';
    return str;
}

uint32_t parse_strict_uint32(const char* token) {
    if (*token == '\0') {
        fprintf(stderr, "Error: Empty numeric token.\n");
        exit(1);
    }
    for (const char* p = token; *p; p++) {
        if (!isdigit((unsigned char)*p)) {
            fprintf(stderr, "Error: Invalid numeric token (non-digit): '%s'\n", token);
            exit(1);
        }
    }
    errno = 0;
    char* endptr;
    unsigned long long val = strtoull(token, &endptr, 10);
    if (errno != 0 || *endptr != '\0' || val > 4294967295ULL) {
        fprintf(stderr, "Error: Numeric token out of bounds or invalid: '%s'\n", token);
        exit(1);
    }
    return (uint32_t)val;
}

typedef struct {
    uint32_t* data;
    size_t capacity;
    size_t size;
} uint32_buffer_t;

void buffer_append(uint32_buffer_t* buf, uint32_t val) {
    if (buf->size >= buf->capacity) {
        buf->capacity = buf->capacity == 0 ? 1024 : buf->capacity * 2;
        buf->data = safe_realloc(buf->data, buf->capacity * sizeof(uint32_t));
    }
    buf->data[buf->size++] = val;
}

void process_line(char* line, const char* target_algo, uint32_buffer_t* original_array) {
    char* pipe_ptr = strchr(line, '|');
    if (!pipe_ptr) {
        fprintf(stderr, "Error: Malformed line (missing '|' separator).\n");
        exit(1);
    }
    *pipe_ptr = '\0';
    char* id_token = line;
    char* array_data = pipe_ptr + 1;
    
    char* id = trim_whitespace(id_token);
    if (strlen(id) == 0) return;

    original_array->size = 0;

    char* saveptr;
    char* token = strtok_r(array_data, ",", &saveptr);
    while (token != NULL) {
        token = trim_whitespace(token);
        if (strlen(token) > 0) {
            buffer_append(original_array, parse_strict_uint32(token));
        }
        token = strtok_r(NULL, ",", &saveptr);
    }

    if (original_array->size == 0) {
        return;
    }

    algorithm_entry_t* entry = NULL;
    for (int j = 0; registry[j].name != NULL; j++) {
        if (strcmp(target_algo, registry[j].name) == 0) {
            entry = &registry[j];
            break;
        }
    }

    if (!entry) {
        fprintf(stderr, "Error: Unknown function '%s' requested.\n", target_algo);
        exit(1);
    }

    struct timespec start, end;
    clock_gettime(CLOCK_MONOTONIC, &start);
    entry->func(original_array->data, original_array->size);
    clock_gettime(CLOCK_MONOTONIC, &end);

    long long duration_ns = (long long)(end.tv_sec - start.tv_sec) * 1000000000LL + (end.tv_nsec - start.tv_nsec);

    printf("%lld|%s\n", duration_ns, id);
    fflush(stdout);
}

int main(int argc, char* argv[]) {
    if (argc != 2) {
        fprintf(stderr, "Usage: %s <function>\n", argv[0]);
        return 1;
    }

    const char* target_algo = argv[1];
    if (strlen(target_algo) == 0) {
        fprintf(stderr, "Error: Empty function name requested.\n");
        return 1;
    }

    // Check if function name exists in registry immediately
    int found = 0;
    for (int j = 0; registry[j].name != NULL; j++) {
        if (strcmp(target_algo, registry[j].name) == 0) {
            found = 1;
            break;
        }
    }
    if (!found) {
        fprintf(stderr, "Error: Unknown function '%s' requested.\n", target_algo);
        return 1;
    }

    char* line = NULL;
    size_t len = 0;
    ssize_t read;

    uint32_buffer_t original_array = {NULL, 0, 0};

    while ((read = getline(&line, &len, stdin)) != -1) {
        char* trimmed_line = trim_whitespace(line);
        if (strlen(trimmed_line) == 0) continue;
        process_line(trimmed_line, target_algo, &original_array);
    }

    free(line);
    free(original_array.data);

    return 0;
}