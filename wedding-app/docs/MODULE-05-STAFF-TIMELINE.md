# MODULE-05 — Staff & Timeline: Comprehensive Review

**Scope:** `routes/staff.ts`, `routes/timeline.ts`, `db/repos/{staff,timeline,timelineOps,eventReadiness}.ts`,
`jobs/worker.ts`, `lib/permissions.ts` (staff/timeline grants), client `EventStaffTab` + `staffSections/*`,
`EventTimelineTab` + `timelinePanels` + `timelineState`, `RunSheet`, `EventEmergencyTab`, dashboard
`TodayView` / `StaffingCalendar` / `SpaceCalendarGrid`, `sdk/{staff,timeline}.ts`, `useRealtimeInvalidation`.

**Review date:** 2026-08-04 · **Status:** findings fixed in this module commit (ST-01…ST-20).

---

## Module strengths

- **Readiness engine** (`eventReadiness.ts`) is genuinely excellent: timeline-overlap, phase-coverage,
  vendor-load, staffing-coverage, and 15+ layout safety checks (ADA path width ≥36″, fire-exit
  clearance, table spacing, power proximity) with severity weights, plain-language explanations, and
  deep links. This is the strongest piece in the module.
- **RunSheet** has a real print path (`window.print()` + print CSS), day-of mobile mode, and a contact
  lookup — built for actual event-day use.
- **Timeline ops** (change log, incidents, reminders, offline packets, snapshots/diffs) is a coherent
  day-of command surface, and the manager state hydrates from server `timeline-ops` (offline-first).
- **Staff clock-in/out**, weekly availability with override-reason enforcement, and the coverage
  auditor (conflict detection, missing-role detection) are solid foundations.
- Final-review stage gate correctly consults `timeline_approvals` (at least one approval).

---

## Findings & fixes

