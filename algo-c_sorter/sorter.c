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

void process_line(char* line, char** target_algos, int num_targets, uint32_buffer_t* original_array, uint32_buffer_t* array_copy) {
    char* saveptr;
    char* id_token = strtok_r(line, ",", &saveptr);
    if (!id_token) return;
    
    char* id = trim_whitespace(id_token);
    if (strlen(id) == 0) return;

    original_array->size = 0;

    char* token;
    while ((token = strtok_r(NULL, ",", &saveptr)) != NULL) {
        token = trim_whitespace(token);
        if (strlen(token) == 0) continue;
        buffer_append(original_array, parse_strict_uint32(token));
    }

    if (original_array->size == 0) {
        return;
    }

    for (int i = 0; i < num_targets; i++) {
        algorithm_entry_t* entry = NULL;
        for (int j = 0; registry[j].name != NULL; j++) {
            if (strcmp(target_algos[i], registry[j].name) == 0) {
                entry = &registry[j];
                break;
            }
        }

        if (!entry) {
            fprintf(stderr, "Error: Unknown function '%s' requested.\n", target_algos[i]);
            exit(1);
        }

        if (array_copy->capacity < original_array->size) {
            array_copy->capacity = original_array->size;
            array_copy->data = safe_realloc(array_copy->data, array_copy->capacity * sizeof(uint32_t));
        }
        array_copy->size = original_array->size;
        memcpy(array_copy->data, original_array->data, original_array->size * sizeof(uint32_t));

        struct timespec start, end;
        clock_gettime(CLOCK_MONOTONIC, &start);
        entry->func(array_copy->data, array_copy->size);
        clock_gettime(CLOCK_MONOTONIC, &end);

        long long duration_ns = (long long)(end.tv_sec - start.tv_sec) * 1000000000LL + (end.tv_nsec - start.tv_nsec);

        printf("%s,%s,%lld\n", id, entry->name, duration_ns);
        fflush(stdout);
    }
}

int main(int argc, char* argv[]) {
    if (argc != 2 || strncmp(argv[1], "--functions=", 12) != 0) {
        fprintf(stderr, "Usage: %s --functions=func1,func2\n", argv[0]);
        return 1;
    }

    char* functions_arg = safe_strdup(argv[1] + 12);
    int num_targets = 0;
    char** target_algos = NULL;

    char* saveptr;
    char* token = strtok_r(functions_arg, ",", &saveptr);
    while (token) {
        token = trim_whitespace(token);
        if (strlen(token) > 0) {
            target_algos = safe_realloc(target_algos, (num_targets + 1) * sizeof(char*));
            target_algos[num_targets++] = safe_strdup(token);
        }
        token = strtok_r(NULL, ",", &saveptr);
    }

    if (num_targets == 0) {
        fprintf(stderr, "Error: No functions provided.\n");
        return 1;
    }

    char* line = NULL;
    size_t len = 0;
    ssize_t read;

    uint32_buffer_t original_array = {NULL, 0, 0};
    uint32_buffer_t array_copy = {NULL, 0, 0};

    while ((read = getline(&line, &len, stdin)) != -1) {
        char* trimmed_line = trim_whitespace(line);
        if (strlen(trimmed_line) == 0) continue;
        process_line(trimmed_line, target_algos, num_targets, &original_array, &array_copy);
    }

    free(line);
    free(original_array.data);
    free(array_copy.data);

    for (int i = 0; i < num_targets; i++) free(target_algos[i]);
    free(target_algos);
    free(functions_arg);

    return 0;
}