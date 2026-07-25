#!/usr/bin/env bash
# Restore a verified SQLite + uploads backup into the Docker persistent volume.
# Run on the VPS from wedding-app/: ./scripts/restore-from-backup.sh /path/to/wedding-YYYY-MM-DD.db /path/to/uploads
set -euo pipefail

SNAPSHOT="${1:?Usage: $0 /path/to/snapshot.db /path/to/uploads-dir}"
UPLOADS="${2:?Usage: $0 /path/to/snapshot.db /path/to/uploads-dir}"
[ -f "$SNAPSHOT" ] || { echo "Snapshot not found: $SNAPSHOT" >&2; exit 1; }
[ -d "$UPLOADS" ] || { echo "Uploads directory not found: $UPLOADS" >&2; exit 1; }
sqlite3 "$SNAPSHOT" 'PRAGMA integrity_check;' | grep -qx 'ok' || { echo 'Snapshot integrity check failed' >&2; exit 1; }

read -r -p "Restore database and uploads from backup? Type RESTORE to continue: " CONFIRM
[ "$CONFIRM" = RESTORE ] || { echo 'Cancelled'; exit 0; }

COMPOSE="${COMPOSE_FILE:-docker-compose.yml}"
docker compose -f "$COMPOSE" stop app
VOLUME="$(docker compose -f "$COMPOSE" config --volumes | grep '^wedding-data$' || true)"
[ -n "$VOLUME" ] || { echo 'wedding-data volume not found in compose config' >&2; exit 1; }
# Compose prefixes named volumes with its project name; resolve it through Docker.
TARGET="$(docker volume ls --format '{{.Name}}' | grep '_wedding-data$' | head -n1)"
[ -n "$TARGET" ] || { echo 'Docker wedding-data volume not found' >&2; exit 1; }
docker run --rm -v "$TARGET:/data" -v "$(dirname "$SNAPSHOT"):/backup:ro" alpine sh -c "rm -f /data/wedding.db /data/wedding.db-wal /data/wedding.db-shm && cp /backup/$(basename "$SNAPSHOT") /data/wedding.db"
docker run --rm -v "$TARGET:/data" -v "$UPLOADS:/uploads:ro" alpine sh -c 'rm -rf /data/uploads && mkdir -p /data/uploads && cp -a /uploads/. /data/uploads/'
docker compose -f "$COMPOSE" up -d app

echo 'Restore complete. Verify: docker compose ps && curl -fsS http://127.0.0.1:3000/api/health'
