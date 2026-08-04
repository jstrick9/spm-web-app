# MODULE-06 — Finance & Contracts: Comprehensive Review

**Scope:** `routes/{budget,contracts,payments}.ts`, `routes/couple/finance.ts`, payment-link routes in
`routes/intelligence.ts`, `db/repos/{budget,contracts,paymentLinks,financialLegalOps}.ts`,
`payments/service.ts`, migration 0019, client `EventBudgetTab` + `PaymentsPanel`,
`EventContractsTab` + `ESignatureDialog` + `ContractPrintView`, `CoupleEventHub` finance center,
`sdk/{budget,contracts,intelligence}.ts`, `useRealtimeInvalidation`.

**Review date:** 2026-08-04 · **Status:** findings fixed in this module commit (FI-01…FI-17).

---

## Module strengths

- **Payment capture is genuinely production-shaped**: hosted Stripe/Square checkouts with HMAC-verified
  webhooks, idempotent reconciliation (`reconcile()` never downgrades a finalized payment), manual
  reconciliation for cash/check with notes, printable receipts, and balance ledgers.
- **Couple finance center is well-built**: sanitized `safeContract`/`safePayment` projections (no
  internal budget/vendor margin leakage), a plain-text packet export, change-order + finance-question
  request flows, and audits on the couple sign.
- **Contract obligation extraction** (load-in, COI, cleanup, alcohol, noise, overtime) with
  excerpt + confidence scoring is a genuinely useful day-of ops tool.
- Escalations and go/no-go flags with owner-approval semantics are a sound decision-support design.

---

## Findings & fixes

| ID | Sev | Area | Finding | Fix |
|----|-----|------|---------|-----|
| FI-01 | **High** | Feature dead | **E-signature is 403 for every system role**: `contracts.sign` is granted to NO role, yet `EventContractsTab` renders `ESignatureDialog` gated on it — the venue-side sign flow is unreachable. Also `POST /api/contracts/:id/sign` uses org scope without `orgMap` and re-signing silently overwrites a prior signature. | Grant `contracts.sign` to owner + manager; orgMap scope; 400 `contract-already-signed`; audit + SSE. |
| FI-02 | **High** | RBAC/access | **Event-scoped members denied on all finance writes**: budget PATCH/DELETE, contract PATCH/send/sign/delete/extract, `PATCH /api/payments/:id/status`, `POST /api/payments/:id/checkout` use org-level `can(...)` without `orgMap` → event-scoped planners/managers with the perms get 403 (GETs already used the orgMap pattern). | Unify on `orgMap` + `{eventId}` scope (same pattern as MODULE-05 ST-01). |
| FI-03 | **High** | Feature dead | **Go/No-Go owner approval is unreachable**: `approveGoNoGoFlag()` exists in the repo but no route or UI calls it — flags can never leave `open`. `resolved` is equally unreachable. | `POST …/go-no-go-flags/:flagId/approve` (owner/admin only) + `…/resolve` (contracts.manage), audited, SSE; client buttons for owners/managers. |
| FI-04 | **High** | Feature dead | **Obligation extracts cannot be approved/dismissed**: `status 'detected'→'approved'/'dismissed'` + `approved_by/approved_at` columns exist but no route or UI — the status column is dead weight. | `POST /api/contracts/:id/obligations/:obligationId` (contracts.manage, orgMap) with audit; client approve/dismiss buttons. |
| FI-05 | **Med** | API design | **`GET /api/events/:eventId/financial-legal` mutates state** — it re-runs `upsertContractObligations` for every contract on every read (write-in-GET: cache-hostile, non-idempotent semantics). | Make the GET pure; extraction stays on contract create/update + the explicit `POST /contracts/:id/extract-obligations`; add a "Re-extract" button in the manager panel. |
| FI-06 | **Med** | Audit | **Audit gaps**: budget update/delete, contract update/send/delete/sign, payment-link create + manual status reconciliation, escalation/go-no-go/extract mutations are unaudited (module convention: audit every mutation). | Audit entries for all of the above. |
| FI-07 | **Med** | Realtime | **SSE + invalidation gaps**: `contract.updated`/`contract.deleted` are never broadcast; manual payment status changes don't broadcast `payment.updated`; the couple sign route doesn't broadcast `contract.signed`; `useRealtimeInvalidation` has **zero** handlers for contract/payment events. | Broadcasts on all mutations (payloads carry `eventId`); client handlers invalidating `['contracts', eventId]`, `['payment-links', eventId]`, `['financial-legal', eventId]`, `['budget', eventId]`. |
| FI-08 | **Med** | Data integrity | **Cross-org refs**: budget item `vendorId` and payment-link `contractId` are not validated to belong to the event's org. | Validate → 400 `vendor-not-in-org` / `contract-not-in-event`. |
| FI-09 | **Med** | Governance | **Re-sign overwrite** on both the venue and couple sign paths (a second signature silently replaces the first — breaks the evidentiary value of e-signatures). | 400 `contract-already-signed` on both routes. |
| FI-10 | **Med** | Security | **Public webhook routes have no rate limit**, and the raw-body JSON parser registered in `payments.ts` is **app-wide** (Fastify content-type parsers are not encapsulated — behavior-compatible today, but a latent foot-gun). **App-wide bug found while testing:** the global error handler only recognized errors with a `code` string, so @fastify/rate-limit's bare `statusCode:429` errors fell through to **500 internal-error** — meaning EVERY rate-limited route (login, register, public portals, webhooks) returned 500 instead of 429 when the limit tripped. | Rate limit 60/min on both webhook routes; parser documented; global error handler now maps 4xx-with-statusCode errors to their HTTP status (429 surfaces correctly app-wide). |
| FI-11 | **Med** | RBAC | **Escalation writes allowed with read-only permission**: `POST …/financial-legal/escalations` accepted `budget.view` — held by the staff role **and the couple role** — letting them create Go/No-Go **blocked** flags on their own event (couples have their own requests flow). | New dedicated permission **`financial_legal.escalate`** (manager, planner, owner/admin) required for escalations + flag resolve — matching the manager role's "…and escalations" description while keeping finance view-only for the ops manager; staff/couple blocked. Client escalate buttons gated on the same permission. |
| FI-12 | **Med** | Ops | **Contract "Send" doesn't send anything** — it only flips status to `sent`. The contract has `recipientEmail` and the app has SMTP integrations + an email job queue. | Best-effort email delivery on send (when org SMTP connected + recipient email set): enqueue `email.send` with the contract text; status flow unchanged when no SMTP. |
| FI-13 | **Low** | Privacy | **`GET /couple-finance` writes an audit row on every read** — the couple hub polls this endpoint, so audit_logs grows with view noise. | Remove the per-GET audit (keep audits on the couple sign/request mutations). |
| FI-14 | **Low** | UX | `PaymentsPanel` sends `Math.round(NaN*100)` for empty/garbage amounts — server 400s, but the user gets a generic toast with no field-level feedback. | Client-side amount validation (disabled button + inline error), tested. |
| FI-15 | **Low** | Consistency | `POST /api/events/:eventId/payments` accepts `provider: 'paypal'` but checkout only supports stripe/square (paypal rows are dead-ends for collection). | Restrict the enum to `manual | stripe | square` (paypal rows impossible to create). |
| FI-16 | **Low** | Cleanup | `financial-legal` GET returns escalation/flag **status transitions** that nothing can trigger (`acknowledged`, `resolved` on escalations) — display-only statuses. | Documented; resolve covered for flags (FI-03); escalations left display-only (advisory by design). |

