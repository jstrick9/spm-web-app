#!/usr/bin/env bash
# Accessibility (axe-core via Playwright) gate.
#
# Usage (from repo root):
#   bash scripts/a11y-test.sh
#
# Builds the client + server, seeds a demo DB, boots the single Fastify
# server (which serves the built client at the same origin), then runs the
# Playwright a11y specs against it. Exits non-zero on any WCAG A/AA violation.
# Safe to re-run; works on macOS and Linux.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT=${PORT:-3000}
BASE="http://localhost:$PORT"
export A11Y_BASE_URL="$BASE"

# ─── 0. Kill any zombie server on the port ───────────────
if command -v lsof >/dev/null; then
  EXISTING=$(lsof -ti :"$PORT" 2>/dev/null || true)
  if [ -n "$EXISTING" ]; then
    echo "[a11y] killing existing process(es) on port $PORT: $EXISTING"
    echo "$EXISTING" | xargs -r kill -9 2>/dev/null || true
    sleep 1
  fi
fi

# ─── 1. Build client (server serves it) + server ─────────
echo "[a11y] building client..."
npm --prefix client run build >/dev/null
echo "[a11y] building server..."
npm --prefix server run build >/dev/null

# ─── 2. Migrate + seed a demo DB ─────────────────────────
echo "[a11y] migrate + seed..."
npm --prefix server run migrate >/dev/null
SEED_OUT="$(npm --prefix server run seed 2>&1)"
echo "$SEED_OUT" | grep -i "seed" || true

# Extract a seeded event id for the guest-portal scan. The seed logs the org
# id; we ask the API for the first event after the server boots (more robust
# than parsing seed output across versions).

# ─── 3. Ensure Playwright browser is present ─────────────
echo "[a11y] ensuring Playwright chromium is installed..."
npm --prefix client exec -- playwright install chromium >/dev/null 2>&1 || \
  npm --prefix client exec -- playwright install --with-deps chromium >/dev/null 2>&1 || true

# ─── 4. Boot the server ──────────────────────────────────
echo "[a11y] starting server..."
# E2E_RATE_LIMIT_BYPASS=1: the Playwright suite shares one IP and would
# otherwise self-DoS on the auth endpoints' per-IP budgets (register 5/min,
# login 30/min). Explicit opt-in for harness runs only.
JWT_SECRET="${JWT_SECRET:-a11y-ci-secret}" NODE_ENV=production E2E_RATE_LIMIT_BYPASS=1 \
  node server/dist/index.js > /tmp/a11y-server.log 2>&1 &
SERVER_PID=$!
cleanup() {
  kill -9 "$SERVER_PID" 2>/dev/null || true
  rm -f "$ROOT/.a11y-event-id" 2>/dev/null || true
}
trap cleanup EXIT

# Wait for health (up to 15s)
for _ in $(seq 1 30); do
  if curl -fs "$BASE/api/health" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -fs "$BASE/api/health" >/dev/null 2>&1; then
  echo "[a11y] server failed to start. Logs:" >&2
  cat /tmp/a11y-server.log >&2
  exit 1
fi

# ─── 5. Resolve a seeded event id for the portal scan ────
TOKEN=$(curl -fs -X POST "$BASE/api/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"owner@demo.local","password":"wedding123"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])" 2>/dev/null || true)

if [ -n "${TOKEN:-}" ]; then
  ORG=$(curl -fs -H "Authorization: Bearer $TOKEN" "$BASE/api/orgs" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)['organizations'][0]['id'])" 2>/dev/null || true)
  if [ -n "${ORG:-}" ]; then
    EVT=$(curl -fs -H "Authorization: Bearer $TOKEN" "$BASE/api/orgs/$ORG/events" \
      | python3 -c "import json,sys; print(json.load(sys.stdin)['events'][0]['id'])" 2>/dev/null || true)
    if [ -n "${EVT:-}" ]; then
      echo "$EVT" > "$ROOT/.a11y-event-id"
      echo "[a11y] seeded event id for portal scan: $EVT"
    fi
  fi
fi
[ -f "$ROOT/.a11y-event-id" ] || echo "[a11y] WARN: no event id resolved — portal scan will be skipped"

# ─── 6. Run the a11y specs ───────────────────────────────
# Invoke Playwright directly from the client dir (not `npm --prefix ... exec`,
# whose repo-root module context can shadow Playwright's `expect` with Vitest's
# and corrupt the worker state).
echo "[a11y] running axe-core Playwright specs against $BASE ..."
( cd client && ./node_modules/.bin/playwright test )

echo ""
echo "[a11y] all accessibility checks passed"