| ID | Sev | Area | Finding | Fix |
|----|-----|------|---------|-----|
| ST-01 | **High** | RBAC/access | Timeline writes (`POST /events/:id/timeline`, `PATCH/DELETE /timeline/:id`), setup-checklist (GET/seed) and staffing-requirements (GET/PUT) authorize with **org-level scope and no `orgMap`** → event-scoped members (planner/staff invited to one event) are 403 despite holding `timeline.manage` / `staff.view`. Same for `timeline-ops/*` and all `/api/orgs/:orgId/staff/*` endpoints. GET timeline already used the `{eventId}`+`orgMap` pattern — writes didn't. | Unify on `orgMap = eventsRepo.orgMapForUser(...)` + `can(memberships, { eventId }, perm, orgMap)` (and orgMap passed to org-scoped staff routes). Regression-tested with an event-scoped planner. |
| ST-02 | **High** | RBAC/privacy | **Couple role holds `timeline.view`** → a couple can call `GET /api/events/:id/timeline` and read the full internal timeline (notes, vendor ids, assignments, metadata) — defeating the sanitized `couple-schedule` endpoint ("Venue staffing, vendor load-in, and setup instructions remain with the operations team"). | Remove `timeline.view` from couple role grants; couple UI already uses `couple-schedule` only. Updated `rbac-coverage` + `roles` copyFrom tests. |
| ST-03 | **High** | Data integrity | `PATCH /api/staff/shifts/:id` **silently ignores core fields** — repo update only handled contact/radio/handoff/notes; changing a shift's time/staff/role/event returned 200 but changed nothing. **Worse:** the table has no `updated_at` column, so the update SQL threw `no such column: updated_at` — the endpoint has been returning **500 since day one** (migration 0051 adds the column). | Full shift update (all `shiftSchema` fields) + re-run availability + conflict validation + audit. Migration `0051_staff_shifts_updated_at.sql`. SDK/type updated. |
| ST-04 | **High** | Data integrity | **Cross-org reference injection**: task create/patch accepts `eventId`/`assignedAreas`; shift create accepts `eventId`/`areaId`/`staffId`; timeline accepts `vendorId`/`assignedTo` — none validated to belong to the same org → cross-tenant rows, phantom coverage JOINs. | Route-level ref validation: event/area/vendor must belong to org; staffId must be an active org member. 400 codes (`event-not-in-org`, `area-not-in-org`, `staff-not-in-org`, `vendor-not-in-org`). |
| ST-05 | **High** | Data integrity | **Same-staff overlapping shifts are created silently** (double-booking a person) — conflicts are only *reported* after the fact by the coverage auditor. | Conflict guard on create/update: 400 `staff-shift-conflict` with conflicting-shift details. |
| ST-06 | **High** | Feature | **Timeline reminders are never dispatched.** `timeline-ops/reminder` inserts rows with `status='queued'` forever; no job scans them; `sms` channel is accepted though no SMS gateway exists. | New `jobs/timelineReminders.ts` scan (60s): due `in_app` → SSE `timeline.reminder` broadcast + `sent`; `email` → enqueues `email.send` when the org has connected SMTP (else stays queued, retried); `sms` rejected at creation (400 `sms-channel-not-configured`). |
| ST-07 | **High** | Governance | **Approval forgery**: any `timeline.manage` holder can set *any* role's approval to `approved` — a manager can self-approve the owner/planner sign-off and pass the final-review gate. | `status='approved'` requires the actor to hold that role (membership roleKey) or be owner/admin; other transitions stay open. Audited. |
| ST-08 | **Med** | RBAC | Staff role grants **`staff.manage`** (create/delete shifts, areas, coverage data) contradicting its description "manage timeline + own staff tasks"; meanwhile **non-managers cannot update even their own tasks** (PATCH requires manage) — the kanban's toggle is dead for assignees. | Remove `staff.manage` from staff role; add **assignee self-service**: task PATCH allowed for `assigned_staff`/creator on `{status, checklist, notes, priority}` without manage. UI gated with `usePermission`. |
| ST-09 | **Med** | Validation | Shift schema has **no `startsAt < endsAt` ordering** (inverted shifts pass and "fit" availability via string compare); clock-in twice clears the prior clock-out (`clocked_out_at=NULL`); clock-out without clock-in allowed. | zod refine (parseable + ordered dates); 400 `already-clocked-in` / `not-clocked-in`. |
| ST-10 | **Med** | Validation | Timeline schema: `startsAt` any string (no date validation), `endsAt` may precede `startsAt`, `durationMin` only positive. | zod refinement (valid date; `endsAt > startsAt` when provided). |
| ST-11 | **Med** | Robustness | Duplicate weekly-availability insert (same org/staff/day/window) violates the UNIQUE constraint → **SQLite exception → 500**. | Catch → 409 `availability-already-exists`. |
| ST-12 | **Med** | API | `DELETE /api/staff/shifts/:id` returns **204 for a nonexistent shift** (no 404), inconsistent with every other resource route. | 404 `NotFound`. |
| ST-13 | **Med** | Audit | **No audit coverage** on staff task/shift/area/availability CRUD, clock-in/out, timeline CRUD, or timeline-ops approval/incident/reminder/offline-packet — audit is the module convention everywhere else. | Audit entries for all of the above (namespaced `staff.*`, `timeline.*`, `timeline.approval.*`). |
| ST-14 | **Med** | Realtime | **SSE invalidation gap**: server broadcasts `staff.task_*`/`shift_*`/`clock_*` but `useRealtimeInvalidation` has **zero handlers** for them; timeline CRUD isn't broadcast at all (other tabs go stale mid-planning). | Add `timeline.created/updated/deleted` broadcasts (payloads now include `eventId`); add client invalidation handlers for staff + timeline events incl. dashboard keys (`staff-coverage`, `staff-calendar`, `staffTasks/<event>/manager-dashboard`). |
| ST-15 | **Med** | Emergency | "Emergency broadcast announcement" is only written to event metadata — **nothing is actually broadcast** (no SSE/audit), so staff on other devices never see it. | On events PATCH, when `emergency_broadcast_announcement` changes to non-empty: audit `event.emergency.broadcast` + SSE `event.emergency_broadcast`; client shows a notification toast. |
| ST-16 | **Low** | UX | `TodayView` computes "today" and the 7-day strip with `toISOString().slice(0,10)` (**UTC** keys) — for EDT/PDT venues, evening hours land events on the wrong day. | Local-date key helper (`yyyy-MM-dd` from local components) + tests. |
| ST-17 | **Low** | Client | `EventStaffTab.canManageAvailability` uses a raw roleKey allow-list (`owner/admin/manager`) while the server uses permissions — custom roles with `staff.manage` get a broken UI. | Use `usePermission('staff.manage')`. |
| ST-18 | **Low** | Cleanup | `staff_availability_overrides` table (migration 0046) is **dead schema** — nothing reads/writes it; the shift-level `availability_override_reason` column (0045) superseded it. | Migration 0050 drops the table (documented). |
| ST-19 | **Low** | Repo | `staffTasksRepo.update` never clears `completed_at` when a task is un-completed (stale completion timestamps in kanban/reporting). | Clear `completed_at`/`completed_by` when status ≠ completed. |
| ST-20 | **Low** | RBAC | `setup-packet` access uses a raw roleKey allow-list — custom staff-like roles are denied; conversely a couple could pass via `layouts.view`. | Permission-based: `staff.view` or `timeline.view` (with orgMap + eventId scope). |

