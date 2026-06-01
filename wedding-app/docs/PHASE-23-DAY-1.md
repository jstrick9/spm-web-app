# Phase 23 · Day 1 — Vendor Check-In Backend, Invitation Tracking & Rich Seed Data

Three deliverables that close the final "local-only state" gaps and make the demo experience production-realistic.

---

## 1. Vendor Check-In Backend

The Vendor Check-In App (tablet-optimized QR scanner) was using `useState<Record<string, CheckInStatus>>({})` — status changes vanished on page refresh. Now it has a full server backend.

### Database
```sql
CREATE TABLE vendor_checkins (
  id, organization_id, event_id, vendor_id,
  status CHECK (IN 'expected','arrived','setup','completed','departed','late'),
  checked_in_at, checked_in_by, notes,
  UNIQUE (event_id, vendor_id)
)
```

### Server
- `checkinsRepo` — upsert (creates or updates), listForEvent, statusMap, counts
- 2 RBAC-gated endpoints:
  - `GET /api/events/:eventId/checkins` → `vendors.checkin.view`
  - `POST /api/events/:eventId/checkins` → `vendors.checkin.manage`
- SSE broadcast on every status change (`vendor.checkin`)

### Client
- `checkinsSdk.list(eventId)`, `.update(eventId, vendorId, status)`
- `VendorCheckInApp` completely rewritten:
  - Loads status from server via `useQuery`
  - Status changes POST to server via `useMutation`
  - Status persists across page refreshes and device changes
  - Service worker BackgroundSyncPlugin ensures offline check-ins retry when WiFi returns
- **4 tests** (vendor list, Mark Arrived button, scan button, filter buttons)

---

## 2. Invitation Tracking Backend

The Invite tab was using `Math.random() > 0.5` to randomly assign sent/opened status. Now there's a real tracking system.

### Database
```sql
CREATE TABLE invite_tracking (
  id, organization_id, event_id, guest_id,
  status CHECK (IN 'not_sent','sent','opened','bounced'),
  sent_at, opened_at, channel,
  UNIQUE (event_id, guest_id)
)
```

### Server
- `inviteTrackingRepo` — upsert, statusMap, counts, bulkSend
- 3 RBAC-gated endpoints:
  - `GET /api/events/:eventId/invite-tracking` → `invites.view`
  - `POST /api/events/:eventId/invite-tracking/send` → `invites.send` (bulk)
  - `PATCH /api/events/:eventId/invite-tracking/:guestId` → `invites.manage`
- **4 integration tests** (empty initial, bulk send, individual status update, auth)

### Client
- `inviteTrackingSdk.list()`, `.bulkSend()`, `.updateStatus()`

---

## 3. Rich Seed Data

The demo seed expanded from minimal data to a production-realistic scenario:

| Data | Before (Phase 22) | After (Phase 23) |
|---|---|---|
| Events | 1 (Smith & Jones, booked) | **4** (booked, planning, lead, completed) |
| Guests | 5 (no RSVPs, no tables) | **28** (varied RSVPs, tables, dietary, parties, accessibility) |
| Vendors | 1 (Sunshine DJs) | **5** (DJ, Florist, Photo, Bakery, Rentals) with payments |
| Budget items | 0 | **7** (Venue, Catering, Florals, Photo, DJ, Cake, Rentals) |
| Timeline items | 2 | **9** (full day: load-in through send-off) |
| Contracts | 0 | **2** (Master Agreement, Photography Package) |
| Staff tasks | 1 | **5** (pre-event, during-event, post-event) |
| Inventory | 0 | **5** (chairs, linens, lights, vases, uplights) |
| Catalog | 6 | **8** (added cocktail table, navy linen) |

The demo now feels like a real venue operation on Day 1.

---

## Test Summary

| | Phase 22 | **Phase 23** | Δ |
|---|---|---|---|
| Server tests | 189 | **196** | **+7** |
| Client tests | 318 | **321** | **+3** |
| **Total** | **507** | **517** | **+10** |
| Typecheck | clean | clean | — |
| Build | clean | clean | — |

---

## Files Added (10)

```
server/src/db/migrations/0007_checkins_invites.sql          # Check-in + invite tables
server/src/db/repos/checkins.ts                              # Check-in CRUD repo
server/src/db/repos/inviteTracking.ts                        # Invite tracking repo
server/src/routes/checkins.ts                                # 2 RBAC-gated endpoints
server/src/routes/inviteTracking.ts                          # 3 RBAC-gated endpoints
server/src/routes/checkins-invites.integration.test.ts       # 7 integration tests
client/src/sdk/checkins.ts                                   # Check-in SDK
client/src/sdk/inviteTracking.ts                             # Invite tracking SDK
docs/PHASE-23-DAY-1.md                                      # This file
```

## Files Modified (6)

```
server/src/db/repos/index.ts                    # +2 repo exports
server/src/index.ts                             # +2 route registrations
server/src/db/seed.ts                           # Expanded: 4 events, 28 guests, 5 vendors, etc.
client/src/sdk/index.ts                         # +2 SDK exports
client/src/screens/checkin/VendorCheckInApp.tsx  # Rewritten: server-backed check-ins
client/src/screens/checkin/VendorCheckInApp.test.tsx  # Updated: 4 tests
```

---

## Platform Statistics After Phase 23

| Metric | Count |
|---|---|
| Database tables | **44** (7 migrations) |
| RBAC permissions | **71** across 27 categories |
| API endpoints | **60+** (all RBAC-gated) |
| Server test files | 18 |
| Client test files | 67 |
| **Total tests** | **517** |
| Typecheck errors | 0 |
| Build warnings | 0 |
| Production mock data | **0** |
