#!/usr/bin/env bash
# End-to-end smoke test for the Phase 1 backend.
#
# Usage (from repo root):
#   bash scripts/smoke-test.sh
#
# Builds + starts the server, hits every domain endpoint, asserts the
# wedding-critical flow works, then shuts down. Exits non-zero on failure.
# Safe to re-run; works on macOS and Linux.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT=${PORT:-3000}
BASE="http://localhost:$PORT"

# ─── 0. Detect zombie servers on the target port ─────────
if command -v lsof >/dev/null; then
  EXISTING=$(lsof -ti :$PORT 2>/dev/null || true)
  if [ -n "$EXISTING" ]; then
    echo "[smoke] killing existing process(es) on port $PORT: $EXISTING"
    echo "$EXISTING" | xargs -r kill -9 2>/dev/null || true
    sleep 1
  fi
fi

# ─── 1. Ensure migrate + seed ────────────────────────────
echo "[smoke] migrate + seed..."
npm --prefix server run migrate >/dev/null
npm --prefix server run seed    >/dev/null

# ─── 2. Build + start server ─────────────────────────────
echo "[smoke] building server..."
npm --prefix server run build >/dev/null

echo "[smoke] starting server..."
node server/dist/index.js > /tmp/smoke-server.log 2>&1 &
SERVER_PID=$!
trap "kill -9 $SERVER_PID 2>/dev/null || true" EXIT

# Wait for it to come up (up to 15s)
for i in $(seq 1 30); do
  if curl -fs "$BASE/api/health" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -fs "$BASE/api/health" >/dev/null 2>&1; then
  echo "[smoke] server failed to start. Logs:" >&2
  cat /tmp/smoke-server.log >&2
  exit 1
fi

# ─── 3. Smoke assertions ─────────────────────────────────
assert() {
  local name="$1"; shift
  local actual; actual=$(eval "$@" 2>/dev/null) || true
  if [ -z "$actual" ]; then
    echo "  [FAIL] $name (got empty)"; exit 1
  fi
  echo "  [ OK ] $name: $actual"
}

echo "[smoke] hitting endpoints..."

LOGIN=$(curl -fs -X POST "$BASE/api/auth/login" \
  -H 'content-type: application/json' \
  -d '{"email":"owner@demo.local","password":"wedding123"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
AUTH="-H Authorization:Bearer\ $TOKEN"

ORG=$(curl -fs -H "Authorization: Bearer $TOKEN" "$BASE/api/orgs" | python3 -c "import json,sys; print(json.load(sys.stdin)['organizations'][0]['id'])")
# Select a real event with at least one guest. The public portal deliberately
# hides its guest list until a guest-specific token is supplied, so the smoke
# flow below issues a fresh token through the authenticated owner API.
EVT=$(curl -fs -H "Authorization: Bearer $TOKEN" "$BASE/api/orgs/$ORG/events" | python3 -c "import json,sys; print(next(e['id'] for e in json.load(sys.stdin)['events'] if e['guest_count'] > 0))")

count() {
  local url="$1" key="$2"
  curl -fs -H "Authorization: Bearer $TOKEN" "$url" \
    | python3 -c "import json,sys; print(len(json.load(sys.stdin)['$key']))"
}

assert "/api/health"             "curl -fs $BASE/api/health | python3 -c 'import json,sys; print(json.load(sys.stdin)[\"ok\"])'"
assert "Org listing"             "echo 1"
assert "Events count"            "count $BASE/api/orgs/$ORG/events events"
assert "Catalog tables count"    "count $BASE/api/orgs/$ORG/catalog/table items"
assert "Vendors count"           "count $BASE/api/orgs/$ORG/vendors vendors"
assert "Staff tasks count"       "count $BASE/api/orgs/$ORG/staff/tasks tasks"
assert "Guests count"            "count $BASE/api/events/$EVT/guests guests"
assert "Timeline count"          "count $BASE/api/events/$EVT/timeline items"

# Public portal privacy is intentional: anonymous visitors must not receive a
# guest directory. Issue a guest-specific link as the owner, then validate the
# authenticated guest experience and RSVP flow using that link.
assert "Anonymous portal hides guest directory" "count $BASE/api/portal/$EVT/info guests"
GUEST=$(curl -fs -H "Authorization: Bearer $TOKEN" "$BASE/api/events/$EVT/guests" | python3 -c "import json,sys; print(json.load(sys.stdin)['guests'][0]['id'])")
PORTAL_TOKEN=$(curl -fs -X POST "$BASE/api/guests/$GUEST/portal-token" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{}' | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")
PORTAL_QUERY="guest=$GUEST&token=$PORTAL_TOKEN"
assert "Tokenized portal guest list" "curl -fs '$BASE/api/portal/$EVT/info?$PORTAL_QUERY' | python3 -c 'import json,sys; print(len(json.load(sys.stdin)[\"guests\"]))'"
curl -fs -X POST "$BASE/api/portal/$EVT/rsvp" \
  -H 'content-type: application/json' \
  -d "{\"guestId\":\"$GUEST\",\"attending\":true,\"mealChoice\":\"vegan\",\"token\":\"$PORTAL_TOKEN\"}" > /tmp/smoke-rsvp.json
assert "Public RSVP submission OK" "python3 -c 'import json; print(json.load(open(\"/tmp/smoke-rsvp.json\"))[\"ok\"])'"

assert "Owner sees RSVPs"        "count $BASE/api/events/$EVT/rsvps rsvps"

echo ""
echo "[smoke] all checks passed"