---

## Verification & regression tests

Server — new `routes/staff-timeline-module.integration.test.ts` (+ related updates):

1. Event-scoped planner can read **and write** timeline/setup-checklist/staffing-requirements (ST-01).
2. Couple with valid event membership gets 403 on the internal timeline, 200 on couple-schedule (ST-02).
3. Shift PATCH persists time/staff/role changes; inverted times rejected; overlapping same-staff shift
   rejected; cross-org event/area/staff refs rejected (ST-03/04/05/09).
4. Assignee self-service: staff role member updates own task status (200) but not title; lacks
   `staff.manage` grants; manager keeps full control (ST-08).
5. Approval governance: manager cannot approve the owner row; owner can (ST-07).
6. Reminder dispatch: due in_app reminder → SSE row + status `sent`; email without SMTP stays queued;
   sms creation → 400 (ST-06).
7. Duplicate availability → 409 (ST-11); clock guards (ST-09); DELETE shift 404 (ST-12).
8. Emergency broadcast metadata change → audit + SSE row (ST-15).
9. rbac-coverage/roles tests updated for couple `timeline.view` and staff `staff.manage` removal (ST-02/08).

Client — `useRealtimeInvalidation.test.ts` (staff/timeline handlers), `TodayView.test.tsx` (local-date keys),
`EventStaffTab.test.tsx` (permission gating). Full suites re-run (see totals below).

**Validation:** server `tsc --noEmit` ✅ · server vitest **502/502** (71 files) ✅ · client `tsc --noEmit` ✅ ·
client vitest **811/811** (125 files) ✅ · `npm run build` + bundle budgets ✅.

---

## Affected modules / follow-ups

- **Events** — final-review gate now requires a *genuine* approval (ST-07 closes the self-approval path).
- **Platform Admin / Security & Ops (later modules)** — reminder dispatch introduces a new periodic job;
  ops runbook should mention it. SMS channel remains explicitly unsupported until an SMS integration exists.
- **Guest & Couple Portals (later module)** — couple timeline access now flows only through the sanitized
  `couple-schedule` endpoint; verify couple-hub copy still matches.
- **Known, intentionally deferred:** shift *editing UI* (API now fully supports it; scheduler UI remains
  create/delete-only), `timeline_reminders` pagination, `staffingCoverage` O(n²) loop (fine at venue scale),
  emergency/run-sheet metadata read-modify-write concurrency (whole-metadata replace on save).
