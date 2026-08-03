# Operations Runbook

## Daily checks

```bash
docker compose ps
curl -fsS http://127.0.0.1:3000/api/health
```

Review webhook resilience telemetry with an authorized account:

```text
GET /api/orgs/:orgId/webhooks/health
```

Investigate a non-zero retry backlog or terminal failure count. Terminal deliveries can be requeued with the authorized webhook replay endpoint.

## Backup verification

Run the off-host snapshot script nightly, then verify the newest copied backup:

```bash
./scripts/backup-to-home.sh
./scripts/verify-backup.sh "$HOME/wedding-backups"
```

Backups include both the SQLite snapshot and `/data/uploads` media/documents.

## Restore drill

At least quarterly, restore to a non-production VPS or isolated Docker project:

```bash
./scripts/restore-from-backup.sh /path/to/wedding-YYYY-MM-DD.db /path/to/uploads
```

The restore script validates SQLite integrity, requires explicit confirmation, restores uploads, clears stale WAL/SHM files, and starts the application. Confirm `/api/health`, an authenticated login, and a representative gallery/document download after the drill.

## Retention

- Webhook delivery history: `WEBHOOK_DELIVERY_RETENTION_DAYS` (default 90).
- SQLite backups: 30 daily and 12 monthly snapshots by default.
- Uploads: retained with their snapshots; use business/legal retention policy before deleting event media or documents.
- Audit log: **report-only by default — nothing is ever deleted automatically.** If the venue explicitly authorizes a retention policy, set `AUDIT_RETENTION_DAYS` (e.g. `365`) and the worker's daily sweep deletes older rows (recording a `system.audit_retention` audit entry per affected org first). Verify the sweep in logs after enabling: `[retention] audit sweep: deleted N rows...`.

## Proxy trust

`trustProxy` trusts `X-Forwarded-For` by default because the documented deployment is a single VPS behind Caddy with port 3000 unpublished. If the app port is ever reachable directly, set `TRUSTED_PROXIES` to the comma-separated proxy IPs so clients cannot spoof their IP in audit logs.

## SQLite operating limits

SQLite is appropriate for the documented single-VPS, single-process deployment. WAL mode supports concurrent readers, but writes remain serialized. Monitor response latency and retry backlog as usage grows. Move to a managed client/server database before running multiple application replicas, placing the database on network storage, or supporting sustained high-concurrency writes.

## Outbound webhook egress

The application validates configured URLs and resolved addresses before delivery. Also restrict outbound network access at the VPS/firewall layer to DNS plus required HTTPS destinations. Do not permit unrestricted access to private RFC1918, loopback, link-local, or cloud metadata networks.
