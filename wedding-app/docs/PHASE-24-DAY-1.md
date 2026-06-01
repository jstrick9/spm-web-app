# Phase 24 · Day 1 — Invites Tab Server Wiring, SW Fix & Comprehensive Test Coverage

Phase 24 eliminates the last `Math.random()` usage in production code, fixes the service worker route mismatch, and adds 22 new tests covering the most critical user flows.

---

## 1. Invites Tab → Real Server Data

The Invitation Builder's "Send to Guests" button was using `Math.random() > 0.5` to simulate sent/opened status. Now it calls the real invite tracking backend (built in Phase 23).

### What changed
- **Send to Guests**: Calls `sdk.inviteTracking.bulkSend(eventId)` → `POST /api/events/:eventId/invite-tracking/send`
- **Tracking view**: Reads `sdk.inviteTracking.list(eventId)` → real statusMap from server
- **KPI tiles**: Total Guests, Invites Sent, Opened, Open Rate — all from real counts
- **Per-guest status**: Shows "Not Sent", "Sent", "Opened", "Bounced" from server data
- **6 tests**: builder view, send button, tracking toggle, guest list, preview blocks, add block

### Result
**Zero `Math.random()` calls remain in any production screen.** Every data display in the app is now server-backed.

---

## 2. Service Worker Route Fix

The service worker's BackgroundSyncPlugin was intercepting `/api/vendors/.*/checkin` (old pattern) but the actual endpoint is `/api/events/:eventId/checkins` (Phase 23).

**Before**: `registerRoute(/\/api\/vendors\/.*\/checkin/i, ...)`  
**After**: `registerRoute(/\/api\/events\/.*\/checkins/i, ...)`

Now when a coordinator checks in a vendor on their iPad in the parking lot and WiFi drops, the POST to `/api/events/:eventId/checkins` is caught by the BackgroundSyncPlugin and retried automatically when connectivity returns.

---

## 3. Comprehensive Test Coverage

Added tests for the three most critical untested surfaces:

### EventDetail (5 tests)
- Renders event title from server data
- Renders date and guest count in header
- Renders Overview tab KPI tiles by default
- Shows all RBAC-allowed tabs (with proper permission mocking)
- Renders action buttons (View Portal, Print Run Sheet, Check-In)

### PublicGuestPortal (6 tests)
- Renders event title from portal info API
- Renders event date
- Renders bottom navigation (Home, Map, RSVP)
- Shows hero banner on home tab
- Switches to RSVP tab showing form
- Shows guest dropdown options

### Core Server CRUD (8 tests)
- Auth flow: register → login → me returns same user
- Auth: wrong password returns 401
- Event lifecycle: create → get → update → list → delete
- Guest lifecycle: create → list → update RSVP → verify counts → delete
- Vendor + payment: create → add payment → list payments
- Timeline CRUD: create → list → update → delete
- Public portal info: returns event + guest list without auth
- RSVP submission: works without auth, updates guest status

---

## Test Summary

| | Phase 23 | **Phase 24** | Δ |
|---|---|---|---|
| Server tests | 196 | **204** | **+8** |
| Client tests | 321 | **335** | **+14** |
| **Total** | **517** | **539** | **+22** |
| Typecheck | clean | clean | — |
| Build | clean | clean | — |
| Math.random in prod | 1 (invites) | **0** | ✅ |

---

## Files Added (4)

```
client/src/screens/events/EventDetail.test.tsx           # 5 tests
client/src/screens/portal/PublicGuestPortal.test.tsx      # 6 tests
server/src/routes/core-crud.integration.test.ts           # 8 tests
docs/PHASE-24-DAY-1.md                                    # This file
```

## Files Modified (3)

```
client/src/screens/events/invites/EventInvitesTab.tsx     # Rewritten: server-backed tracking
client/src/screens/events/invites/EventInvitesTab.test.tsx # 6 tests updated
client/src/sw.ts                                           # Fixed check-in route pattern
```
