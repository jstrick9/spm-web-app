# TIMEZONE-CSP-PASS-1 — calendar/date bugs in US timezones + custom-font CSP

Hunting surfaced a systematic bug class: date-only columns (`start_date`,
`rsvp_deadline`, `dueDate`, `slaDueAt`) parsed with `new Date('YYYY-MM-DD')`
become UTC midnight, which lands on the **previous day** in every US
timezone. The platform's target market is US venues, so each of these was a
user-visible defect.

## Client fixes (`lib/formatDate.ts` + 4 screens)
New helpers: `parseDateOnly` (date-only → LOCAL calendar date) and
`daysUntilDateOnly` (DST-safe whole-day countdown). Applied to:
1. **Global Calendar** (`GlobalCalendar.tsx`) — events rendered on the
   WRONG DAY (one early) for US venues. New `e2e/calendar-placement.e2e.spec.ts`
   pins the browser to America/New_York and asserts the event sits in
   today's cell.
2. **Event detail panels** — "days until" countdown drifted by one in the
   evening; event-week mode fired a day early.
3. **Events list** — "Day-of"/"Event-week" phase labels misclassified.
4. **Analytics revenue-by-month** — month-boundary events (e.g. Sep 1)
   bucketed into the PREVIOUS month during US evening hours.
5. **Contract print view** — printed contracts showed the wedding date one
   day early.

## Server fixes
6. **`financialLegalOps.paymentDueRisk`** — payments due TODAY were flagged
   "overdue" a day early (dashboard risk card). Regression test asserts
   due-today + due-tomorrow = dueSoon, past = overdue, in America/New_York.
7. **`PaymentsPanel` (client)** — same off-by-one in the payments table's
   due-date column (Urgent/Overdue/Due soon labels + displayed date).
8. **`lifecycleEmails` merge fields** — automation emails told guests the
   wedding was September 11 when it was September 12. Regression test on
   the rendered subject + job payload.
9. **`normalizeGuestPostEvent`** — the post-event section (memory upload,
   thank-you, feedback) unlocked the EVENING BEFORE the wedding. Regression
   test: tomorrow's event stays locked, yesterday's unlocks.
10. **UTC-today derivations** — `new Date().toISOString().slice(0,10)` used
    as "today" for SLA status, reminder priorities, email idempotency keys,
    and the space-calendar default range. During US evenings UTC is already
    the next local day → duplicate reminder emails possible, SLA due-today
    shown overdue, space calendar default skipped today. All switched to
    `localDateString()`; `addDaysIso` (×2), `addYears`, `couplePlanning`
    due dates now use local calendar arithmetic (`addDaysFromToday` /
    `addDaysDateOnly`).
11. **Staff availability enforcement** (`staff.ts`) — availability slots are
    local wall-clock ("Monday 09:00-17:00") but shifts were compared via
    UTC getters: every US shift inside availability was rejected (forced
    fake override reasons) and evening shifts looked up the WRONG weekday.
    Now compares local components. Regression test: exactly-matching shift
    accepted; 8pm Monday shift (not Tuesday) demands override.

## CSP fix — venue-custom fonts silently fell back
`ThemeProvider` injects a Google Fonts stylesheet for venue-custom fonts
(Playfair Display, Cormorant, Lora, Montserrat, …), but `style-src 'self'`
blocked it — custom fonts never loaded. CSP now allows the Google Fonts CDN
(`style-src … https://fonts.googleapis.com`, `font-src 'self' data:
https://fonts.gstatic.com`); default brand fonts remain self-hosted.
- SO-05 regression test asserts the policy shape (CDN allowed, everything
  else still tight).
- `fonts.e2e.spec.ts` +1: set headingFont=Playfair Display via org config,
  assert the stylesheet loads 200 with zero CSP violations and the custom
  face is actually used.

## Verification
- Server unit: 684 → +12 (financial-legal +1, lifecycle-emails +1,
  portal-flow +1, staff-availability +1, security-ops +1, formatDate client
  +7). Full suites re-run before commit.
- e2e: fonts ×2 + calendar-placement all pass.
