# Phase 19 · Day 1 — Vendor Directory, Live Dashboard Widgets, RBAC-Aware UI & Server-Synced Chat

Phase 19 addresses four high-impact gaps that transform the app from "feature-complete prototype" into "production-ready platform."

---

## What's Built

### 1. Cross-Event Vendor Directory (`/vendors`)

The sidebar "Vendors" link previously crashed to the dashboard (no route handler). Now it opens a full-featured vendor directory.

**`VendorDirectory.tsx`** (206 lines)
- **Financial KPI tiles**: Total Vendors, Contracted, Paid, Outstanding — all computed from real data
- **Search**: Full-text across name, contact, category, email (debounced 250ms)
- **Category filter chips**: Auto-generated from vendor data with counts
- **Vendor card grid**: Each card shows:
  - Name + preferred star badge + category color tag
  - Contact links (email, phone, website)
  - Financial progress bar (paid vs contracted, with remaining balance)
  - Event link (click through to event's vendor tab)
- **7 tests** covering: header/KPIs, vendor names, preferred badges, categories, search input, search filtering, financial data display

### 2. Live Dashboard Widgets (No More Placeholder Data)

Every KPI widget in the registry now queries real data from the server.

**Widgets rewired to real data:**

| Widget | Data Source | What it shows |
|---|---|---|
| **Booking Conversion** | `sdk.events.list()` | % of leads that became booked/planning/completed |
| **Avg Revenue per Event** | `sdk.events.list()` | Mean budget across events with budgets set |
| **RSVP Velocity** | `sdk.guests.listForOrg()` | Total responded RSVPs vs pending count |
| **Calendar Vacancy** | `sdk.events.list()` → counts | Leads + holds in pipeline |
| **Guest Count** (event) | `sdk.guests.list(eventId)` | Total guests with attending/declined/pending breakdown |
| **RSVP Response Rate** (event) | `sdk.guests.list(eventId)` | % responded vs industry benchmark |
| **Dietary Breakdown** (event) | `sdk.guests.list(eventId)` | Auto-bucketed from dietary_restrictions field |
| **Timeline Density** (event) | `sdk.timeline.list(eventId)` | Hour-by-hour bar chart from real timeline items |
| **Event Countdown** (portal) | `sdk.events.get(eventId)` | Days until start_date |

All widgets show a loading spinner while data fetches, and "—" when no data exists yet.

### 3. Client-Side RBAC Hook (`usePermission`)

A React hook that checks whether the current user has a specific permission — used to hide UI elements the user would get 403'd on.

**`usePermission.ts`** (83 lines)
- `setPermissionContext(orgId, memberships)` — called once in `AuthenticatedApp`
- `usePermission('budget.manage')` → `boolean` — checks user's role grants
- `usePermissions(['budget.view', 'reports.view'])` → `Record<string, boolean>` — batch check
- Fetches role definitions from `sdk.roles.listRoles()` with 5-minute cache
- **4 tests**: has-permission, lacks-permission, batch-check, empty-memberships

### 4. Server-Synced Chat (Dual-Write: Server-First + IndexedDB Fallback)

The Chat system was previously IndexedDB-only. It now syncs with the server's `direct_messages` table.

**`ChatSystem.tsx` rewritten** (208 lines)
- **On mount**: Fetches from `GET /api/messages/:threadId` (server-first)
- **Merges**: Server messages + any un-synced local messages, sorted by timestamp
- **On send**: `POST /api/messages/:threadId` → server-first; on success marks as `synced: true`
- **Offline fallback**: If server unreachable, saves to IndexedDB with `synced: false`
- **Status indicator**: Wifi/WifiOff icon in header shows connection state
- **Pending badge**: Un-synced messages show a yellow dot next to timestamp
- **Thread IDs**: `{eventId}:{category}` format (general, layout, logistics, vendors, urgent)

---

## Route Table Updates

| Route | Component | Status |
|---|---|---|
| `/vendors` | `VendorDirectory` | **NEW** (was dead link) |
| `/guests` | `CrossEventGuestBrowser` | Phase 18 |
| `/events/:id` → Chat tab | `ChatSystem` | **Rewritten** (server-synced) |
| Dashboard | `WidgetSlot` → registry | **Rewired** (real data) |

---

## Test Summary

| | Phase 18 Day 2 | **Phase 19 Day 1** | Δ |
|---|---|---|---|
| Server tests | 168 passing | **168 passing** | 0 |
| Client tests | 287 passing | **298 passing** | **+11** |
| **Total** | **455** | **466** | **+11** |
| Typecheck (server) | clean | clean | — |
| Typecheck (client) | clean | clean | — |
| Build | clean | clean | — |

### New tests (11)
- `VendorDirectory.test.tsx` — 7 tests (header, cards, badges, categories, search, filter, financials)
- `usePermission.test.ts` — 4 tests (has-perm, lacks-perm, batch, empty)

---

## Files Added

```
client/src/screens/vendors/VendorDirectory.tsx           # Cross-event vendor directory
client/src/screens/vendors/VendorDirectory.test.tsx       # 7 tests
client/src/lib/usePermission.ts                           # RBAC-aware UI hook
client/src/lib/usePermission.test.ts                      # 4 tests
docs/PHASE-19-DAY-1.md                                    # this file
```

## Files Modified

```
client/src/config/widgets/registry.tsx     # All widgets rewired to real SDK data
client/src/screens/events/chat/ChatSystem.tsx  # Rewritten: server-first + IndexedDB fallback
client/src/App.tsx                         # Added /vendors route, setPermissionContext
```

---

## How to Evaluate

```bash
cd wedding-app
npm run dev:server   # terminal 1
npm run dev:client   # terminal 2
```

1. **Vendors**: Click "Vendors" in sidebar → see the vendor directory with category filters, search, and financial progress bars.
2. **Dashboard**: Dashboard KPI tiles now show real data (booking conversion %, avg revenue, RSVP velocity from actual guests).
3. **Chat**: Open an event → Chat tab → send a message. It POSTs to the server. Refresh the page — the message persists (server-stored). Go offline → send another → see the yellow dot (pending sync). Come back online → message syncs.
4. **Event Widgets**: Open any event → Overview tab. Guest Count and RSVP Rate now query the real guest list. Dietary Breakdown shows actual guest dietary data. Timeline Density shows hour-by-hour density from timeline items.

---

## What's Next (Phase 19 Day 2 candidates)

1. **RBAC-gated UI** — use the `usePermission` hook to hide event tabs (budget, contracts, etc.) from users who lack the corresponding view permission
2. **OAuth integration infrastructure** — build the OAuth start/callback flow for Calendly, Google Calendar
3. **Outbound webhook engine** — POST event payloads to user-configured URLs (Zapier/Make)
4. **Cross-event reporting** — wire the Analytics Dashboard to aggregate real vendor + financial data
