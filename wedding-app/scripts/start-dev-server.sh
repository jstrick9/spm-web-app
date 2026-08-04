#!/usr/bin/env bash
# Ensure Vite's localhost:3000 proxy always targets the current checkout.
set -euo pipefail
PORT="${PORT:-3000}"
if command -v lsof >/dev/null; then
  PIDS="$(lsof -ti ":${PORT}" 2>/dev/null || true)"
  if [ -n "$PIDS" ]; then
    echo "[dev] stopping stale process(es) on port ${PORT}: ${PIDS}"
    kill $PIDS 2>/dev/null || true
    sleep 0.3
  fi
fi
exec npm --prefix server run dev
