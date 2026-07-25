#!/usr/bin/env bash
# Verify a local backup directory created by backup-to-home.sh.
set -euo pipefail
BACKUP_DIR="${1:?Usage: $0 /path/to/wedding-backups}"
LATEST="$(find "$BACKUP_DIR/daily" -maxdepth 1 -name 'wedding-*.db' -type f -print | sort | tail -n1)"
[ -n "$LATEST" ] || { echo 'No daily SQLite snapshot found' >&2; exit 1; }
sqlite3 "$LATEST" 'PRAGMA integrity_check;' | grep -qx 'ok' || { echo "Invalid snapshot: $LATEST" >&2; exit 1; }
[ -d "$BACKUP_DIR/uploads" ] || { echo 'Uploads backup directory missing' >&2; exit 1; }
FILES="$(find "$BACKUP_DIR/uploads" -type f | wc -l | tr -d ' ')"
echo "Backup verified: $LATEST"
echo "Uploads files: $FILES"
