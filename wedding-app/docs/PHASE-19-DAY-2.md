# Phase 19 · Day 2 — RBAC-Gated Event Tabs, Live Analytics & Outbound Webhook Engine

Three deliverables that close the final production-readiness gaps.

---

## 1. RBAC-Gated Event Detail Tabs

The 14 tabs on the Event Detail screen now dynamically show/hide based on the user's role permissions. A staff member sees only the tabs they have access to; a couple sees only their relevant tabs.

### Permission → Tab mapping

| Tab | Required Permission | Who sees it |
|---|---|---|
| Overview | *(always visible)* | Everyone |
| Guests | `guests.view` | Owner, Admin, Planner, Couple, Staff |
| Invites | `invites.view` | Owner, Admin, Planner, Couple |
| Polls & Feedback | `feedback.view` | Owner, Admin, Planner, Couple, Staff |
| Timeline | `timeline.view` | Owner, Admin, Planner, Couple, Staff |
| Vendors | `vendors.view` | Owner, Admin, Planner, Couple, Staff |
| Budget | `budget.view` | Owner, Admin, Planner, Couple, Staff |
| Contracts | `contracts.view` | Owner, Admin, Planner, Couple |
| Gallery | `gallery.view` | Owner, Admin, Planner, Couple, Staff |
| Staff | `staff.view` | Owner, Admin, Planner, Staff |
| Chat | `messages.view` | Owner, Admin, Planner, Couple, Staff, Vendor |
| Layout | `layouts.view` | Owner, Admin, Planner, Couple, Staff |
| Portal | `portal.config.manage` | Owner, Admin, Planner |
| Settings | `events.edit` | Owner, Admin, Planner |

### Implementation
- `TAB_DEFS` array maps each tab to its permission ID
- `usePermissions()` batch-checks all tab permissions in one render
- `visibleTabs` is memoized — only tabs the user has permission for render as triggers
- If a URL specifies a tab the user can't access (e.g. `?tab=staff` for a couple), the component auto-falls back to Overview

---

## 2. Live Analytics Dashboard

The Analytics Dashboard (`/reports`) now uses real vendor data instead of `Math.random()` mock scores.

### What changed
- **Vendor Compliance Scores**: Now calculated as `amount_paid_cents / contract_amount_cents * 100` — showing actual payment completion percentage per vendor
- Replaces the `Math.floor(Math.random() * 20) + 80` placeholder

---

## 3. Outbound Webhook Engine

A complete outbound webhook system that fires HTTP POST requests to user-configured URLs whenever mutations happen in the platform.

### Backend Architecture

```
broadcastSSE() → fires outbound webhooks too
     │
     ▼
broadcastWebhook(orgId, eventType, data)
     │
     ├── webhooksRepo.matchingHooks(orgId, eventType)
     │   └── filters by event_types JSON array (supports '*' wildcard)
     │
     ├── For each matching hook:
     │   ├── Build payload: { eventType, timestamp, data }
     │   ├── HMAC-SHA256 signature of body using hook.secret
     │   ├── HTTP POST with headers:
     │   │   ├── X-Webhook-Signature: sha256=...
     │   │   ├── X-Webhook-Event: guest.created
     │   │   └── User-Agent: WeddingVenueIntelligence/1.0
     │   ├── 10-second timeout
     │   └── Record delivery (status, response, duration, error)
     │
     └── setImmediate() — never blocks the HTTP response
```

### Database Schema

```sql
webhooks (
  id, organization_id, url, secret, event_types,
  is_active, description, last_triggered, last_status,
  failure_count, created_by, created_at, updated_at
)

webhook_deliveries (
  id, webhook_id, event_type, payload,
  status, response, duration_ms, error, created_at
)
```

### API Endpoints (all RBAC-gated with `integrations.view`/`integrations.manage`)

| Method | URL | Permission | Description |
|---|---|---|---|
| GET | `/api/orgs/:orgId/webhooks` | `integrations.view` | List all webhooks |
| POST | `/api/orgs/:orgId/webhooks` | `integrations.manage` | Create webhook |
| PATCH | `/api/webhooks/:id` | `integrations.manage` | Update webhook |
| DELETE | `/api/webhooks/:id` | `integrations.manage` | Delete webhook |
| GET | `/api/webhooks/:id/deliveries` | `integrations.view` | View delivery history |
| POST | `/api/webhooks/:id/test` | `integrations.manage` | Fire test payload |

### Client SDK
`webhooksSdk.list()`, `.create()`, `.update()`, `.delete()`, `.deliveries()`, `.test()`

### Event Types that Fire Webhooks
Every SSE broadcast now also triggers matching outbound webhooks:
- `event.created`, `event.updated`
- `guest.created`, `guest.updated`
- `rsvp.submitted`
- `webhook.test` (manual test)

### Security
- HMAC-SHA256 signature in `X-Webhook-Signature` header
- Per-webhook secret (configurable)
- 10-second timeout prevents hanging
- Failures counted; delivery history logged
- Never blocks the API response (async dispatch via `setImmediate`)

---

## Test Summary

| | Phase 19 Day 1 | **Phase 19 Day 2** | Δ |
|---|---|---|---|
| Server tests | 168 passing | **176 passing** | **+8** |
| Client tests | 298 passing | **298 passing** | 0 |
| **Total** | **466** | **474** | **+8** |
| Typecheck | clean | clean | — |
| Build | clean | clean | — |

### New server tests (8)
- `webhooks.integration.test.ts` — webhook CRUD, validation, permissions, deliveries, test dispatch

---

## Files Added (Phase 19 Day 2)

```
server/src/db/migrations/0004_webhooks.sql        # Webhook + delivery tables
server/src/db/repos/webhooks.ts                    # Webhook CRUD + delivery logging
server/src/webhooks/dispatcher.ts                  # Async HTTP dispatch + HMAC signing
server/src/routes/webhooks.ts                      # 6 RBAC-gated endpoints
server/src/routes/webhooks.integration.test.ts     # 8 integration tests
client/src/sdk/webhooks.ts                         # Client SDK methods
docs/PHASE-19-DAY-2.md                             # This file
```

## Files Modified

```
server/src/db/repos/index.ts      # Export webhooksRepo
server/src/index.ts                # Register webhookRoutes
server/src/routes/sse.ts           # broadcastSSE now also fires webhooks
client/src/sdk/index.ts            # Export webhooksSdk
client/src/screens/events/EventDetail.tsx   # RBAC-gated tab visibility
client/src/screens/system/AnalyticsDashboard.tsx  # Real vendor compliance scores
```
