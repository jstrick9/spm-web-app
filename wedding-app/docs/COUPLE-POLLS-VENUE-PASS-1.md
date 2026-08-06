# COUPLE-POLLS-VENUE-PASS-1 — couple hub venue name + public polls

A console/network sweep of every authenticated + guest surface found two
silent 403s that degraded real user flows:

## 1. Couple hub always showed "Your venue" (+ 403 on every load)
`CoupleEventHub` called `sdk.orgs.get(event.organization_id)` to learn the
venue's name and support email — but couples are EVENT members, not ORG
members, so `/api/orgs/:venueOrgId` returns 403. The query error was
swallowed; the hub fell back to "Your venue" forever, and every hub load
fired a 403.

**Fix**: `GET /api/events/:eventId` now enriches the event payload with
`organizationName` + `supportEmail` (read server-side from the org row, the
same couple-safe pattern the couple inbox already used). The hub dropped the
orgQuery and reads the enriched fields. Couples now see the real venue name.

## 2. Guest portal polls were permanently empty (+ 403 on every load)
The public portal loads venue polls with `sdk.feedback.getPolls(eventId)`,
but `GET /api/events/:id/polls` required auth (`feedback.view`) — every
guest load got a 403 the client swallowed, so the poll section never
rendered. The VOTE endpoint was already public + rate-limited (guests vote
anonymously), so poll content is guest-visible by design; the auth'd GET
was an inconsistency.

**Fix**: GET is now public + rate-limited (60/min) and 404s for unknown
events (no info leak). Response still returns only `meta.polls`.

## Regression coverage
- Server: `public-abuse.integration.test.ts` +1 (anonymous + outsider can
  read polls, unknown event 404s); `portal-flow.integration.test.ts` +1
  (org probe 403 for couple, event payload carries organizationName +
  supportEmail).
- Client: `formatDate.test.ts` +2 (`localDateString` local-vs-UTC, padding).
- e2e: `couple-venue-polls.e2e.spec.ts` — couple sees the venue's real
  name in the hub; guest portal renders a seeded poll (question + option).

## Bonus fix in the same sweep
DashboardScreen's "Today's events / Tomorrow / Upcoming" compared date-only
`start_date` against a UTC-derived "today" (`toISOString().slice(0,10)`) —
during US evenings today's events vanished from the Today section and
tomorrow's appeared. Now uses `localDateString()` (new helper in
`lib/formatDate.ts`).
