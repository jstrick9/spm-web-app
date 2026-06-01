# Phase 26 · Day 1 — Data Exports, Team Member Management & Intelligence Dashboard

Three high-impact UX completions that transform the platform from "feature-complete" to "ready for a real venue to operate."

---

## 1. Working Data Exports

The Integration Hub had three "Export" buttons that did nothing. Now they download real files:

### Server Endpoints (3 new, all RBAC-gated)
| Endpoint | Permission | Output |
|---|---|---|
| `GET /api/orgs/:orgId/export/guests.csv` | `guests.export` | CSV with Name, Email, Phone, Party, RSVP, Table, Dietary, Event |
| `GET /api/orgs/:orgId/export/vendors.csv` | `vendors.view` | CSV with Name, Category, Contact, Email, Phone, Contract, Paid, Balance |
| `GET /api/orgs/:orgId/export/financials.json` | `budget.view` | JSON with per-event budget items, totals, vendor financials |

### Client Integration
Export buttons in Integration Hub now wrap `<a href="..." download>` tags that trigger browser downloads with proper `Content-Disposition` headers.

### Tests: 4 integration tests (guests CSV, vendors CSV, financials JSON, auth requirement)

---

## 2. Team Member Management

A new "Team Members" tab in the Admin Panel (System → Admin) that lets venue owners:

### Features
- **List all org members** with names, emails, and role badges
- **Invite new members** via email + role selector dialog
- **Remove members** with confirmation
- Role dropdown shows Admin, Planner, Staff, Vendor, Guest options
- Error handling for "user not found" (they need to register first)

### Implementation
- `TeamMembers.tsx` component (130 lines)
- Uses existing SDK methods: `sdk.roles.listMembers()`, `.addMember()`, `.removeMember()`
- Added as the **default tab** in AdminPanel (Team → Permissions → Backups → Settings → Diagnostics)
- **Invite Dialog** with email input + role selector + validation

### Tests: 4 tests (member list, role badges, invite button, email display)

---

## 3. Enhanced Intelligence Dashboard

The dashboard landing page was a static "Getting Started" card. Now it's a real venue intelligence surface:

### New Dashboard Components

**Event Pipeline Summary** (`EventPipelineSummary`)
- Color-coded pipeline status bar showing leads, holds, booked, planning, completed counts
- Total pipeline revenue calculation
- Upcoming events list (sorted by date, max 5) with:
  - Event title → click to navigate to detail
  - Date, guest count, budget
  - Status badges (color-coded)
- "No upcoming events" empty state with create link

**Quick Actions Panel**
- Direct links to: Events Pipeline, Guest Browser, Vendor Directory, Analytics Report, Theme Studio
- Keyboard shortcut reminder (⌘K)

### Layout
```
┌─────────────────────────────────────────────────┐
│  KPI Widgets (booking conversion, RPE, etc.)     │
├────────────────────────────────┬────────────────┤
│  Event Pipeline Summary        │ Quick Actions  │
│  ├─ Pipeline bar (lead/booked) │ ├─ Events      │
│  ├─ Revenue total              │ ├─ Guests      │
│  └─ Upcoming events list       │ ├─ Vendors     │
│                                │ ├─ Analytics   │
│                                │ └─ Theme       │
└────────────────────────────────┴────────────────┘
```

---

## Test Summary

| | Phase 25 | **Phase 26** | Δ |
|---|---|---|---|
| Server tests | 204 | **208** | **+4** |
| Client tests | 358 | **364** | **+6** |
| **Total** | **562** | **572** | **+10** |
| Typecheck | clean | clean | — |
| Build | clean | clean | — |

---

## Files Added (4)

```
server/src/routes/exports.ts                                # 3 export endpoints
server/src/routes/exports.integration.test.ts                # 4 tests
client/src/screens/system/admin/TeamMembers.tsx              # Team member management
client/src/screens/system/admin/TeamMembers.test.tsx          # 4 tests
docs/PHASE-26-DAY-1.md                                      # This file
```

## Files Modified (4)

```
server/src/index.ts                                   # Register exportRoutes
client/src/App.tsx                                    # Enhanced dashboard with EventPipelineSummary
client/src/screens/system/IntegrationHub.tsx          # Wired export download links
client/src/screens/system/admin/AdminPanel.tsx        # Added Team Members tab (default)
client/src/screens/system/admin/AdminPanel.test.tsx   # Updated for new tab structure
```
