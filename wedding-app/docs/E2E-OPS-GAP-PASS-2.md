# E2E-OPS-GAP-PASS-2 — a11y, push, couple-hub flows + guest CSV import

Session scope: resume the autonomous gap-hunt at the open candidates from
E2E-OPS-PASS (guest-portal a11y scan skipped, push-notification verification,
couple-hub remaining interactive flows), plus a real feature gap found while
hunting.

## Bugs / gaps found & fixed

### 1. Guest CSV import was a preview-only dead end (FEATURE GAP)
The couple hub's "Guest import concierge" ran `import-preview` and explicitly
said *"Nothing saved yet"* — there was **no import action anywhere** (venue
side has `ImportGuestsDialog`, couple side had none). A couple pasting their
spreadsheet could never get guests out of it.

**Fix** — full save-side import:
- `POST /api/events/:eventId/couple-guests/import` (`routes/couple/guests.ts`):
  - Field mapping: full name, email, phone, household/party, mailing address,
    RSVP status, meal choice, dietary, accessibility, tags (`|`-separated).
  - Dedupe semantics (locked by tests, and mirrored into `import-preview` so
    preview and import agree):
    - **email is the primary key** — same email = skip + duplicate signal;
    - **name is the fallback key only for rows without an email**
      (grandparents/kids have no email; a fixed re-import must not duplicate
      them);
    - same-name-different-email rows import (different people);
    - in-file duplicate names skip.
  - Invalid RSVP statuses normalize to `pending` with a row warning.
  - 2,000-row cap (`too-many-rows`), transactional `bulkCreate`, audit row
    `couple.guest.import`.
- Client: `sdk.couple.importGuests` + UI "Preview import → Import N guest(s)"
  button with success/error toasts; textarea edit resets the success state.

**Regression tests**
- `server/src/routes/couple-guests-import.integration.test.ts` (9): full field
  mapping, idempotent re-import, in-file name dupes, same-name-different-email,
  missing-fullname-column 400, RSVP normalization, 2k cap, outsider 403, audit.
- `client/src/screens/couple/CoupleEventHub.test.tsx` (+2): preview→import
  happy path + failed-import error toast.
- `client/e2e/couple-hub.e2e.spec.ts` (+1): real-browser paste → preview →
  import → server-side guest verification.

### 2. Guest-portal a11y scan silently skipped in e2e
`a11y.a11y.spec.ts` skipped without a `.a11y-event-id` marker file. Now it
self-resolves a seeded event id via the demo owner's API (same logic as
`scripts/a11y-test.sh`) and **additionally scans the RSVP tab** (the portal's
highest-interaction surface). Result: guest portal home + RSVP tab both scan
clean under WCAG A/AA (0 violations).

### 3. E2E suite self-DoS'd the auth rate limit
Playwright specs share one IP; `register` is 5/min, `login` 30/min — the full
suite (10+ registrations) 429'd intermittently at random points.
**Fix**: explicit `E2E_RATE_LIMIT_BYPASS=1` env opt-in on the rate-limiter
allowList (harness-only; never set in prod), wired into `scripts/a11y-test.sh`
and the local server launch. The rate limiter itself remains covered by
integration tests using non-allowlisted IPs.

### 4. Time-of-day flake in greeting assertions
Two specs asserted `/good evening/i` — the app greets by clock time, so the
suite failed at 2 AM. Now `/good (morning|afternoon|evening)/i`.

### 5. Headless Chromium quirks handled in specs (harness-only, documented)
- **First `fill()` after an SPA navigation silently no-ops** (Input.insertText
  doesn't commit) — `fillInput()` helper clicks + retries until the value
  sticks (real user typing unaffected).
- **Sticky app header intercepts clicks** after auto-scroll —
  `clickSafely()` centers the element first.
- `page.reload()` can outlast the 30s budget under the service worker —
  reload with `domcontentloaded` (drain is timer-driven; assertions poll API).

### 6. Push-notification UX verification (new e2e)
`push-ux.e2e.spec.ts`: notification center shows the Browser push toggle; with
no VAPID keys the UI says so up front; toggling yields a graceful inline
`role="alert"` (never an uncaught exception), and the app stays interactive.
Also added: cross-org push subscribe → 403 regression test
(`push.integration.test.ts`).

## Verification
- Server: **684 passed / 92 files** (was 674/91).
- Client: **932+ passed / 138 files** (was 930/138; +2 import tests).
- e2e: **10 passed / 0 skipped** (was 6 pass / 1 skip / 2 flaky): a11y ×2,
  couple-hub ×3, happy-path, offline-queue, push-ux, pwa, vendor-portal.
- `git status --porcelain` = 0; all 4 branches pinned to the same commit.

## Session-2 additions (same pass)

### 7. Write queue: transient failures could strand writes forever (APP BUG)
The offline-queue e2e surfaced that a **single transient failure after a
reload stranded the queued write permanently**: the drain only retried on a
`server-reachable` event, which fires solely on a false→true transition and
stops once the app settles (no polling). A tablet that reconnects mid-SW
update — or any one-off network blip — would silently keep its write queued
forever.

**Fix** (`dual-write/writeQueue.ts`): transient failures (`offline`, 5xx)
now persist the attempt count and schedule an automatic retry with bounded
exponential backoff (2s → 4s → 8s → … capped at 60s). Event-driven drains
(`server-reachable`, `token-changed`, `registerExecutor`) still fire
immediately when connectivity actually returns. Regression tests ×4
(fake timers): offline auto-retry succeeds, backoff grows, 5xx auto-retry,
no regression on existing semantics. **This is a genuine reliability fix,
not just harness hardening.**

### 8. e2e: `page.goto(sameUrl)` silently no-ops under the service worker
Tried to make the offline spec's reload more robust with
`page.goto(page.url(), …)` — in this environment the same-URL navigation
under a controlling SW does **not** create a new document (verified via a
document marker), so the queue never re-drained and the spec failed
deterministically. Root fix: keep `page.reload()`, with
`waitUntil: 'domcontentloaded'` (the `load` event can lag under the SW;
the queue drains on DOM ready and assertions poll the API). Spec stress-run
3/3 green after the fix.

## Verification (final)
- Server: **684 passed / 92 files**.
- Client: **935 passed / 138 files** (+3 write-queue retry tests).
- e2e: **10 passed / 0 skipped** (a11y ×2, couple-hub ×3, happy-path,
  offline-queue, push-ux, pwa, vendor-portal).
- `git status --porcelain` = 0; all 4 branches pinned to the same commit.

## Notes for next session
- `E2E_RATE_LIMIT_BYPASS=1` must be set on the harness server launch.
- The mid-session sandbox restore wipes `node_modules`/`dist`/browser caches
  and can roll back `.git`/`node_modules`/`dist` mid-turn — reinstall +
  rebuild + reinstall chromium after any long gap, and re-verify `git log`
  before committing.
- Never use `page.goto(page.url())` as a reload substitute in e2e specs —
  it can no-op under the service worker; use `page.reload()` with
  `waitUntil: 'domcontentloaded'`.
