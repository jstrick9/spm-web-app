# UX Improvements Pass 8 — Timezone Honesty, Rate-Limit Feedback & Emergency Coverage

**Date:** 2026-08-07
**Scope:** three date/time bugs guests and venues actually hit, silent
failure on rate-limited guest actions, honest post-deadline RSVP receipts,
plus two high-stakes e2e gates (emergency broadcast, layout template).

---

## Fixes

### 1. Wedding countdown flipped at the wrong time in every non-UTC timezone
`PrecisionCountdown` parsed the **date-only** `start_date` with
`new Date('YYYY-MM-DD')` → **UTC midnight**. In the US (UTC−4/5) that is the
previous evening local: guests saw "0 days, N hours" ON the wedding day and
the countdown only completed at ~8 PM local; in UTC+ timezones it flipped to
"🎉 Celebration Time!" at 2 AM, hours before the ceremony.

- Extracted a pure `countdownParts()` helper (`screens/portal/countdown.ts`)
  that targets **local midnight** via `parseDateOnly` — the countdown
  completes exactly when the wedding day begins.
- `PublicGuestPortal.tsx` uses it.
- Tests: `countdown.test.ts` (+4, TZ-agnostic — asserts local-noon-of-wedding
  is past, day-before-11PM is not, etc.).

### 2. COI expiry flagged a day early + displayed the wrong day
`EventVendorsTab` parsed `coiExpirationDate` (date-only) with `new Date()`
→ UTC midnight, then `setHours(0,0,0,0)`: a COI expiring TOMORROW showed
"Expired COI" today in US timezones, and the row's "Expires:" label showed
the PREVIOUS day.

- Now uses `daysUntilDateOnly` (expired only when `< 0`) and
  `formatDateOnly` for the label.
- Tests: `EventVendorsTab.test.tsx` (+2 — expired-yesterday flags Expired,
  expiring-in-10-days flags Expiring Soon, today is NOT expired).

### 3. Rate-limited guest actions failed SILENTLY
`resendSecureLink` (5/min) and `requestGuestHelp` (10/min) had no error
handling: a guest hitting the limit got an unhandled promise rejection and
**zero feedback** — the button just did nothing.

- Both now catch and surface a friendly inline message ("Too many link
  requests in the last minute — please wait a moment and try again.").
- Tests: `PublicGuestPortal.test.tsx` (+2) mock an ApiError with
  `kind: 'rate-limited'` and assert the message renders.

### 4. Post-deadline RSVP receipt hid the truth
The server flags `lateSubmission` on submissions after `rsvp_deadline`
(venue sees it on the guest list) but the wizard ignored the flag — the
guest saw a plain "RSVP saved" with no acknowledgment that catering/seating
counts may be locked.

- `GuestRsvpWizard` now captures `lateSubmission` from the submit response
  (SDK type updated) and renders an honest warning on the receipt:
  "Submitted after the RSVP deadline — your response was still recorded,
  but the couple/venue may already be finalizing catering and seating."
- Tests: `GuestRsvpWizard.test.tsx` (+2 — notice on/off).

### 5. Copy: "1 votes"
Poll option badges read "1 votes". Now singular/plural-correct ("1 vote"),
including the aria-label.

---

## New e2e gates (2)

| Spec | Flow |
|---|---|
| `emergency` | planning event → staged completed (Emergency tab is stage-gated to final_review/completed) → activate Plan B (banner + `emergency_active_plan=plan-b` persisted) → mass broadcast (`emergency_broadcast_announcement` persisted) |
| `couple-template` | fresh couple applies "Use this template" → toast → layout proposal recorded. Templates are catalog items bound to APPROVED venues, so the spec provisions venue+template via API when the org has none (demo org ships zero templates) |

## Totals
**43 e2e specs · 970 client unit tests · server suite green (694).**

## Notes for future sessions
- `POST /api/orgs/:orgId/catalog/:kind` expects `spec` as an **object**
  (string is rejected with invalid-input).
- The Emergency tab is hidden until `final_review`/`completed` (blueprint
  §4.4 stage-gating) — e2e must stage first; `final_review` requires
  readiness checks, `completed` does not.
- `GET /api/events/:id` returns `{ event: { metadata: … } }` — metadata is
  a JSON **string** from the list endpoint and an object from detail
  (normalize defensively in tests).
- Guest portal lookup/help messages render inline in the Start Here card
  (not toasts) — assert on the card text.
