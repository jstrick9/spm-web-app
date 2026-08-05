# UX-DATE-FORMATTING-PASS-1 — human-readable dates everywhere

Session date: 2026-08-05

## Problem

Several screens rendered raw machine timestamps directly to end users:

- `EventDetail` header: `2026-09-12` (and `– 2026-09-12` ranges)
- Manager run sheet: `Event date 2026-09-12`
- Dashboard space calendar commitments: `Smith Wedding · 2026-09-12 · 150 guests`
- Layout shared-inventory conflict list: `reserved on 2026-09-12`
- Couple hub: RSVP deadlines, planning-task due dates, payment due dates,
  calendar-item starts, contract signed-at timestamps — all raw
- Guest portal: RSVP deadline in the warning box and in the offline
  guest-details text export

Raw `YYYY-MM-DD` / ISO strings are machine format; venue staff, couples, and
guests think in "September 12, 2026".

## Fix

New shared helper `client/src/lib/formatDate.ts`:

- `formatDateOnly(value)` renders "September 12, 2026" (en-US long form).
- Timezone-safe: `YYYY-MM-DD` values are parsed as calendar dates in UTC, so
  the same date never shifts a day depending on the viewer's timezone.
- ISO timestamps use their date portion; unknown strings pass through
  untouched; empty/null/undefined → "TBD".

Applied at every raw-date render site found by sweep:

- `EventDetail.tsx` (header date + range)
- `eventDetailPanels.tsx` (run sheet)
- `DashboardScreen.tsx` (space calendar commitments)
- `events/layouts/CanvasPage.tsx` (inventory conflict dates)
- `CoupleEventHub.tsx` (RSVP deadline ×3, task due dates, payment due dates,
  calendar item starts, contract signed-at)
- `GuestPortalHome.tsx` (RSVP deadline warning)
- `PublicGuestPortal.tsx` (guest details export text)

## Tests

- `client/src/lib/formatDate.test.ts` (4) — long-form output, ISO input,
  TBD fallbacks, unknown-string passthrough.
- `EventDetail.test.tsx` updated to assert the formatted date.
- Full client suite green: 905 tests / 135 files.

## Server-side text exports (follow-up)

Guest-facing text files still showed raw `YYYY-MM-DD`:

- `POST-event final packet` (`routes/couple/postEvent.ts`) — "Wedding date:"
- Guest offline travel card + event-day pass (`routes/guests/portal.ts`)
- Couple travel-microsite packet (`routes/couple/planning.ts`)

New server helper `formatDateLong()` in `lib/time.ts` (mirror of the client
`formatDateOnly`; timezone-safe, never throws). Applied to all three.

**Tests:** `server/src/lib/time.test.ts` (4, incl. formatDateLong cases);
`routes/portal-flow.integration.test.ts` test 9 asserts the travel card
renders "September 12, 2026" and no raw date. Server suite: 660 tests.
