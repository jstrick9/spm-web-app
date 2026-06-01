# Phase 18 · Day 1 — Cross-Event Guest Browser, Event Settings Editor, Real-Time SSE Bus & WebPush Subscriptions

Phase 18 picks up where Phase 17 left off and focuses on **production-readiness** — completing high-impact placeholder features and adding the real-time infrastructure that transforms the app from a refresh-to-see-changes tool into a live operational platform.

## What's Built

### 1. Cross-Event Guest Browser (`/guests`)
The long-standing placeholder ("arrives in Week 1 Day 2") is now a full-featured guest management screen that aggregates guests **across all events** in the organization.

**Backend (server)**
- `guestsRepo.listForOrg()` — paginated SQL query with `JOIN events` for event titles, full-text search across name/email/party, RSVP status filtering, event filtering, `LIMIT`/`OFFSET`.
- `guestsRepo.countByStatusForOrg()` — aggregate RSVP counts across the entire org.
- `GET /api/orgs/:orgId/guests` — RBAC-gated (`guests.view`), accepts `?search=`, `?rsvpStatus=`, `?eventId=`, `?limit=`, `?offset=`.

**Frontend (`CrossEventGuestBrowser.tsx`)**
- **KPI band**: Total guests, Attending, Pending, Declined — real numbers from the server.
- **Search**: Full-text, debounced 250ms, across name/email/party.
- **RSVP filter chips** with live counts (All, Attending, Pending, Declined, Maybe).
- **Event filter dropdown**: Populated from `sdk.events.list`, filters to a single event.
- **Paginated table** (25/page) with columns: Name, Contact (email+phone), Party, Event (click-through link), RSVP (inline editable), Table, Notes (dietary/accessibility icons).
- **Inline RSVP editing**: Click the badge → dropdown → patch → toast confirmation.
- **CSV Export**: One-click download with all visible columns.
- **7 tests** (page header, KPI tiles, guest rows, event titles, search input, filter chips, export button).

### 2. Event Settings Inline Editor (replaces "Coming Soon")
The Settings tab in EventDetail now has a complete react-hook-form + zod editor.

**`EventSettingsForm.tsx`**
- **Title editing**: 1–200 character validation.
- **Pipeline status**: Full dropdown with status descriptions.
- **Date pickers**: Start/end date with cross-field validation (end ≥ start).
- **Guest count**: Non-negative integer.
- **Budget**: Dollar input with `$` prefix, auto-converts to cents on save.
- **Sticky save bar**: Appears when form is dirty, with Discard + Save buttons.
- **Danger zone**: Delete event with typed `DELETE` confirmation dialog.
- **Optimistic cache invalidation**: Updates both `['event', id]` and `['events']` caches.
- **6 tests** covering form rendering, dirty state, budget conversion, danger zone.

### 3. Server-Sent Events (SSE) Real-Time Bus
Enables any connected browser tab to receive live mutation notifications without polling.

