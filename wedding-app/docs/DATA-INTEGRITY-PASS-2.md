# Data Integrity Pass 2 — Duplicate Bookings & Dead-End Exports

Three fixes this session, all on `main` / `develop` / `staging` /
`feature/fixes_web_app`.

## 1. Duplicate-booking guard (`29beaa3`)

Space conflicts only catch **same-space** overlaps. Two "Smith Wedding"
leads for the same date in *different* spaces would silently split the
guest list, budget, and headcount across two events — a classic
double-entry for busy coordinators.

- **Server**: creating an event with the same title + start date as an
  existing active event in the org now returns a `duplicateWarning`
  (matched event id/status/title) and audits
  `event.create.duplicate_warning`. Same-space duplicates still 409 on
  the space conflict first (correct).
- **Client**: `CreateEventDialog` toasts **"Event created — possible
  duplicate"** naming the matched event when flagged (creation still
  succeeds — it's a warning, not a block).
- Tests: server (two venues, same couple/date → warning + audit; other
  date → none), client (toast shown, `onCreated` still fires).

## 2. Fake "provider sync" stat removed (`3198bf5`)

The couple calendar showed a "provider sync" stat that only ever read
`not_connected` with a placeholder note about connecting
Calendly/Google "later" — a non-functional feature masquerading as a
status. Removed the stat (appointments / calendar items / open requests
remain).

## 3. Exported invitations had dead RSVP buttons (`f8ed5b0`)

The HTML invitation export rendered button blocks as `<a href="#">` — a
click lands on nothing and loses the RSVP. The portal URL isn't known at
export time, so buttons now render as inert styled text with an explicit
"RSVP link will be added when you send invitations" note — the exported
file is honest instead of broken.

## Verification

- Server **581 tests / 80 files** · Client **897 tests / 134 files** —
  both suites green.
- `tsc --noEmit` clean; production build + bundle budgets satisfied.
- Working tree clean; all branches in sync at `f8ed5b0`.
