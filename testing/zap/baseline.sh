#!/usr/bin/env bash
set -euo pipefail
target="${ZAP_TARGET:-http://localhost:8000}"
docker run --rm -v "$(pwd)/testing/zap:/zap/wrk/:rw" ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t "$target" -J zap-report.json -r zap-report.html -m 5
