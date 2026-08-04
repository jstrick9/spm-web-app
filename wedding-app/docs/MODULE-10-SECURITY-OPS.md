# MODULE-10 — Security & Ops: Comprehensive Review

**Scope:** auth surface (`routes/auth.ts`, `middleware/auth.ts`, `lib/crypto.ts`, `lib/secrets.ts`,
`lib/publicAbuse.ts`, `lib/outboundNetwork.ts`, `lib/outboundUrl.ts`, `lib/fileStorage.ts`), SSE
stream (`routes/sse.ts`), ops surface (`deploy.sh`, `test.sh`, `scripts/*.sh`,
`docker-compose.yml`, `Dockerfile`, `.env.example`, `docs/OPERATIONS_RUNBOOK.md`), retention jobs,
and the security controls verified across modules 1–9.

**Review date:** 2026-08-04 · **Status:** findings fixed in this module commit (SO-01…SO-05).

---

## Module strengths (verified across the whole review cycle)

- **Auth**: PBKDF2-SHA256 @600k + per-record iterations + silent rehash-on-login; anti-timing dummy
  hash on unknown users; failed-login audit + account lockout; session_version invalidation on
  password change; hashed, expiring, single-use reset/magic tokens (15 min); rate-limited login
  (10/min), register (5/min), reset (5/15min), magic-link (5–8/15min).
- **Secrets**: AES-256-GCM with mandatory `WEDDING_SECRETS_KEY` (no dev fallback outside tests);
  clear guidance; integration + webhook secrets never returned to clients.
- **Uploads**: MIME whitelists (SVG deliberately excluded), 8 MB cap, UUID filenames, basename-only
  path resolution (no traversal).
- **Public surfaces**: honeypots on every public POST, per-endpoint rate limits, SSRF guard on
  outbound webhooks (DNS re-resolution at delivery), constant-time webhook signature checks.
- **Ops**: docker-compose requires `JWT_SECRET` + `WEDDING_SECRETS_KEY` (fails fast), healthcheck,
  Caddy automatic HTTPS, nightly off-host backup with `sqlite3 .backup` consistent snapshots +
  retention, restore drill with integrity check + confirmation, audit-retention report-only default,
  `TRUSTED_PROXIES` documented.

---

## Findings & fixes

| ID | Sev | Area | Finding | Fix |
|----|-----|------|---------|-----|
| SO-01 | **High** | Ops | **`test.sh` hardcodes `/opt/homebrew/opt/node@20/bin` and `~/ai-workspace/spm-web-app`** — the repo's canonical test entrypoint (called by `deploy.sh`, referenced by CI docs) breaks on every machine except the author's, and `deploy.sh` hardcodes the same repo path. A clone on another dev box or a CI runner cannot run the gate. | Make both scripts self-locating: derive the repo root from the script path, use `node`/`npm` from PATH with graceful fallback, keep the macOS Homebrew path only as a last-resort fallback. |
| SO-02 | **Med** | Ops | **`.env.example` is a Markdown table, not a usable env file** — `docker compose` interpolates from a real `.env`, but nothing tells a new deployer what to put in it, and **dev-mode misses `WEDDING_SECRETS_KEY` entirely**: creating any integration in `npm run dev` throws (sealSecret requires the key in non-test) → raw 500 with no guidance. | Real dotenv-format `.env.example` (every var compose/README references) + README "Environment variables" section with `openssl rand -hex 32` generation + integrations POST translates the missing-key error into a clear `400 secrets-key-not-configured`. |
| SO-03 | **Med** | Security | **SSE stream accepts ANY valid JWT in the query string** — the client correctly uses the 5-min `sse-token`, but the endpoint never checks the `sseOnly` claim, so the main 12h JWT works in a URL (access-log/Referer leakage) and the endpoint never re-validates the user row (disabled users keep streaming for up to 5 min). | Require the `sseOnly: true` claim on `/events/stream`; re-check user `status='active'` + `session_version` before subscribing. Client already sends the sseOnly token — no client change needed. |
| SO-04 | **Med** | Security | **Account lockout is 30 seconds after 5 failures and has zero test coverage** — a 30s pause is trivial for scripted attackers (rate limit 10/min bounds guesses, but the lockout is cosmetic). | Lockout window configurable via `LOGIN_LOCKOUT_MS` (default 5 minutes), documented in `.env.example`; integration test for lockout + unlock path. |
| SO-05 | **Low** | Ops | **`OPERATIONS_RUNBOOK.md` predates the module-cycle jobs** — it doesn't mention the new periodic workers (lifecycle RSVP scan, timeline reminder dispatch, guest-help SLA breach scan), the boot-time auto-migration, webhook-secret rotation, or the correct way to change a signing secret. | Runbook updated: job inventory, migration auto-apply, secret rotation (PATCH a new secret → re-sealed), lockout env, and the security posture table. |

---

## Verification & regression tests

Server — new `routes/security-ops-module.integration.test.ts` (+ runbook/env updates):

1. **SO-03**: stream with the main JWT → 401; stream with a token lacking `sseOnly` → 401; with the
   real sse-token → 200 + first events; disabled user's sse-token → 401.
2. **SO-04**: 5 failed logins → `account-locked` (429) for the configured window; correct password
   still 429 until expiry; lockout clears after the window (short window via env override).
3. **SO-02**: integrations POST without `WEDDING_SECRETS_KEY` (simulated via key-clearing helper)
   → `400 secrets-key-not-configured` (not 500).

Shell: `bash -n` on all touched scripts; `test.sh` runs from a foreign CWD via repo-relative
resolution (typecheck + unit test invocation smoke).

**Validation:** server `tsc --noEmit` ✅ · server vitest **540/540** (76 files) ✅ · client `tsc --noEmit` ✅ ·
client vitest **824/824** (125 files) ✅ · `npm run build` + bundle budgets ✅ · `bash -n` clean on
deploy/test/ops scripts · `test.sh` proven self-locating from a foreign CWD.

---

## Affected modules / follow-ups

- **All modules** — the SSE sseOnly requirement (SO-03) touches the single realtime channel; the
  client already complies, verified by the full client suite.
- **Integrations (M9)** — webhook-secret rotation instructions now in the runbook (SO-05).
- **Deferred:** per-IP+account brute-force correlation (rate limiter is global), hardware-key/2FA
  (out of scope for self-hosted single-VPS), egress firewall automation (documented manual step),
  `.env` auto-loading for bare-metal dev (documented `export $(cat .env)` instead).
