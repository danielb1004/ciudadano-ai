#!/usr/bin/env bash
set -euo pipefail
target="${ZAP_TARGET:-http://localhost:8000/openapi.json}"
docker run --rm -v "$(pwd)/testing/zap:/zap/wrk/:rw" ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py -t "$target" -f openapi -J api-report.json -r api-report.html
