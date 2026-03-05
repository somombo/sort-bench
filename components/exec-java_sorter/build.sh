#!/bin/bash
set -e

# Compile the Java source to class files
javac Sorter.java

# Build a highly optimized native executable using GraalVM native-image
# -O3: Maximum optimization for release
# -march=x86-64-v3: Target modern x86-64 processors
# --gc=G1: Use G1 garbage collector for high-throughput array allocation handling
# --no-fallback: Ensure a standalone executable is generated
# -o sorter_java: Name of the output executable
native-image -O3 -march=x86-64-v3 --gc=G1 --no-fallback -o sorter_java Sorter
# native-image -Ob -march=x86-64-v3 --gc=G1 --no-fallback -o sorter_java Sorter # builds faster