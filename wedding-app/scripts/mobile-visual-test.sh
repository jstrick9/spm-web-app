#!/usr/bin/env bash
# Mobile/tablet visual regression gate (Playwright screenshots).
#
# Usage from repo root:
#   bash scripts/mobile-visual-test.sh
#
# By default this compares against committed baselines. To intentionally update
# baselines after reviewed UI changes:
#   UPDATE_SNAPSHOTS=1 bash scripts/mobile-visual-test.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT=${PORT:-3000}
BASE="http://localhost:$PORT"
export MOBILE_VISUAL_BASE_URL="$BASE"

if command -v lsof >/dev/null; then
  EXISTING=$(lsof -ti :"$PORT" 2>/dev/null || true)
  if [ -n "$EXISTING" ]; then
    echo "[mobile-visual] killing existing process(es) on port $PORT: $EXISTING"
    echo "$EXISTING" | xargs -r kill -9 2>/dev/null || true
    sleep 1
  fi
fi

echo "[mobile-visual] building client..."
npm --prefix client run build >/dev/null
echo "[mobile-visual] building server..."
npm --prefix server run build >/dev/null

echo "[mobile-visual] migrate + seed..."
npm --prefix server run migrate >/dev/null
npm --prefix server run seed >/dev/null

echo "[mobile-visual] ensuring Playwright chromium and system dependencies are installed..."
npm --prefix client exec -- playwright install chromium >/dev/null 2>&1 || true
npm --prefix client exec -- playwright install-deps chromium >/dev/null 2>&1 || true

echo "[mobile-visual] starting server..."
JWT_SECRET="${JWT_SECRET:-mobile-visual-ci-secret}" NODE_ENV=production \
  node server/dist/index.js > /tmp/mobile-visual-server.log 2>&1 &
SERVER_PID=$!
cleanup() {
  kill -9 "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 30); do
  if curl -fs "$BASE/api/health" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -fs "$BASE/api/health" >/dev/null 2>&1; then
  echo "[mobile-visual] server failed to start. Logs:" >&2
  cat /tmp/mobile-visual-server.log >&2
  exit 1
fi

ARGS=(--config playwright.mobile.config.ts)
if [ "${UPDATE_SNAPSHOTS:-0}" = "1" ]; then
  ARGS+=(--update-snapshots)
fi

echo "[mobile-visual] running Playwright visual snapshots against $BASE ..."
( cd client && ./node_modules/.bin/playwright test "${ARGS[@]}" )

echo ""
echo "[mobile-visual] mobile/tablet visual regression checks passed"
