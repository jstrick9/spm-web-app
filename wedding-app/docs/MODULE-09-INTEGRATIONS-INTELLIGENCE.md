# MODULE-09 — Integrations & Intelligence: Comprehensive Review

**Scope:** `integrations/{registry,runtime,types}.ts`, `integrations/providers/{email_smtp,stripe,square,sms_twilio}.ts`,
`routes/{integrations,webhooks,webhookReceiver,lifecycleEmails,intelligence}.ts`, `webhooks/{dispatcher,retryPolicy}.ts`,
`db/repos/{integrations,webhooks,scheduledEmails,emailTemplates,emailAutomations,forecast,risk,vendorScoring,vendorRatings}.ts`,
`jobs/{worker,lifecycleEmails,timelineReminders}.ts`, client `IntegrationHub`, `IntelligenceDashboard`,
`AnalyticsDashboard`, `EmailAutomationStudio`, `sdk/{integrations,webhooks,intelligence,lifecycleEmails}.ts`,
`useRealtimeInvalidation`.

**Review date:** 2026-08-04 · **Status:** findings fixed in this module commit (IN-01…IN-08).

---

## Module strengths

- **Integration runtime is clean and safe**: secrets sealed/never returned, provider schema
  validation, verify-on-write, auth-failure → status 'error' auto-detection, per-org event logs.
- **Stripe/Square webhook verification is constant-time with replay tolerance**; the payment
  reconciliation is idempotent and never downgrades finalized payments.
- **Outbound webhook dispatcher is genuinely production-grade**: SSRF guard
  (`assertPublicWebhookTarget`), HMAC signing, 10s timeout, concurrency limiter (5), durable retries
  with `Retry-After` respect, terminal-state replay, delivery logs.
- **Lifecycle emails**: per-guest idempotency keys, daily RSVP-deadline scan, 60-min manual-send
  cooldown, template ownership checks, awaited `runTrigger`.
- **Intelligence surfaces** (forecast, risk alerts, vendor scores/matching, recommendations) all
  have proper permission scoping and query clamping.

---

## Findings & fixes

| ID | Sev | Area | Finding | Fix |
|----|-----|------|---------|-----|
| IN-01 | **High** | Feature dead | **Lifecycle email enqueue is broken**: `scheduledEmailsRepo.enqueue` looks up the SMTP integration with `status = 'active'` — but the integrations schema CHECK only allows `pending/connected/disabled/error/revoked`, so the lookup ALWAYS returns nothing and every scheduled email ships with `integrationId: ''`. The worker then calls `runAction` with an empty id → `integration-not-found` → every RSVP reminder / thank-you fails. `runTrigger`'s "SMTP connected" guard passes (it checks `connected`), so the failure is silent (job marked failed; email never sent). | Query `status = 'connected'` (the actual connected state set by `verifyIntegration`). Regression: lifecycle automation run produces a job with a real integrationId and `scheduled_emails.status='sent'`. |
| IN-02 | **High** | Feature dead | **Twilio SMS path can never connect**: `smsTwilioProvider.verify()` only parses config/secrets — it never calls Twilio — so the admin flow marks "connected" without testing. | Real `verify()`: call Twilio's balance/first-party endpoint (GET `/2010-04-01/Accounts/{sid}/Balance.json`) with the auth header; fail with a clear message. |
| IN-03 | **Med** | Security | **Inbound webhook receiver is unauthenticated by design, but the signature scheme is weak**: the HMAC is over `JSON.stringify(req.body)` (key order/whitespace unstable) and there is **no rate limit** on the public endpoint. | Rate-limit 60/min; sign over the **raw body** when available (Fastify raw-body capture) with constant-time compare; document the signing scheme. |
| IN-04 | **Med** | Governance | **Webhook secrets are stored in plaintext** (`webhooks.secret` column) and returned to clients on every read — the module's own rule ("secrets are NEVER returned") is violated for webhook signing secrets. | Store HMAC secrets sealed (same `sealSecret` as integrations); return `hasSecret` instead; `deliverWebhook` + receiver `openSecret`. Migration 0052 (add `secret_payload` column, backfill by sealing, drop `secret`). |
| IN-05 | **Med** | Robustness | **`emailTemplatesRepo.render` failures (bad template syntax) crash `runTrigger` mid-loop** — one bad template kills the entire automation run; per-guest rendering isn't isolated. | Per-guest try/catch: failed renders are counted + logged (audit `lifecycle_email.render_failed`) and the loop continues. |
| IN-06 | **Med** | Realtime | **SSE ↔ webhook fan-out is complete for org events, but there are no client invalidation handlers for webhook/integration/lifecycle events** — the Integration Hub's delivery list and status badges go stale until refetch. | Client handlers: `webhook.inbound` / `webhook.test` / `integration.*` → invalidate `['webhooks']`, `['integrations']`, `['webhook-deliveries']`; `lifecycle_email.sent` → invalidate `['lifecycle-emails']`. |
| IN-07 | **Low** | UX | **IntegrationHub `managerMode` uses `localStorage.wvi_registration_role`** (raw roleKey) instead of the permission — a custom staff-like role with `integrations.view` gets the wrong UI; also `providers`/`webhooks`/`deliveries` queries run regardless of access and 403. | Gate the queries + UI on `usePermission('integrations.view')` / `org.settings.manage`; no raw roleKey. |
| IN-08 | **Low** | Consistency | **Email template create/update/delete are unaudited** (module convention: audit every mutation) and the create route returns 201 without an audit row. | Audit `email_template.create/update/delete` (with template org scoping already in place). |

---

## Verification & regression tests

Server — new `routes/integrations-module.integration.test.ts` (+ updates to lifecycle suites):

1. **IN-01**: seed a `connected` SMTP integration + automation + template → `runTrigger` →
   a `job_queue` row with the real integrationId, `scheduled_emails.status='sent'` (previously
   `integrationId:''` → worker `integration-not-found`).
2. **IN-02**: `verifyIntegration` for `sms_twilio` actually calls Twilio (mock via fetch interception
   in test → fail-with-message when endpoint errors; the sandbox verifies via the Balance endpoint).
3. **IN-03**: inbound webhook route rate-limited from a non-allowlisted IP (429); invalid signature
   → 401; valid raw-body signature → 200.
4. **IN-04**: webhook create stores sealed secret (no `secret` column value); list returns
   `hasSecret` and never the secret; dispatcher signs correctly via `openSecret`.
5. **IN-05**: one broken template doesn't stop the loop (audit `lifecycle_email.render_failed`).
6. **IN-08**: email-template mutations audited.

Client — `useRealtimeInvalidation.test.ts` (webhook/integration/lifecycle handlers),
`IntegrationHub.test.tsx` (permission-based gating). Full suites re-run.

**Validation:** server `tsc --noEmit` ✅ · server vitest **535/535** ✅ · client `tsc --noEmit` ✅ ·
client vitest **824/824** ✅ · `npm run build` + bundle budgets ✅.

---

## Affected modules / follow-ups

- **Finance & Contracts (M6)** — the payments webhook HMAC path already had raw-body capture; the
  same helper is now used by the inbound receiver (IN-03).
- **Guest & Couple Portals (M7)** — guest reminder-preferences + couple finance emails go through
  `email.send` jobs that used to silently fail on the empty integrationId (IN-01) — fixed at the
  source.
- **Security & Ops (next module)** — webhook secret sealing (IN-04) and the inbound rate limit
  (IN-03) become runbook items.
- **Deferred:** OAuth provider flows (registry explicitly notes Calendly/Google/DocuSign as roadmap),
  polling integrations (the `poll` capability is declared but unused), outbound webhook pagination.