---

## Verification & regression tests

Server — new `routes/finance-module.integration.test.ts` (+ updates to `rbac-coverage`):

1. Event-scoped planner with `budget.manage`/`contracts.manage` can PATCH budget items, PATCH/send/
   delete contracts, reconcile payment status (FI-02).
2. Venue e-signature: owner can sign a sent contract; re-sign → 400; manager can sign; event-scoped
   member denied without the orgMap fix (FI-01/09).
3. Go/No-Go: manager cannot approve a flag; owner can; resolve works; audits + SSE rows (FI-03).
4. Obligation extracts: approve/dismiss persists status + approver; cross-org denied (FI-04).
5. `GET financial-legal` is pure — no extract rows are created by the GET (FI-05).
6. Payment webhook routes are rate-limited; payment status manual change broadcasts + audits (FI-07/10).
7. Budget vendorId + payment contractId cross-org validation (FI-08).
8. Couple cannot create escalations (budget.view no longer sufficient) (FI-11).
9. Contract send with connected SMTP enqueues an `email.send` job (FI-12).
10. `POST /payments` rejects `paypal` (FI-15).

Client — `useRealtimeInvalidation.test.ts` (contract/payment handlers), `PaymentsPanel.test.tsx`
(amount validation), `EventContractsTab.test.tsx` (obligation approve/dismiss + flag approve buttons).

**Validation:** server `tsc --noEmit` ✅ · server vitest ✅ · client `tsc --noEmit` ✅ · client vitest ✅ ·
`npm run build` + bundle budgets ✅.

---

## Affected modules / follow-ups

- **Couple & Guest Portals (next module)** — couple finance center now benefits from live
  `contract.signed` SSE and the already-signed guard.
- **Integrations/Intelligence (later module)** — payment webhooks + checkout already live in
  `intelligence.ts` payment routes (reviewed here); Integration Hub copy unchanged.
- **Platform Admin (later module)** — audit trail now includes finance mutations (FI-06).
- **Deferred:** contract email *templating* (plain-text delivery for now), partial-payment ledger
  enforcement (partialPaidCents is tracked in metadata, not enforced against amount), escalation
  resolution lifecycle UI.
