# Phase 48 — Real Payment Capture (Stripe + Square)

**Date:** 2026-06-01
**Type:** Feature — finishes the payment infrastructure into real, working capture
**Status:** server 296 tests · client 432 tests · typecheck + build clean

---

## What this delivers

The platform already had the `payment_links` table, a multi-provider status
state-machine, and the `/api/events/:id/payments` CRUD — but no way to actually
take money. This phase wires **real hosted-checkout capture** through the
existing integration framework, for **Stripe** and **Square**, with automatic
webhook reconciliation. No card data ever touches our server (PCI-light hosted
checkout).

### Flow
```
Staff: New Payment (stripe/square) ─► payment_links row (pending)
Staff: "Collect Payment" ─► POST /api/payments/:id/checkout
        └─ runAction(stripe|square, createCheckout) ─► provider REST API
        └─ store external_id + hosted URL, status → processing
Client pays on provider's hosted page (new tab)
Provider ─► POST /api/payments/webhooks/{provider}/{integrationId}
        └─ verify signature ─► reconcile payment_links ─► completed/failed/refunded
        └─ audit log + SSE 'payment.updated'
```

---

## Built on existing seams (no new heavy deps)

- **Providers** implement the existing `IntegrationProvider` contract
  (`integrations/types.ts`), registered in `integrations/registry.ts`. They use
  `fetch` against the providers' REST APIs — no `stripe`/`square` SDK, matching
  the platform's zero-bloat philosophy and the webhook dispatcher's fetch style.
- **Connection + secret storage** reuse the Integration Hub: `kind: 'api_key'`,
  `category: 'payments'`, AES-GCM-sealed secrets, `verify()` on connect.
- **Action dispatch** goes through `runAction()` (input validation, audit
  `integration_events`, auth-error status flips) — same path as `sendEmail`.

## New files

```
server/src/integrations/providers/stripe.ts   # provider + verifyStripeSignature
server/src/integrations/providers/square.ts    # provider + verifySquareSignature
server/src/payments/service.ts                 # createCheckout + reconcile
server/src/routes/payments.ts                  # checkout endpoint + 2 webhook receivers
server/src/routes/payments.integration.test.ts # 11 tests
client/src/screens/events/budget/PaymentsPanel.tsx        # UI (in Budget tab)
client/src/screens/events/budget/PaymentsPanel.test.tsx   # 3 tests
```

## Modified

```
integrations/registry.ts          # register stripe + square
db/repos/paymentLinks.ts          # findByExternalId, attachCheckout
db/repos/index.ts                 # (existing exports used)
index.ts                          # register paymentRoutes (encapsulated)
client/src/sdk/intelligence.ts    # paymentLinksSdk.checkout()
client/src/screens/events/budget/EventBudgetTab.tsx  # render <PaymentsPanel/>
.env.example                      # BASE_URL + payments webhook notes
```

## API

| Method | URL | Auth | Purpose |
|---|---|---|---|
| POST | `/api/payments/:id/checkout` | `budget.manage` | Create hosted checkout, return URL |
| POST | `/api/payments/webhooks/stripe/:integrationId` | signature | Reconcile Stripe events |
| POST | `/api/payments/webhooks/square/:integrationId` | signature | Reconcile Square events |

## Security

- **Signature verification on every webhook.** Stripe: HMAC-SHA256 of
  `t.payload` with the `whsec_` secret + 5-minute replay window. Square:
  HMAC-SHA256(base64) of `notificationUrl + body` with the signature key.
  A bad/absent signature → **401**, status unchanged.
- **Raw-body parsing is scoped** to the payments plugin (encapsulated
  `addContentTypeParser`) so signature bytes are exact, without affecting other
  routes' JSON parsing.
- **Per-integration webhook URLs** (`/{integrationId}`) so the receiver can load
  the right org's signing secret; secrets are decrypted only in the receiver.
- **Idempotent reconciliation** — re-delivered "completed" events are no-ops; a
  finalized/refunded payment is never downgraded by a late duplicate.
- **RBAC**: checkout creation requires `budget.manage`, scoped to the payment's org.
- No PAN/card data is stored or proxied — only the provider's checkout id + URL.

## Hardening found via tests

`appBaseUrl()` now falls back to a valid absolute origin when `BASE_URL` is
missing or relative — otherwise Stripe's `successUrl`/`cancelUrl` (which must be
absolute) would be rejected. (Surfaced because the sandbox set `BASE_URL=/`.)

## Tests (14 new)

- **Signature verifiers** (unit): valid/invalid signatures, Stripe replay-window rejection.
- **Checkout**: creates Stripe session (mocked fetch) + stores external id/url/processing; 400 when not connected; 400 for manual links; 401 unauthenticated.
- **Webhooks**: marks completed on `checkout.session.completed`; rejects bad signature (401, no status change); idempotent re-delivery; 404 unknown integration.
- **UI**: renders rows/totals; "Collect Payment" calls checkout + opens the hosted page; hides actions without `budget.manage`.

## Operator setup (per org, in the Integration Hub)

1. Connect **Stripe** (secret key + webhook signing secret) or **Square**
   (access token + location id + signature key).
2. Set `BASE_URL` to the public origin.
3. Add the provider webhook pointing at
   `{BASE_URL}/api/payments/webhooks/{provider}/{integrationId}`.
4. In an event's **Budget → Payments**, create a payment and click **Collect Payment**.
