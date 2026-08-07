# UX Improvements Pass 7 — Clean-Sweep Gates & Guest-Facing Polish

**Date:** 2026-08-06
**Scope:** guest-facing date honesty, post-auth URL normalization, a dead
catalog query 400ing the Layout tab, calendar keyboard accessibility,
space-calendar timezone hardening, payments milestone visibility, plus 11
new browser gates that walk every major surface and fail on console errors
or HTTP ≥ 400.

---

## Fixes

### 1. Guest portal fabricated a wedding time that does not exist
`events.start_date` is a **date-only** column (no time-of-day exists in the
data model), but the guest portal rendered it through
`toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })` —
producing **"Sep 12, 2026, 12:00 AM"**. A guest reading that thinks the
ceremony is at midnight.

- `GuestPortalHome.tsx` — the "Date / time" summary tile and the
  event-day "Schedule" tile now render `formatDateOnly()` →
  "September 12, 2026" (TZ-safe). Tile label is now honestly "Date".
- Regression tests: `GuestPortalHome.test.tsx` (+2) assert the date-only
  render and assert no `12:00 AM`/`12:00 PM` anywhere on the page.

### 2. Address bar lied after sign-in
After login/register/magic-link the app rendered the dashboard but the URL
stayed on `/login`, `/register`, `/reset-password` — refresh or share
misled. Now every successful auth path normalizes via
`history.replaceState(null, '', '#/')` (+ manual `hashchange` dispatch for
the magic-link path where a listener may already be registered). A pending
post-auth redirect (couple hub / deep link) still wins in the App-level
effect.

- `AuthScreen.tsx` (3 paths: magic link, submit login/register, demo login).
- Regression test: `AuthScreen.test.tsx` (+1) — URL hash is `#/` after auth.

### 3. Layout tab 400'd on every open
`CanvasPage` fired `sdk.catalog.list(orgId, 'decor')` — but the server's
catalog kinds are `table|fixture|chair|wall_style|linen|guideline|spacing|template`,
so every Layout tab open produced a guaranteed **400 `invalid-kind`** and a
console error. The query result was never even used (the decor palette is
the source of truth). Removed the dead query.

- Regression gate: `event-tabs-clean.e2e.spec.ts` fails on any ≥400.

### 4. Global calendar was mouse-only
- Icon-only chevron buttons had no accessible names → `aria-label`
  "Previous month" / "Next month"; "Today" gets "Jump to current month".
- Event chips were click-only `<div>`s → now `role="button"`, `tabIndex=0`,
  Enter/Space handling, and a visible focus ring.

- Regression gate: `calendar-nav.e2e.spec.ts` — month nav updates the grid,
  and Enter on a focused chip deep-links to the event detail page.

### 5. Space-calendar month math drifted with timezone
`DashboardScreen` passed `start.toISOString()` of the 1st of the month and
`SpaceCalendarGrid` re-parsed it with `new Date()` — a date-only ISO parses
as UTC midnight, which lands on the **previous** day in far-negative UTC
offsets. Now the dashboard derives **local** `year`/`month` (plus local
date-only strings for the API call) and the grid takes an explicit
`year`/`month` contract.

- `SpaceCalendarGrid.tsx`, `DashboardScreen.tsx`.
- Regression tests: `SpaceCalendarGrid.test.tsx` (+4) — weekday alignment,
  commitment placement, conflict badge, click-to-open.

### 6. Payment milestones invisible in the payments table
The "Due Date / Milestone" column rendered only `metadata.dueDate`; a
payment with no due date showed "—", so a venue could not tell which
payment row was the Deposit vs Final Balance. Now the column renders the
milestone/invoice label (with the due date when present).

- `PaymentsPanel.tsx`.
- Regression test: `PaymentsPanel.test.tsx` (+1) — milestone label renders
  with and without a due date.

---

## New browser gates (11) — the "clean sweep" suite

These specs fail on any console error, page error, or HTTP ≥ 400 on the
surface they walk (ERR_ABORTED navigation noise is excluded):

| Spec | Surface(s) walked |
|---|---|
| `surfaces-clean` | dashboard, calendar, intelligence, vendors, guests, system, reports |
| `event-tabs-clean` | every event tab for a booked event **and** a planning → completed event (stage-gated Staff / Portal / Emergency tabs) |
| `guest-portal-clean` | portal in both token states: help request, secure-link resend, full RSVP wizard, full-page lazy-section scroll |
| `calendar-nav` | calendar month navigation + keyboard chip access |
| `couple-documents` | couple document upload → venue sees it + audit row |
| `couple-closeout` | post-event NPS survey submit → server record |
| `payments` | payment link create + reconcile → server record |
| `runsheet` | printable run sheet renders + print triggers |
| `guests-browser` | cross-event guest browser deep-links into event Guests tab |
| `checkin` | vendor check-in marks arrived + guest QR scan path |
| `invites-tracking` | invite tracking "mark sent" persists server-side |

**Totals: 36 e2e specs (was 25) · 960 client unit tests (was 952) · 694 server tests.**

## E2E harness notes (for future sessions)
- The app is **hash-routed** — `page.goto('/#/path')`, never bare `/path`
  (bare paths silently render the dashboard).
- After the auth screen fix the URL becomes `host/#/` — login waits should
  use `waitForTimeout` + content assertions, not URL matchers.
- `POST /api/events` returns `{ event: {...} }`; payment link metadata is a
  **JSON string** in API responses.
- The couple-side post-event summary exposes `survey.npsScore` (from event
  metadata) and `nps.score`; there is no `postEvent.nps.totalResponses`.
