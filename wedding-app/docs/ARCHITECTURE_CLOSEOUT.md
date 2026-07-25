# Architecture Closeout

## Verified baseline

The platform is a single-origin React/Vite SPA served by Fastify, with SQLite in WAL mode, typed SDK modules, JWT/RBAC, SSE invalidation, PWA support, and Docker/Caddy deployment. The current validation baseline is 46 server test files / 408 tests and 112 client test files / 714 tests, plus a passing smoke flow and public-surface axe checks.

## Implemented security and resilience controls

- Organization/event RBAC enforcement for object routes and webhook URL disclosure.
- Public/private asset namespaces, protected document/COI/layout evidence delivery, governed asset metadata, capability tokens, and legacy URL compatibility.
- Guest, vendor, asset, layout packet, invitation, and reset lifecycle controls with expiration/revocation where applicable.
- Outbound webhook URL validation, DNS private-network guard, timeout, concurrency limiting, classified retries, durable restart recovery, replay, telemetry, and retention.
- Docker health checks, persistent uploads, verified backup, restore, and operations runbook.

## Scaling boundary

SQLite is appropriate for the current single-node deployment. Before horizontal application scaling, high sustained write concurrency, or shared/network database storage, migrate to a client/server database and move the in-process worker and SSE fanout to shared infrastructure.

## Prioritized future backlog

### P1 — Product-safe hardening

1. Add an administrator UI for webhook health, terminal delivery replay, and retention settings.
2. Add asset capability issuance/revocation UI and explicit guest-visible publication workflow.
3. Exercise restore workflow in a scheduled non-production drill and record outcomes.

### P2 — Maintainability

1. Continue component decomposition for `CatalogScreen`, `EventStaffTab`, `EventVendorsTab`, and `GuestPortalSettingsTab` using the same extract-test-validate pattern.
2. Move additional CanvasPage rendering sections into focused components only after adding direct component tests.
3. Add bundle-size budgets to CI for high-cost route chunks.

### P3 — Scale and observability

1. Export webhook, worker, database, and asset metrics to deployment monitoring.
2. Add structured alert routes for retry backlog, terminal deliveries, backup failure, and disk capacity.
3. Plan PostgreSQL migration and separate worker process before multi-instance deployment.

## Operational acceptance checklist

- Set `JWT_SECRET`, `WEDDING_SECRETS_KEY`, and production domain configuration.
- Run a backup verification after initial deployment and a restore drill quarterly.
- Review `/api/orgs/:orgId/webhooks/health` and retry backlog during operations.
- Keep outbound firewall policy restricted to required DNS/HTTPS destinations.
- Run the CI quality gate before every production release.
