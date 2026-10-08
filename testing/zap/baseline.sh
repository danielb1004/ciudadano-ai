#!/usr/bin/env bash
set -euo pipefail
target="${ZAP_TARGET:-http://host.docker.internal:5173}"
mkdir -p research/evidence/zap
docker run --rm -v "$(pwd)/research/evidence/zap:/zap/wrk/:rw" ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t "$target" -J zap-report.json -r zap-report.html -m 5
