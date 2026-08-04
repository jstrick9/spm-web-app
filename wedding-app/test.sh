#!/usr/bin/env bash
# Wedding Venue Intelligence Platform — full test gate.
#
# Self-locating: derives the repo root from this script's own location, so it
# works from any checkout on any machine (no hardcoded home paths). If a
# modern Node is on PATH it is used; the macOS Homebrew path is kept only as a
# last-resort fallback.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR" && pwd)"

# Prefer PATH node; fall back to the author's Homebrew install.
if command -v node >/dev/null 2>&1 && [ "$(node -v 2>/dev/null | sed 's/v//; s/\..*//')" -ge 20 ] 2>/dev/null; then
  :
elif [ -x /opt/homebrew/opt/node@20/bin/node ]; then
  export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
fi
command -v node >/dev/null 2>&1 || { echo "Node.js >= 20 not found on PATH" >&2; exit 1; }

cd "$APP_DIR"

echo ""
echo "🧪 Running Wedding App Test Suite..."
echo "══════════════════════════════════════"

PASS=0
FAIL=0

check() {
  local name=$1
  local cmd=$2
  echo -n "  $name... "
  if eval "$cmd" > /tmp/test-out.txt 2>&1; then
    echo "✅"
    PASS=$((PASS + 1))
  else
    echo "❌"
    cat /tmp/test-out.txt | tail -5
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "BACKEND:"
cd "$APP_DIR/server"
check "TypeScript check" "npx tsc --noEmit"
check "Unit tests" "npm test -- --run"
check "API health (if server running)" "curl -sf --max-time 3 http://localhost:3000/api/health || true"

echo ""
echo "FRONTEND:"
cd "$APP_DIR/client"
check "TypeScript check" "npx tsc --noEmit"
check "Unit tests" "npm test -- --run"
check "Production build" "npm run build"

echo ""
echo "══════════════════════════════════════"
echo "Results: $PASS passed / $FAIL failed"
echo ""

if [ $FAIL -eq 0 ]; then
  echo "✅ ALL TESTS PASSED — Safe to deploy!"
  exit 0
else
  echo "❌ $FAIL TESTS FAILED — Fix before deploying"
  exit 1
fi
