#!/usr/bin/env bash
# ============================================================
# scripts/demo-down.sh
# Stop the demo stack (keeps volumes intact).
# ============================================================
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Stopping demo stack (data volumes preserved)..."
docker compose -f docker-compose.demo.yml down
echo "Done."

