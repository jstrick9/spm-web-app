#!/usr/bin/env bash
# ============================================================
# Nightly backup: pull the SQLite file from the VPS to your home PC.
#
# Run from your HOME machine, NOT from the VPS. Add to cron:
#     0 3 * * * /home/you/scripts/backup-to-home.sh
#
# Requirements on the home PC:
#   - SSH key access to the VPS (ssh-copy-id user@yourwedding.example.com)
#   - rsync (built-in on macOS/Linux; on Windows use WSL or Cygwin)
#
# Strategy:
#   - Use sqlite3 ".backup" command for a CONSISTENT snapshot
#     (just copying the .db file while WAL is active can produce a
#      corrupt copy on the receiving end).
#   - Keep 30 daily + 12 monthly snapshots.
#   - Notify (optional) on failure.
# ============================================================

set -euo pipefail

# ─── CONFIG — edit these three lines ───────────────────────
VPS_USER="root"
VPS_HOST="yourwedding.example.com"
BACKUP_DIR="${HOME}/wedding-backups"
# ───────────────────────────────────────────────────────────

DATE="$(date +%Y-%m-%d)"
DAILY_DIR="${BACKUP_DIR}/daily"
MONTHLY_DIR="${BACKUP_DIR}/monthly"
mkdir -p "$DAILY_DIR" "$MONTHLY_DIR"

LOCAL_SNAPSHOT="${DAILY_DIR}/wedding-${DATE}.db"

echo "[backup] taking consistent snapshot on VPS…"
# ".backup" produces a single .db file safe to copy even with concurrent writes
ssh "${VPS_USER}@${VPS_HOST}" \
  "docker exec \$(docker compose -f /root/wedding-poc/docker-compose.yml ps -q app) \
   sqlite3 /data/wedding.db '.backup /data/wedding-snapshot.db'"

echo "[backup] copying snapshot to ${LOCAL_SNAPSHOT}"
rsync -avz --progress \
  "${VPS_USER}@${VPS_HOST}:/var/lib/docker/volumes/wedding-poc_wedding-data/_data/wedding-snapshot.db" \
  "${LOCAL_SNAPSHOT}"

# Optional: also pull uploads folder if you wire one up later
# rsync -avz "${VPS_USER}@${VPS_HOST}:/var/lib/docker/volumes/wedding-poc_wedding-data/_data/uploads/" \
#   "${BACKUP_DIR}/uploads/"

# Keep first-of-month snapshots in monthly/
if [[ "$(date +%d)" == "01" ]]; then
  cp "$LOCAL_SNAPSHOT" "${MONTHLY_DIR}/wedding-${DATE}.db"
fi

# Prune: keep 30 daily, 12 monthly
find "$DAILY_DIR"   -name 'wedding-*.db' -mtime +30 -delete
find "$MONTHLY_DIR" -name 'wedding-*.db' -mtime +365 -delete

echo "[backup] done. snapshot size: $(du -h "$LOCAL_SNAPSHOT" | cut -f1)"
echo "[backup] daily count: $(ls -1 "$DAILY_DIR" | wc -l) | monthly: $(ls -1 "$MONTHLY_DIR" | wc -l)"
