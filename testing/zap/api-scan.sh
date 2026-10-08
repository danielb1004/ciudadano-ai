#!/usr/bin/env bash
set -euo pipefail
target="${ZAP_TARGET:-http://host.docker.internal:8000}"
mkdir -p research/evidence/zap
docker run --rm -v "$(pwd)/docs/api:/zap/api:ro" -v "$(pwd)/research/evidence/zap:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable zap-api-scan.py -t /zap/api/openapi.yaml -f openapi -O "$target" -S -J api-report.json -r api-report.html
# Passive scan. Active authenticated testing needs an authorized staging context.
