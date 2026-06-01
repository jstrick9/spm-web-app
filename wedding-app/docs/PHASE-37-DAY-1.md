# Phase 37 · Day 1 — Session Hygiene, Event Quick Switcher & Logout Security

Three improvements focused on session security and navigation speed.

---

## 1. Cache Clear on Logout

**Problem:** When a user logged out and another user logged in on the same browser, React Query's in-memory cache still held data from the previous session — stale events, guests, vendors from a different org could briefly flash before fresh data loaded.

**Fix:** `queryClient.clear()` is now called during the logout handler, immediately before `setUser(null)`.

**What it clears:**
- All cached query data (events, guests, vendors, budget, etc.)
- All query state (loading, error, success)
- All mutation state
- Forces a fresh fetch for every query when the next user logs in

---

## 2. Event Quick Switcher

When you're deep inside an event's detail page (e.g. editing the budget, managing guests), there was no quick way to jump to another event — you had to navigate back to the Events list first.

**Now:** A "Switch event" dropdown appears in the EventDetail header, next to the event title and status badge:

```
← All events
Smith & Jones Wedding [Booked] [Switch event ▾]
                                 ┌─────────────────────────┐
                                 │ ● Davis Reception  10/18 │
                                 │ ● Baker Party      TBD  │
                                 │ ● Martinez Wedding 3/15 │
                                 └─────────────────────────┘
```

**Features:**
- Shows all other events (current event excluded)
- Color dots matching status (same palette as kanban columns)
- Sorted by date
- Shows "TBD" for events without a date
- Closes on outside click
- Click → navigates to that event's detail page

**Tests:** 3 tests (renders button, shows other events, shows dates/TBD)

---

## 3. Auth Session Tests

Added 2 new server integration tests:

| Test | What it validates |
|---|---|
| Logout returns ok | POST /api/auth/logout → 200 + `{ ok: true }` |
| Register creates org + owner membership | After registration, /api/auth/me returns ≥1 membership with roleKey='owner' |

---

## Test Summary

| | Phase 36 | **Phase 37** | Δ |
|---|---|---|---|
| Server tests | 255 | **257** | **+2** |
| Client tests | 411 | **414** | **+3** |
| **Total** | **666** | **671** | **+5** |
| Typecheck | clean | clean | — |
| Build | clean | clean | — |

---

## Files Added (3)

```
client/src/screens/events/EventQuickSwitcher.tsx         # Event dropdown switcher
client/src/screens/events/EventQuickSwitcher.test.tsx     # 3 tests
docs/PHASE-37-DAY-1.md                                   # This file
```

## Files Modified (3)

```
client/src/App.tsx                                       # queryClient.clear() on logout
client/src/screens/events/EventDetail.tsx                # EventQuickSwitcher in header
server/src/routes/auth.integration.test.ts               # +2 auth tests
```

---

## Platform Statistics (37 Phases)

| Category | Count |
|---|---|
| Database tables | 44 (7 migrations) |
| API endpoints | 75+ |
| RBAC permissions | 71 |
| **Total tests** | **671** |
| Test files | 113 (25 server + 88 client) |
| Phases | 37 |
| Event Detail features | Overview (KPIs + readiness + intelligence), 14 RBAC-gated tabs, **Quick Switcher**, Duplicate, Print, Check-In, Portal |
