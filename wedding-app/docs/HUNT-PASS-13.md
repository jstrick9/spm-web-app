# Systematic Hunt Pass 13 — Staff Shift Scheduling Was Completely Broken

**Date:** 2026-08-07

## Critical bug found & fixed

### Every shift-scheduling attempt failed with `staff-not-in-org`
The scheduler's staff `<select>` read `m.userId` (camelCase), but the
members API returns **`user_id`** (snake_case — raw `organization_memberships`
rows). `m.userId` was therefore `undefined`, so React silently fell back to
the option's TEXT as its value — the member's **email**. The server
validates `organization_memberships.user_id = staffId`, so every create
request 400'd with `staff-not-in-org`.

Consequences: venues could not schedule ANY staff shift (the feature had no
e2e coverage and unit tests mocked members, so the bug shipped). The same
mapping bug also hid staff member names on the shift calendar
(`staffPanels.tsx`).

**Fix:** `StaffShiftsScheduler` + `staffPanels` now resolve
`m.user_id || m.userId` for option values and staff-name lookups.

## Feature added (same surface)

### Shift editing was impossible (create/delete/clock only)
Even after the fix, editing a shift required delete + recreate (losing
clock-in state), although `updateShift` existed server-side with zero
callers. Added:
- `EventStaffTab` — `saveShiftMutation` (upsert: `updateShift` when
  `editingShiftId` set, else `createShift`), `resetShiftForm`,
  `beginEditShift` (pre-fills the create dialog from the snake_case shift
  row).
- `StaffShiftsScheduler` — per-shift "Edit" button; the dialog header and
  submit button switch to "Edit Crew Shift Assignment" / "Save Shift
  Changes".

## Tests
- `staffSections.test.tsx` +2 — option values use `user_id` (never the
  email); Edit button per shift fires `onEditShift` with the shift row.
- `e2e/staff-shift-edit.e2e.spec.ts` — schedules a shift for the demo org
  member (this previously 400'd), edits the time to 3:00 PM, and verifies
  server-side that `starts_at` is 15:00 local.
