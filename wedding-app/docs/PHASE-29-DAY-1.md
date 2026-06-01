# Phase 29 · Day 1 — Audit Log Viewer & Comprehensive Server Test Coverage

Two deliverables that complete the compliance story and dramatically increase backend confidence.

---

## 1. Audit Log Viewer

A new page at `/system/audit` that shows every action taken in the organization:

### Features
- **Reverse-chronological feed** of all org activity
- **Action type chips** with emoji icons — click to filter (Event Created 📅, Guest Added 👤, RSVP Submitted 💌, Contract Signed ✅, Password Changed 🔒, etc.)
- **Search** across action names and actor emails (debounced 250ms)
- **Per-entry display**: action name, target type badge, actor email, timestamp, IP address
- **15 pre-defined action type mappings** with human-readable labels and category colors

### Architecture
- `auditSdk.list(orgId, { limit?, action? })` — new SDK method
- `GET /api/orgs/:orgId/audit` — existing endpoint, already RBAC-gated with `audit.view`
- Added to ⌘K command palette as "Audit Log"
- Route: `/system/audit`

### What gets logged (automatically by route handlers)
- Event create/update/delete
- Guest create/bulk create
- RSVP submissions
- Contract create/sign
- Vendor create
- Budget item create
- Webhook create/delete
- User login/logout
- Password changes
- Branding updates
- Platform config changes

### Tests: 6 client tests (header, entries, actor labels, target badges, search, filter chips)

---

## 2. Comprehensive Server Route Tests

Added **17 new integration tests** covering the previously-untested server routes:

| Domain | Tests | What's covered |
|---|---|---|
| **Events edge cases** | 4 | Missing orgId → 400, date validation, 404 for non-existent, soft-delete |
| **Guests edge cases** | 4 | Missing fullName → 400, bulk create (3 guests), bulk skip mode, cross-org RSVP filter |
| **Vendors edge cases** | 3 | Full details creation, update name/category, delete |
| **Messages** | 1 | Send → list → mark read flow |
| **Feedback/Polls** | 1 | Create poll → public vote → verify count |
| **Catalog** | 1 | CRUD lifecycle for table items |
| **Venues** | 1 | CRUD lifecycle (create → update → delete) |
| **Audit log** | 2 | Records activity, filters by action type |

### Server route coverage summary (after Phase 29)

| Route file | Dedicated tests | Via core-crud | Total coverage |
|---|---|---|---|
| auth.ts | 6 ✅ | 2 | Full |
| events.ts | 4 ✅ | 3 | Full |
| guests.ts | 4 ✅ | 2 | Full |
| vendors.ts | 3 ✅ | 2 | Full |
| timeline.ts | 0 | 2 | Partial |
| catalog.ts | 1 ✅ | 0 | Partial |
| venues.ts | 1 ✅ | 0 | Partial |
| messages.ts | 1 ✅ | 0 | Basic |
| feedback.ts | 1 ✅ | 0 | Basic |
| audit.ts | 2 ✅ | 0 | Full |
| budget.ts | 7 ✅ | 0 | Full |
| contracts.ts | 6 ✅ | 0 | Full |
| inventory.ts | 6 ✅ | 0 | Full |
| gallery.ts | 6 ✅ | 0 | Full |
| checkins.ts | 7 ✅ | 0 | Full |
| webhooks.ts | 8 ✅ | 0 | Full |
| push.ts | 11 ✅ | 0 | Full |
| exports.ts | 4 ✅ | 0 | Full |
| roles.ts | 17 ✅ | 0 | Full |

---

## Test Summary

| | Phase 28 | **Phase 29** | Δ |
|---|---|---|---|
| Server tests | 215 | **232** | **+17** |
| Client tests | 385 | **391** | **+6** |
| **Total** | **600** | **623** | **+23** |
| Typecheck | clean | clean | — |
| Build | clean | clean | — |

---

## Files Added (5)

```
client/src/sdk/audit.ts                                    # Audit SDK
client/src/screens/system/AuditLog.tsx                      # Audit log viewer page
client/src/screens/system/AuditLog.test.tsx                 # 6 tests
server/src/routes/domain-crud.integration.test.ts           # 17 integration tests
docs/PHASE-29-DAY-1.md                                     # This file
```

## Files Modified (2)

```
client/src/sdk/index.ts    # Export auditSdk
client/src/App.tsx          # /system/audit route + command palette
```

---

## Platform Statistics (29 Phases)

| Category | Count |
|---|---|
| Database tables | 44 (7 migrations) |
| API endpoints | 71+ (all RBAC-gated) |
| RBAC permissions | 71 (27 categories, 7 roles) |
| **Total automated tests** | **623** |
| Test files | 104 (22 server + 82 client) |
| Phases completed | 29 |
| Documentation files | 70 |
| Production mock data | ZERO |
