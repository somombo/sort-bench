#!/usr/bin/env bash

set -euo pipefail
# set -v
CGO_ENABLED=0 go build -ldflags="-s -w" -o sorter_go_exe main.go