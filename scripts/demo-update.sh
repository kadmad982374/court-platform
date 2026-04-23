#!/usr/bin/env bash
# ============================================================
# scripts/demo-update.sh
# Pull latest code, rebuild images, restart services.
# Run from the project root on the server.
# ============================================================
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Pulling latest code..."
git pull

echo "==> Rebuilding images and restarting services..."
DOCKER_BUILDKIT=0 docker compose -p sla-demo -f docker-compose.demo.yml --env-file .env.demo up -d --build

echo "==> Update complete."


