# Module 01 — Events (Pipeline, Event Detail, Create/Edit, Sub-Events, Final Review)

**Reviewed:** 2026-08-04
**Surface:** `routes/events.ts` (22 endpoints), `db/repos/events.ts`, `sdk/events.ts`, `EventsList` + `eventsListPanels`, `EventDetail` + `eventDetailPanels`, `CreateEventDialog`, `statusMeta`, `eventDetailUtils`, `eventDetailGuidance`, `EventProgressCard`, `EventRiskCard`, `LiveOperationsCard`, `EventQuickSwitcher`
**Affected modules noted:** SSE/realtime, lifecycle emails, audit, couple hub & guest portal (day-of-contact), space calendar, command palette

---

## 1. Bugs (fixed in this pass)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| EV-01 | High | **Stage endpoint is a second, inconsistent status path.** `POST /api/events/:id/stage` (the primary UI path — the Venue Event Stage selector) does NOT broadcast SSE and does NOT fire the thank-you lifecycle trigger on `→ completed`, while `PATCH /api/events/:id` does both. Result: no realtime updates when staff move stages, and couples never get the thank-you email when events are completed through the stage selector (the main path). | Stage endpoint now broadcasts `event.updated` SSE and fires `runTrigger(…, 'thank_you')` on the `→ completed` transition (same semantics as PATCH). |
| EV-02 | High | **PATCH bypasses the final-review readiness gate.** `PATCH /api/events/:id` could set `status: 'final_review'` without the 9-point readiness check that `POST /stage` enforces — two status paths with different rules. | PATCH now runs the same `final-review-not-ready` gate when transitioning into `final_review`. |
| EV-03 | High | **Day-of-contact GET is couple-only (regression from the F-4 permission work).** The GET requires `guests.couple.manage`, but the venue manager home panel fetches it with `events.members.invite` → managers get 403 on their own panel. | GET now requires `events.view` (venue staff + couple both need to read it); PUT stays `events.edit` and now also writes an audit entry + SSE broadcast. |
| EV-04 | Medium | **Server accepts `endDate < startDate`.** Client dialog validates, but the API accepts inverted date ranges → data integrity hole (space-calendar, forecasts, run sheets all misbehave). | `createEventSchema`/`updateEventSchema` now reject `endDate < startDate` (400 `invalid-input`). |
| EV-05 | Medium | **Duplicate copies stale dates onto a fresh lead.** `(Copy)` keeps the source wedding's `start_date`/`end_date`, so the new lead appears in date-sorted pipelines/space calendar as if already scheduled. | Duplicate now creates with cleared dates (true template copy); user sets the new date. |
| EV-06 | Low | **New events can be created in terminal states** (`completed`/`cancelled`/`lost`) via API and the dialog's status select. | Create schema restricted to entry statuses (`lead|hold|booked|planning`); dialog select filtered to the same. |
| EV-07 | Low | **Sub-event delete is the odd one out:** no audit log, and its permission check is org-scoped instead of event-scoped via `orgMap` (inconsistent with every other sub-event route; delete of a missing sub returns 204 silently). | Delete now event-scopes via `orgMap`, 404s on unknown sub, and writes an audit entry. |

## 2. Non-functional / incomplete features & UX gaps (fixed)

| ID | Finding | Fix |
|---|---|---|
| EV-08 | **"New lead inquiry" and "New event" buttons are identical** — both open the same generic dialog with no lead mode. | `CreateEventDialog` gained an `initialStatus` prop; "New lead inquiry" opens with status preset to `lead` (lead-source field focused), "New event" uses the template default. |
| EV-09 | **Stage selector lets staff silently move events to `cancelled`/`lost`** — a consequential, hard-to-undo action with no confirmation. | Added an inline confirm before applying `cancelled`/`lost` transitions. |
| EV-10 | `lifecycleEmails.ts` header comment documented only the PATCH path for thank-you — stale after EV-01. | Comment updated to describe both paths. |

## 3. Verified-working (no change needed)

- Space-conflict guard (F-1), stage/permission consistency (F-4), stage-aware tabs (F-7) — regression-tested.
- `EventProgressCard`, `EventRiskCard`, `LiveOperationsCard`, `EventQuickSwitcher` — data flow correct; risk endpoint wired; empty/loading states handled.
- `portfolio-readiness` and `live-operations` queries are properly permission-gated and indexed.
- Search + status filters on EventsList are wired through debounced query keys; `keepPreviousData` avoids flicker.

## 4. Improvements & notes (documented, not changed)

1. **Pagination/virtualization:** `events.list` has no limit from the UI — fine at current scale; add server-side pagination + cursor before large portfolios. (Scale note.)
2. **Couple-only endpoints (`couple-updates` GET/view/acknowledge) use raw `roleKey === 'couple'` checks.** Functionally correct (only couples may ack their updates) but outside the permission catalog; fold into a future `couple.workspace` permission family when the catalog is next extended.
3. **Transition guardrails:** no server-side validation prevents `lead → completed` skips. Intentionally permissive (venues backdate statuses), but the client now confirms consequential transitions (EV-09).
4. **Command palette** queries `['events', orgId]` without filters — benefits automatically from the SSE broadcast added in EV-01 (stage changes now invalidate it).

## 5. Regression coverage added

- `server/src/routes/events-module.integration.test.ts` — 12 tests: day-of-contact read (org member + couple) / write + audit; PATCH → final_review gated; create rejects terminal statuses; create rejects inverted dates; duplicate clears dates; stage → completed publishes SSE + (no-op safe) trigger; sub-event delete audits.
- `client/src/screens/events/CreateEventDialog.test.tsx` — status select restricted to entry statuses; `initialStatus` preset applied on open.
- Existing suites re-run green (server 453 + client 797 → see post-fix totals).

## 6. Post-fix validation

- Server typecheck + full server suite: **465 tests passing** (66 files).
- Client typecheck + full client suite: **799 tests passing** (124 files).
- Production build + bundle budgets green (main 192 KB).
