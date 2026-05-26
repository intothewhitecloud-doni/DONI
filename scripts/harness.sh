#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "[1/5] Install dependency check"
npm ci --prefer-offline

echo "[2/5] Typecheck, policy tests, production build"
npm run check

echo "[3/5] Security audit"
npm audit --audit-level=moderate

echo "[4/5] Validate Docker Compose"
docker compose config --quiet

echo "[5/5] Optional runtime smoke test"
if docker compose ps --format json 2>/dev/null | grep -q '"Service":"app"'; then
  curl -fsS http://127.0.0.1:3002/ >/dev/null
  echo "Runtime HTTP smoke OK"
else
  echo "Runtime not running; skip HTTP smoke"
fi

echo "DONI harness OK"
