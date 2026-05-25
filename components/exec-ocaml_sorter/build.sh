#!/bin/bash
set -e

# Query opam for binary and library paths to set up standard OCaml environment
OPAM_BIN=$(opam var bin)
OPAM_LIB=$(opam var lib)

export PATH="$OPAM_BIN:$PATH"
export CAML_LD_LIBRARY_PATH="$OPAM_LIB/stublibs:$OPAM_LIB/ocaml/stublibs:$OPAM_LIB/ocaml"

# Auto-install mtime if it is missing
if ! ocamlfind query mtime >/dev/null 2>&1; then
  echo "Package 'mtime' not found. Installing via opam..."
  opam install -y mtime
fi

# Compile with O3 optimization and unsafe mode (bounds checking disabled) for maximum speed
ocamlfind ocamlopt -thread -package mtime.clock -linkpkg -O3 -unsafe sorter.ml -o sorter_ocaml_exe
