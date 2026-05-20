#!/usr/bin/env bash
# Reset the local POC to a fresh state.
# - kills any server processes on port 3000
# - deletes the SQLite database files
# - re-runs migrate + seed
#
# Use this if you've poked around and want to start over.
#
#   bash scripts/reset-local.sh
#
# (Windows users: open Git Bash or WSL, or just run the three commands
#  by hand from the README's "start completely fresh" section.)

set -euo pipefail

cd "$(dirname "$0")/.."

echo "[reset] stopping anything on port 3000…"
if command -v lsof >/dev/null 2>&1; then
  lsof -ti :3000 2>/dev/null | xargs -r kill -9 2>/dev/null || true
fi

echo "[reset] removing existing database…"
rm -rf server/data

echo "[reset] running migrate…"
npm --prefix server run migrate

echo "[reset] seeding demo data…"
npm --prefix server run seed

echo ""
echo "✅ ready. start the dev servers with:"
echo "      npm run dev:server   (terminal 1)"
echo "      npm run dev:client   (terminal 2)"
echo ""
echo "   then visit http://localhost:5173/"
