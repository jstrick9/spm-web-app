# Phase 20 · Day 1 — Budget Backend, Real-Time Notifications & Webhook UI

Phase 20 eliminates the three biggest "mock data" gaps remaining in the platform, replacing hardcoded `useState` arrays with real server-backed CRUD.

---

## 1. Budget Backend + Real Data Wiring

The Budget tab was using `useState` with hardcoded line items. Now it has a full backend.

### Database
```sql
CREATE TABLE budget_items (
  id, organization_id, event_id, category, title,
  planned_cents, actual_cents, paid_cents, vendor_id,
  notes, sort_order, created_by, created_at, updated_at
)
```

### Server
- `budgetRepo` — full CRUD + `totalsForEvent()` aggregate
- 4 RBAC-gated routes:
  - `GET /api/events/:eventId/budget` → `budget.view`
  - `POST /api/events/:eventId/budget` → `budget.manage`
  - `PATCH /api/budget/:id` → `budget.manage`
  - `DELETE /api/budget/:id` → `budget.manage`
- SSE broadcast on every mutation (`budget.updated`)

### Client
- `budgetSdk.list()`, `.create()`, `.update()`, `.delete()`
- `EventBudgetTab` completely rewritten:
  - Real KPI tiles (Planned / Actual / Paid / Remaining) computed from server
  - Variance % vs planned
  - DataTable with category badges, actual-vs-planned highlighting, balance status
  - Add Item dialog with category, title, dollar amount
  - Delete button (trash icon) per row
  - RBAC-gated: Add/Delete only visible if `budget.manage` permission
  - Totals footer row
- **7 server integration tests** + **5 client component tests**

### Before vs After
| Aspect | Before (Phase 17) | After (Phase 20) |
|---|---|---|
| Data source | Hardcoded `useState([...])` | Real SQLite table + API |
| Persistence | Lost on refresh | Server-persisted |
| RBAC | None | `budget.view` / `budget.manage` |
| Real-time | None | SSE broadcast on mutation |
| Add/Delete | Non-functional | Full CRUD |

---

## 2. Real-Time Notification Center (SSE-Driven)

The Notification Center was using hardcoded mock notifications. Now it's wired to SSE.

### How it works
1. `useRealtimeInvalidation` now dispatches a `CustomEvent('wvi:sse-event')` for every SSE event
2. `NotificationCenter` listens for these events via `window.addEventListener`
3. Each SSE event type maps to a notification:
   - `guest.created` → "New Guest Added"
   - `rsvp.submitted` → "New RSVP"
   - `event.created` → "New Event Created"
   - `budget.updated` → "Budget Changed"
   - etc.
4. Unread count badge (red dot with number)
5. Mark individual or all as read (persisted in localStorage)
6. Click notification → navigate to relevant page
7. Auto-accumulates up to 50 notifications

### Before vs After
| Aspect | Before | After |
|---|---|---|
| Data source | 3 hardcoded mock notifications | Real SSE events |
| Timing | Static (set once on mount) | Live (as events happen) |
| Read tracking | `useState` only | `localStorage` persisted |
| Navigation | Hardcoded URLs | Dynamic from event payload |

### Tests: 5 tests covering bell render, dropdown open, SSE event display, unread badge count, mark-all-read

---

## 3. Integration Hub → Real Webhook Management

The Integration Hub's webhook section was a static mockup. Now it's wired to the Phase 19 webhook backend.

### What changed
- **Webhook list**: Fetches real webhooks from `GET /api/orgs/:orgId/webhooks`
- **Active/paused status**: Toggle via `PATCH /api/webhooks/:id`
- **Delivery status**: Shows last HTTP status code + failure count
- **Test button**: Fires `POST /api/webhooks/:id/test`
- **Delete button**: `DELETE /api/webhooks/:id`
- **Add Webhook dialog**: Full form (URL, signing secret, description) → `POST /api/orgs/:orgId/webhooks`

### Tests: 4 tests covering catalog render, real webhook display, connect buttons, add webhook button

---

## Test Summary

| | Phase 19 Day 2 | **Phase 20 Day 1** | Δ |
|---|---|---|---|
| Server tests | 176 | **183** | **+7** |
| Client tests | 298 | **308** | **+10** |
| **Total** | **474** | **491** | **+17** |
| Typecheck | clean | clean | — |
| Build | clean | clean | — |

---

## Files Added (8)

```
server/src/db/migrations/0005_budget_items.sql          # Budget items table
server/src/db/repos/budget.ts                            # Budget CRUD repo
server/src/routes/budget.ts                              # 4 RBAC-gated budget endpoints
server/src/routes/budget.integration.test.ts             # 7 integration tests
client/src/sdk/budget.ts                                 # Budget SDK
docs/PHASE-20-DAY-1.md                                   # This file
```

## Files Modified (7)

```
server/src/db/repos/index.ts                        # Export budgetRepo
server/src/index.ts                                  # Register budgetRoutes
client/src/sdk/index.ts                              # Export budgetSdk
client/src/screens/events/budget/EventBudgetTab.tsx  # Rewritten: real server data
client/src/screens/events/budget/EventBudgetTab.test.tsx  # 5 new component tests
client/src/components/notifications/NotificationCenter.tsx  # Rewritten: SSE-driven
client/src/components/notifications/NotificationCenter.test.tsx  # 5 new tests
client/src/lib/useRealtimeInvalidation.ts            # Added SSE→CustomEvent bridge + budget.updated
client/src/screens/system/IntegrationHub.tsx          # Rewritten: real webhook management
client/src/screens/system/IntegrationHub.test.tsx     # 4 new tests
```

---

## How to Evaluate

```bash
cd wedding-app
npm run install:all
npm run migrate    # applies 0005_budget_items.sql
npm run seed
npm run dev:server # terminal 1
npm run dev:client # terminal 2
```

1. **Budget Tab**: Open event → Budget tab → click "Add Item" → fill category/title/amount → save → see it appear in the table with KPI tiles updating. Delete items. All persists to server.

2. **Notifications**: Open the bell icon in the top bar. Now add a guest or submit an RSVP from another tab or the public portal. Watch the notification appear in real-time with the red unread badge incrementing.

3. **Integration Hub**: Go to System → Integration Hub → right column now shows "Outbound Webhooks" with any configured webhooks. Click "Add Webhook" → enter a URL → create. Use the Send Test button. Toggle active/paused. Delete.
