#!/bin/bash

echo ""
echo "🧪 Running Wedding App Test Suite..."
echo "══════════════════════════════════════"

export PATH="/opt/homebrew/opt/node@20/bin:$PATH"

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
cd ~/ai-workspace/spm-web-app/wedding-app/server
check "TypeScript check" "npx tsc --noEmit"
check "Unit tests" "npm test -- --run"
check "API health" "curl -sf http://localhost:3000/api/health"

echo ""
echo "FRONTEND:"
cd ~/ai-workspace/spm-web-app/wedding-app/client
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
