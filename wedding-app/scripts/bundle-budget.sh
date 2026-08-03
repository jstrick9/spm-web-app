#!/usr/bin/env bash
# Bundle-size budget gate.
#
# Usage (from wedding-app/):  bash scripts/bundle-budget.sh
#
# Fails the build if a production `vite build` output exceeds the budgets
# below. Thresholds are generous but deliberate: the shell must stay lean
# because heavy modules (konva, QR scanner, pdfjs) are lazy-loaded chunks.
# Raise a budget only with a reviewed reason — otherwise this gate exists
# to catch accidental main-bundle growth.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/client"

# Budgets in raw bytes (KB below).
INDEX_BUDGET_KB=300
REACT_VENDOR_BUDGET_KB=190
RADIX_VENDOR_BUDGET_KB=210

echo "[bundle] building client..."
npm run build >/tmp/bundle-build.log 2>&1 || { tail -20 /tmp/bundle-build.log; exit 1; }

FAIL=0
check() {
  local label=$1 pattern=$2 budget_kb=$3
  local file
  file=$(ls $pattern 2>/dev/null | head -1 || true)
  if [ -z "$file" ]; then
    echo "[bundle] MISSING chunk: $pattern" >&2
    FAIL=1
    return
  fi
  local kb
  kb=$(du -k "$file" | cut -f1)
  echo "[bundle] $label: ${kb} KB (budget ${budget_kb} KB)"
  if [ "$kb" -gt "$budget_kb" ]; then
    echo "[bundle] FAIL: $label exceeds budget (${kb} KB > ${budget_kb} KB)" >&2
    FAIL=1
  fi
}

check "main index chunk"  "dist/assets/index-*.js"        "$INDEX_BUDGET_KB"
check "react vendor chunk" "dist/assets/react-vendor-*.js" "$REACT_VENDOR_BUDGET_KB"
check "radix vendor chunk" "dist/assets/radix-vendor-*.js"  "$RADIX_VENDOR_BUDGET_KB"

if [ "$FAIL" -ne 0 ]; then
  echo "[bundle] budgets exceeded — review before shipping." >&2
  exit 1
fi
echo "[bundle] all bundle budgets satisfied ✅"
