# HUNT-PASS-20 — Manager-mode flags excluded owners/admins/invite-joined managers

**Cycle:** Clean Cycle #2 · **Date:** 2026-08-07 · **Status:** verified, pushed to all 4 branches

---

## Finding & fix

### Symptom
Several manager-only UI surfaces keyed on `localStorage.wvi_registration_role ===
'venue_manager'` — a client-side artifact written only at **registration** (or demo
manager login). Owners, admins, and managers who joined via a team invitation have no
flag (or `venue_owner`), so:
- **Dashboard**: venue-wide ops widgets — space calendar, staffing calendar, portfolio
  readiness, staff tasks, vendor ops — were hidden for owners/admins (the people most
  able to act on them). `isManager` only checked `roleKeys.includes("manager")` + flag.
- **Events list**: the manager-ops pipeline filter was hidden for owner/admin.
- **NotificationCenter**: manager notification presets were hidden for owner/admin.

### Fix
- `DashboardScreen`: `isManager` = roleKeys owner/admin/manager **or** the flag.
- `EventsList`: new `managerMode` prop (App passes owner/admin/manager membership in the
  active org) **or** the flag.
- `NotificationCenter`: `managerMode` = flag **or** an owner/admin/manager membership
  scoped to the active org (new `orgId` prop threaded App → AppShell → NotificationCenter
  so a user's own unrelated org can't unlock the tier).
- `EventBudgetTab` was audited and needs no change: owner/admin hold `budget.manage`, so
  the permission path already covers them.

### Tests
- `role-matrix.e2e.spec.ts` +1: a freshly registered owner (API registration sets NO
  flag) sees "Venue space calendar" + "Staffing calendar" on the dashboard — the exact
  case that failed before.
- Full suites: client 1010 ✓, e2e **61/61** ✓ (incl. prior 60 + this regression).

## Verification
- Server vitest: 711 ✓ (unchanged this batch)
- Client vitest: 1010 ✓
- e2e: 61 passed (full suite)
- tsc clean; tree clean; 4 branches pinned
