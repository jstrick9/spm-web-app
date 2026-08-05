# Guest Directory Privacy Fix — Names Only for Anonymous Visitors

## The issue

The opt-in generic guest directory (`allowGenericGuestDirectory`) let
anonymous visitors browse `/api/portal/:eventId/info` and receive the
**full personal record for every guest**: full name, RSVP status
(attending / declined / pending), table & seat assignment, room/lodging
assignment, sub-event invitations, plus-one policy. Anyone with the
event URL — which guests share freely — could see who declined, who is
seated where, and where guests are staying. The flag was off by default,
but when a venue enabled it (a real feature for large weddings), the
exposure was far wider than the feature needs.

## The fix

- **`publicGuestDirectory()`** (new, `routes/guests/shared.ts`) — a
  redacted directory shape: `id`, `fullName`, and `partyName` only
  (names are what guests need to find themselves; party name helps
  disambiguate duplicates). Everything else is `null`/empty.
- **`routes/guests/portal.ts`** — the generic directory now maps through
  `publicGuestDirectory()` instead of the full `publicGuest(g, true)`.
- **Venue UI** (`GuestPortalSettingsTab` → `PortalDesignerCard`) — new
  "Enable generic guest directory" checkbox with explicit privacy copy:
  "directory visitors see guest names only — RSVP status, seating,
  lodging, and sub-event details stay hidden until a guest uses their
  secure invitation link."
- Tokenized guests are unaffected: with a valid invitation token (own or
  household), the portal still returns full personal details exactly as
  before.

## Tests

`portal-flow.integration.test.ts` (+1, `4b`):
- sets `table_assignment`/`seat_assignment`/`room_assignment`/
  `rsvp_status` on guests, enables the directory flag;
- anonymous `/info` → guests have fullName + partyName, but
  `rsvpStatus` / `tableAssignment` / `seatAssignment` / `roomAssignment`
  are `null` and `plusOneAllowed` is `false`;
- same guest with their invitation token → personal fields present.

## Verification

- Server **574 tests / 80 files** · Client **887 tests / 134 files**.
- `tsc --noEmit` clean; client build + bundle budgets satisfied.
