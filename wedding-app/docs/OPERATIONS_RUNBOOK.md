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

## Periodic jobs (in-process worker)

The worker loop runs these automatically; verify they appear in logs after boot:

| Job | Interval | Purpose |
|---|---|---|
| Webhook retry replay | 1s | Durable retries of failed outbound deliveries |
| Lifecycle RSVP scan | 6h + boot | Finds events whose RSVP deadline is `offset_days` away and fires the automation |
| Timeline reminder dispatch | 60s | Due in-app timeline reminders → SSE; email reminders → SMTP when connected |
| Guest help-request SLA scan | 60min | Flags overdue open help requests (audit + SSE, deduped) |
| Webhook delivery prune | 24h | `WEBHOOK_DELIVERY_RETENTION_DAYS` (default 90) |
| Audit retention sweep | 24h | Report-only unless `AUDIT_RETENTION_DAYS` is set |

## Schema migrations are automatic

The server applies pending migrations on every boot (`schema_version`-tracked,
idempotent) and **refuses to start** if a migration fails. Deploys are
pull + restart; the manual `npm run migrate` remains available for operators
who prefer to apply ahead of a restart. Roll back by restoring the previous
database snapshot (migrations are forward-only).

## Rotating a webhook signing secret

`PATCH /api/webhooks/:id` with `{ secret: "new-value" }` re-seals the secret
(AES-256-GCM under `WEDDING_SECRETS_KEY`); the old value is immediately
invalid for outbound signatures and inbound verification. If you rotate
`WEDDING_SECRETS_KEY` itself, re-encrypt stored secrets with the rotation
script and update the key in `.env` — losing the key loses every stored
credential.

## Account lockout

After 5 failed logins an account is locked for `LOGIN_LOCKOUT_MS`
(default 300000 = 5 minutes; set in `.env`). Login is also rate-limited to
30/min per IP (registration 5/min). To unlock an account immediately
(support action): clear `failed_login_count` and `locked_until` on the user
row, or wait out the window. E2E/CI harnesses that share one IP should set
`E2E_RATE_LIMIT_BYPASS=1` on the server process — an explicit opt-in that is
never set in production deployments.

## Deployment gate

`./test.sh` (repo-root-relative) runs the full gate: server + client
typecheck, unit suites, and client production build. `deploy.sh` wraps the
git-flow (feature → develop → staging → main) and runs the gate before every
merge. Both scripts are self-locating and work from any checkout.

## Push notifications (web push)

...