**Backend**
- `sse_events` table (migration `0003`) — durable ordered log with auto-incrementing cursor.
- `sseEventsRepo` — publish, listAfter (catch-up), latestId, pruneOlderThan.
- `GET /api/orgs/:orgId/events/stream` — SSE endpoint (JWT via query param since EventSource can't send headers). Sends catch-up events on connect, then live push via in-memory subscriber registry.
- `broadcastSSE()` — called from mutation routes, persists to DB + pushes to connected clients.
- `POST /api/orgs/:orgId/events/broadcast` — admin-only manual broadcast endpoint.
- 30-second heartbeat to keep connections alive through proxies.
- Automatic cleanup on client disconnect.

**Client**
- `sdk/sse.ts` — `createSSEStream(orgId)` returns a managed EventSource with `.on(type, handler)`, `.off()`, `.close()`, auto-reconnect.
- `useSSE` hook — React lifecycle wrapper: connects on mount, cleans up on unmount, dispatches events to type-specific + wildcard handlers.
- `useRealtimeInvalidation` hook — maps SSE event types to React Query invalidation:
  - `guest.created` / `guest.updated` / `rsvp.submitted` → invalidate `['guests']` + `['org-guests']`
  - `event.created` / `event.updated` → invalidate `['events']` + `['event', eventId]`
- Wired into `AuthenticatedApp` — every authenticated page auto-refreshes when any user (or the public portal) makes a mutation.
- **5 tests** for `useSSE` + **4 tests** for `useRealtimeInvalidation`.

**SSE broadcasts wired into routes:**
- `POST /api/events` → `event.created`
- `PATCH /api/events/:id` → `event.updated`
- `POST /api/events/:eventId/guests` → `guest.created`
- `PATCH /api/guests/:id` → `guest.updated`
- `POST /api/portal/:eventId/rsvp` → `rsvp.submitted`

### 4. WebPush Subscription Backend
Completes the push notification loop that was started with the service worker in Phase 17.

**Backend**
- `push_subscriptions` table (migration `0003`) — stores endpoint, p256dh key, auth key per user per org.
- `pushSubscriptionsRepo` — upsert (same endpoint → update keys), listForUser, listForOrg, deleteByEndpoint, deleteById.
- `POST /api/push/subscribe` — creates/updates subscription (zod-validated).
- `DELETE /api/push/subscribe` — unsubscribes by endpoint.
- `GET /api/push/subscriptions` — lists current user's subscriptions.
- `GET /api/push/vapid-key` — returns the VAPID public key (from env var).
- **11 integration tests**: VAPID key, subscribe, upsert, list, unsubscribe, validation, auth requirement.

**Client SDK**
- `pushSdk.getVapidKey()`, `.subscribe()`, `.unsubscribe()`, `.listSubscriptions()`.

## Database Migration

```sql
-- 0003_push_subscriptions.sql
CREATE TABLE push_subscriptions (…)   -- WebPush subscription storage
CREATE TABLE sse_events (…)           -- Durable SSE event log
```

## Test Totals

| Scope | Before Phase 18 | **After Phase 18** | Δ |
|---|---|---|---|
| Server tests | 146 passing | **157** passing | +11 |
| Client tests | 275 passing | **297** passing | +22 |
| **Total passing** | 421 | **454** | **+33** |
| Typecheck (server) | clean | clean | — |
| Typecheck (client) | clean | clean | — |
| Build (production) | clean | clean | — |

## Files Added (Phase 18)

```
server/src/db/migrations/0003_push_subscriptions.sql      # NEW — push subs + SSE tables
server/src/db/repos/pushSubscriptions.ts                    # NEW — push sub CRUD
server/src/db/repos/sseEvents.ts                            # NEW — SSE event log repo
server/src/routes/push.ts                                   # NEW — push subscription endpoints
server/src/routes/sse.ts                                    # NEW — SSE stream + broadcastSSE()
server/src/routes/push.integration.test.ts                  # NEW — 11 integration tests
client/src/sdk/push.ts                                      # NEW — push SDK methods
client/src/sdk/sse.ts                                       # NEW — createSSEStream()
client/src/lib/useSSE.ts                                    # NEW — React SSE hook
client/src/lib/useSSE.test.ts                               # NEW — 5 tests
client/src/lib/useRealtimeInvalidation.ts                   # NEW — auto-invalidation hook
client/src/lib/useRealtimeInvalidation.test.ts              # NEW — 4 tests
client/src/screens/guests/CrossEventGuestBrowser.tsx        # NEW — full guest browser
client/src/screens/guests/CrossEventGuestBrowser.test.tsx   # NEW — 7 tests
client/src/screens/events/settings/EventSettingsForm.tsx    # NEW — inline editor
client/src/screens/events/settings/EventSettingsForm.test.tsx # NEW — 6 tests
docs/PHASE-18-DAY-1.md                                     # this file
```

## Files Modified (Phase 18)

```
server/src/db/repos/index.ts          # exports pushSubscriptionsRepo, sseEventsRepo
server/src/db/repos/guests.ts         # listForOrg(), countByStatusForOrg()
server/src/routes/guests.ts           # GET /api/orgs/:orgId/guests, broadcastSSE calls
server/src/routes/events.ts           # broadcastSSE calls on create/update
server/src/index.ts                   # registers pushRoutes, sseRoutes, feedbackRoutes
client/src/sdk/index.ts               # exports pushSdk, createSSEStream
client/src/sdk/guests.ts              # listForOrg() method
client/src/screens/events/EventDetail.tsx  # Settings tab → EventSettingsForm (removed old SettingsTab)
client/src/App.tsx                     # /guests → CrossEventGuestBrowser, useRealtimeInvalidation
```

## How to Evaluate

```bash
cd wedding-app
npm run install:all
npm run migrate        # applies 0003_push_subscriptions.sql
npm run seed
npm run dev:server     # terminal 1
npm run dev:client     # terminal 2
```

1. **Log in** → sidebar **Guests** → see the cross-org browser with KPI tiles, search, filters, pagination.
2. Open any **Event Detail** → **Settings tab** → edit title, dates, budget → see the sticky save bar → save → toast confirmation.
3. **Delete event**: Settings → Danger Zone → Delete → type DELETE → confirm → navigates back to events list.
4. **Real-time**: Open the app in two browser tabs. In tab A, add a guest. Watch the guest list in tab B auto-refresh (SSE-driven).
5. **Public portal → dashboard**: Open the guest portal, submit an RSVP. Watch the dashboard's guest counts update in real-time.

## What's Next (Phase 18 Day 2 candidates)

Ordered by risk/impact:

1. **Chat server sync** — currently IndexedDB-only; wire chat messages through the existing `direct_messages` table + SSE for real-time delivery.
2. **OAuth infrastructure for integrations** — `INTEGRATIONS.md` lists Calendly, Google Calendar, Outlook as ⏳; the OAuth start/callback flow needs to be built.
3. **Vendor portal push notifications** — when a timeline item changes that affects a vendor, send a WebPush notification using the new subscription backend.
4. **Server-side event deletion** — the DELETE endpoint exists but the soft-delete needs cascade logic for layouts/guests/vendors.
5. **Dashboard widget data connections** — some widget registry entries still use placeholder data; wire them to the SSE event stream for live KPI updates.
