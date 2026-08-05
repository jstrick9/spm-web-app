# Hardening Pass — Feature Completion, Timestamps, and Export Security

Eight commits on top of UX Pass 6, all pushed to `main` / `develop` /
`staging` / `feature/fixes_web_app`.

---

## 1. Feature completion — vendor ratings (`99fdf46`)

The server had rating endpoints since Module 09 (`POST/GET
/api/vendors/:id/ratings` with `ON CONFLICT(vendor_id, event_id)` upsert)
and the SDK had methods, but **no UI called them**. Added:

- `VendorRatingDialog` — ★ Rate action on the vendors table: 1–5 star
  overall rating (aria radiogroup), quality/timeliness/communication
  score selects, optional review, **aggregate across all events**, past
  reviews list, pre-fill + "Update rating" for the current event's
  existing rating.
- 5 component tests (aggregate render, past reviews, required rating,
  submit payload, pre-fill/update).

Same commit — **day-of check-in "Late" was broken two ways**:
- the Late filter was inverted (`s !== 'expected'` kept only
  not-yet-arrived vendors and **hid** vendors explicitly marked `late`);
- there was no way to mark a vendor late at all.

Fixed the filter (`s === 'late'`), added **Mark Late** on expected
vendors, **Arrived Late — Check In** for late vendors, danger
badge/tint/count chip. 3 regression tests.

## 2. Timezone correctness — the big sweep (`7c5e9a5` → `3ed2d1d`)

Two root causes, found by auditing every date comparison:

**A. ISO strings compared against SQLite `datetime('now')` (`39bfcce`).**
Columns written by app code use ISO-8601 (`2026-08-04T01:00:00.000Z`);
SQLite's `datetime('now')` produces space format (`2026-08-04 01:00:00`).
Lexically `'T' > ' '`, so **every ISO string sorted after every space
string on the same UTC day**, which meant:

| Symptom | Impact |
|---|---|
| `password_reset_tokens.expires_at > datetime('now')` | **Reset tokens stayed valid until UTC midnight** — a 30-min link lived up to ~24h extra (security) |
| `team_invitations` / `layout_setup_packets` / `asset_capabilities` expiry | Same — invites/packets/capabilities never expired on time |
| `webhook_deliveries.next_retry_at <= datetime('now')` | **Webhook retries due "now" weren't claimed until the next UTC day** |
| audit `after`/`before` filters (client sends ISO) | **24h/7d/30d audit filters dropped every same-day row** — up to 23h of activity invisible |
| audit retention purge (ISO cutoff) | Purged up to 24h too much per run |
| `job_queue.run_at` | Mixed formats — latent delay for any ISO-scheduled job |

Fixes: expiry/retry/claim comparisons now use ISO `now` (matching the
column writers); audit `before`/`after`/purge normalize ISO → space via
`isoToSqliteUtc`; `job_queue` always writes ISO; timeline-reminder route
stores canonical ISO regardless of client format. New
`timestamp-hygiene.integration.test.ts` (8 tests) — each fails against
the old code.

**B. UTC date vs local calendar date.** `new Date('YYYY-MM-DD')` is UTC
midnight and `toISOString().slice(0,10)` is the UTC date, but date
pickers produce LOCAL dates — off by one during US evening hours:

- `7c5e9a5` events pipeline: "Day of" fired up to ~12h early; `event_week`
  off by one near midnight. Now local calendar-day arithmetic + 7 tests.
- `2ccafb2` shared `lib/calendarDays.ts`; TodayView alerts (30-day
  window, RSVP-deadline alerts) fixed; removed dead `eventDaysUntil` in
  AnalyticsDashboard. +4 tests.
- `9c7bec9` lifecycle email scan: `rsvp_reminder` emails fired a day
  late (UTC-derived target vs local deadline).
- `3ed2d1d` couple planning "overdue/upcoming" labels off by one day.

## 3. Export security — CSV & ICS injection (`bec22f3`, `c2df7b1`)

**CSV formula injection (OWASP):** guest/vendor names are
user-controlled; exported cells starting with `=`, `+`, `-`, `@` execute
as formulas when opened in Excel/Sheets (e.g. a guest named
`=HYPERLINK("https://evil.example","click")`). New `csvCell()`/`toCsv()`
(same helper server + client) neutralize the leading character and are
used by **all seven exporters**: guests.csv, vendors.csv, couple seating
.csv, couple guest-list export, catering-dietary export (server), and
the check-in report + cross-event guest export (client). Regression test
hits three endpoints with formula-named guests/vendors; +7 unit tests.

**ICS line injection:** timeline/appointment titles flow into
`SUMMARY:`/`LOCATION:` lines; titles containing newlines (or lone CRs)
could inject arbitrary VEVENT properties. New `icsText()` (RFC 5545
escaping for `\`, `;`, `,` + newline neutralization) applied to all
three calendar builders (couple appointments, couple timeline, guest
schedule). +3 unit tests.

## Verification

- Malformed-input probes: **88 requests** with garbage params/bodies
  across ~50 routes → **zero 5xx** (all proper 4xx).
- Server: **562 tests / 79 files** · Client: **879 tests / 133 files**
  (exact counts at the final commit; both suites green).
- `tsc --noEmit` clean both apps; client production build + bundle
  budgets ✅.
