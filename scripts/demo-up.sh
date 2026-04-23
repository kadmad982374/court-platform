#!/usr/bin/env bash
# ============================================================
# scripts/demo-up.sh
# Start the full demo stack (build images + launch services).
# Run from the project root.
# ============================================================
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ ! -f ".env.demo" ]; then
  echo "ERROR: .env.demo not found."
  echo "  Copy .env.demo.example → .env.demo and fill in your secrets."
  exit 1
fi

echo "==> Building and starting demo stack..."
DOCKER_BUILDKIT=0 docker compose -p sla-demo -f docker-compose.demo.yml --env-file .env.demo up -d --build

echo ""
echo "==> Demo stack is starting."
echo "    Frontend:  http://localhost (or your server IP/domain)"
echo "    Backend:   proxied at /api"
echo ""
echo "==> Default demo credentials (all passwords: ChangeMe!2026):"
echo "    admin            — CENTRAL_SUPERVISOR"
echo "    section_fi_dam   — SECTION_HEAD (full demo flows)"
echo "    lawyer_fi_dam    — STATE_LAWYER"
echo "    viewer           — READ_ONLY_SUPERVISOR"
echo ""
echo "    See docs/deployment/DEMO_DEPLOYMENT_GUIDE.md for all credentials."


