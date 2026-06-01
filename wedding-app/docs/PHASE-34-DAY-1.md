# Phase 34 · Day 1 — Quick Create Event, ⌘N Shortcut & Inbound Webhooks

Three productivity features that make the platform faster to use and more integrable.

---

## 1. Create Event from Anywhere (⌘K + ⌘N)

**Problem:** Creating a new event required navigating to /events first, then clicking "New event." Venue owners managing 50+ events want faster access.

**Solution:**

### ⌘K Command Palette
Type "create", "new", or "event" in the command palette → "Create New Event" appears as an action. Click it → the Create Event dialog opens immediately, regardless of which page you're on.

### ⌘N Keyboard Shortcut
Press ⌘N (or Ctrl+N) from any page → Create Event dialog opens instantly.

### Dashboard Quick Action
The Dashboard already had a "View Events Pipeline" link — now the command palette bridges the gap.

### Implementation
- `CreateEventDialog` lifted from EventsList to the App shell level
- `createEventOpen` state in AuthenticatedApp
- ⌘N handler added to the existing keyboard event listener
- On event creation: auto-navigates to the new event's detail page
- Command palette item with keywords: ['new', 'create', 'add', 'event', 'wedding']

---

## 2. Inbound Webhook Receiver

The last major integration gap from INTEGRATIONS.md. External services (Calendly, Stripe, Zola) can now POST payloads to the platform.

### Endpoint
`POST /api/webhooks/inbound/:webhookId`

### Security
- **HMAC-SHA256 signature verification** — if a secret is configured on the webhook, the `X-Webhook-Signature` header must match
- Invalid signatures → 401
- Unknown webhook IDs → 404
- Inactive webhooks → 404

### What happens on receipt
1. Signature verified (if secret configured)
2. Payload logged to `audit_logs` with action `webhook.inbound.{eventType}`
3. Delivery recorded in `webhook_deliveries` 
4. SSE event broadcast to connected clients (`webhook.inbound`)
5. 200 OK returned to the sender

### Inbound URL Generation
`GET /api/webhooks/:id/inbound-url` — returns the full URL external services should POST to

### Tests: 5 integration tests
- Accepts payload + returns 200
- Returns 404 for unknown webhook
- Verifies HMAC signature (valid + invalid)
- Logs to audit log
- Records in webhook_deliveries

---

## Test Summary

| | Phase 33 | **Phase 34** | Δ |
|---|---|---|---|
| Server tests | 236 | **241** | **+5** |
| Client tests | 406 | **406** | 0 |
| **Total** | **642** | **647** | **+5** |
| Typecheck | clean | clean | — |
| Build | clean | clean | — |

---

## INTEGRATIONS.md Status Update

| Integration | Status |
|---|---|
| Encrypted credentials (AES-256-GCM) | ✅ |
| Integration registry + runtime | ✅ |
| Job queue + worker | ✅ |
| Admin REST endpoints | ✅ |
| First provider: Email (SMTP) | ✅ |
| Admin UI to manage integrations | ✅ Phase 20 |
| Outbound webhook (Zapier-style) | ✅ Phase 19 |
| **Inbound webhook receiver** | **✅ Phase 34** ← NEW |
| OAuth start/callback | ⏳ (requires provider API keys) |
| Calendly / Google Cal / etc. | ⏳ (requires OAuth) |

---

## Files Added (2)

```
server/src/routes/webhookReceiver.ts                       # Inbound webhook endpoint
server/src/routes/webhookReceiver.integration.test.ts       # 5 tests
docs/PHASE-34-DAY-1.md                                     # This file
```

## Files Modified (3)

```
server/src/index.ts                     # Register webhookReceiverRoutes
client/src/App.tsx                      # ⌘N shortcut + CreateEventDialog at app level + command palette item
docs/INTEGRATIONS.md                    # Mark inbound webhooks as ✅
```

---

## Platform Statistics (34 Phases)

| Category | Count |
|---|---|
| Database tables | 44 |
| API endpoints | **75+** |
| RBAC permissions | 71 |
| **Total tests** | **647** |
| Test files | 109 |
| Phases | 34 |
| Keyboard shortcuts | ⌘K (search) + **⌘N (create event)** |
| Command palette items | **16 static + dynamic events** |
