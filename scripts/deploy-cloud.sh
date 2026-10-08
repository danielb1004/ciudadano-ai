#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
command -v docker >/dev/null || { echo "Install Docker Engine and the Compose plugin on the Linux server."; exit 1; }
docker compose version >/dev/null
test -f .env.cloud || { echo "Create .env.cloud using scripts/prepare_cloud.py --origin https://YOUR-DOMAIN."; exit 1; }
test -f ml/models/beto-synthetic-v1/model.onnx || { echo "Copy the completed BETO model into ml/models/beto-synthetic-v1."; exit 1; }
test -f ml/models/beto-synthetic-v1/training-config.json || exit 1
# Keep persistent volumes and encryption keys across updates.
docker compose --env-file .env.cloud -f docker-compose.cloud.yml config --quiet
docker compose --env-file .env.cloud -f docker-compose.cloud.yml up --build -d --wait --wait-timeout 600
echo "Deployment started. Verify DNS, TLS and the public chat using the configured origin."
