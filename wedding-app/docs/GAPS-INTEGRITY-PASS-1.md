# Gaps & Integrity Pass 1 — Schedule Validation, Live Data, Vote Integrity

Nine commits across two hunting sessions, all on `main` / `develop` /
`staging` / `feature/fixes_web_app`.

## 1. Schedule validation — "ends before it begins" was accepted

- **Sub-events** (`d1ac18b`): `POST /api/events/:id/sub-events` and the
  PATCH accepted `endsAt < startsAt` (timeline already rejected this),
  so a guest-facing schedule could show an event ending before it
  starts. Ordering guard added on create (schema refine) and update
  (against the effective start — patching only `endsAt` compares to the
  stored `starts_at`). `subEventsRepo.findById` now returns the full
  row type.
- **Couple appointments** (`773470d`): same gap — a tasting could
  "end" before it began on the couple calendar. Ordering refinement on
  `appointmentRequestSchema`.
- Both with regression tests.

## 2. "Unsure" RSVP was recorded as a hard decline (`6bd5dd8`)

The guest RSVP wizard offers attending / declined / **unsure**, but the
submission mapped unsure → `attending:false`, so the guest was counted
as **DECLINED** — skewing headcounts, catering, and seating. The guests
table and counts have always supported `maybe`; only the submission path
lost it. `rsvpSchema` + `rsvpRepo.submit` now accept a tri-state
`status`; `'maybe'` sets `rsvp_status='maybe'` (leaning yes); the wizard
sends it; default behavior unchanged. Test: unsure → counts.maybe=1 /
declined=0.

## 3. Real-time updates died after 5 minutes (`a6f23fb`)

SSE uses a short-lived (5 min) token so the main JWT never appears in
URLs — but it was fetched **once**. On expiry the server drops the
stream and EventSource retries the same dead token forever, silently
killing real-time invalidation and notifications. The stream now
refreshes its token at 4 minutes (close + reconnect, preserving
`lastId`); `close()` clears the timer. 3 tests with a fake EventSource.

## 4. Guest & vendor portals now stay fresh

- **Guest portal** (`bbe9896`): advertised "What has changed?" notices
  but loaded once — schedule/shuttle edits never appeared on an open
  phone. Info now re-fetches every 5 minutes (well inside the 120/min
  rate limit).
- **Vendor portal** (`241459a`): chat polls every 5s but the run-of-show
  loaded once — a load-in re-time minutes before arrival wouldn't reach
  an open tablet. Info now refreshes every 60s.

## 5. Public vote/survey integrity (2 security fixes)

- **Poll votes** (`7ab3991`): the anonymous vote endpoint incremented
  counts per request (rate limit 30/min) — one person could inflate a
  poll by hundreds of votes. Votes now dedup per device session per poll
  (stored in poll metadata, capped) → `400 already-voted`.
- **NPS** (`ec15a43`): same flooding vector against the venue's
  scorecard. One response per device session per event → `400
  already-submitted`.
- Both with regression tests.

## 6. Magic-link origin documentation (2 docs commits)

Every emailed RSVP / password-reset / invite link is built from
`PUBLIC_APP_URL || BASE_URL || http://localhost:5173` — production magic
links pointed at localhost unless set. `.env.example` now uncomments and
warns about `BASE_URL`; README env table documents both vars.

## Verification

- Server **576 tests / 80 files** · Client **891 tests / 134 files** —
  both suites green.
- `tsc --noEmit` clean; client build + bundle budgets satisfied.
- Working tree clean; all branches in sync.
