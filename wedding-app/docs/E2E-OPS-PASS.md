# E2E-OPS-PASS — vendor portal, offline write queue, couple hub (real-browser)

Session date: 2026-08-05

Three deeper real-browser e2e specs were added to the Playwright harness.
Building them surfaced and fixed **two genuine production bugs**.

---

## 1. Vendor-portal E2E (`e2e/vendor-portal.e2e.spec.ts`)

Full vendor onboarding loop in a real browser: venue issues a portal token →
vendor opens `#/vendor/:id?token=…` → fills + submits the Logistics
Questionnaire (arrival/departure/team size/COI expiry) → uploads a real COI
PDF through the browser file input (magic-byte validated server-side) →
sends a chat message → venue-side API verification of questionnaire
metadata, `coiVerificationStatus: pending_review`, and the vendor's message
in the shared thread (`sender_role: 'vendor'`).

Idempotency: a fresh vendor is created per run (a repeat run must not find
the questionnaire already submitted).

## 2. Offline write-queue E2E (`e2e/offline-queue.e2e.spec.ts`)

The day-of check-in board's offline promise, verified end-to-end: load the
board → "WiFi drops" (route-abort the check-ins endpoint → the same
`ApiError('offline')` a real tablet gets) → tap **Mark Arrived** →
"Saved on this device" toast + the write is in the persistent
`wedding.writeQueue` with the right payload → connectivity returns + reload
→ the queue drains automatically → the server's status for that vendor is
`arrived` and the queue is empty.

**Two real bugs found while building this spec:**

### a) Silent offline-write loss on app restart (writeQueue.ts)
The app's startup drain runs 100 ms after boot — BEFORE the lazy-loaded
check-in chunk registers its replay executor. `drain()` treated
"no executor" as a permanent failure and **dropped the write**. On a real
tablet: a check-in queued offline would be silently erased when the app
was restarted before the queue drained.

**Fix:** no-executor writes are now *retained* (`willRetry: true`) and
`registerExecutor()` kicks a drain when a domain chunk finally loads. Tests:
+2 (retention, auto-drain on executor arrival).

### b) Double-queue conflict in the service worker (sw.ts)
`sw.ts` routed check-in POSTs through Workbox BackgroundSync **and** the app
has its own persistent write queue for the same writes (the code comment
even claimed the SW "covers staff tasks, not check-ins" — but it routed
check-ins too). Two competing queues meant double-replay risk and the SW
could shadow the app's user-visible offline UX.

**Fix:** removed the check-ins bgSync route from the SW; the app's queue is
the single mechanism (it shows "Saved on this device" and replays
deterministically). Staff-task PATCH bgSync stays.

## 3. Couple-hub share/summary E2E (`e2e/couple-hub.e2e.spec.ts`)

Couple user invited via the couple-invitation API, logs in, and exercises
both client-side export surfaces: **Share** (headless falls back to the
clipboard; the success toast + clipboard content are asserted) and **Save
summary** (a real `.txt` download whose content includes the event title,
"Wedding Summary", and the guest/RSVP line).

## Harness hardening (suite stability)

The full suite now passes deterministically (6 passed, 1 pre-existing skip):
- **Tour state**: specs complete the onboarding tour via API before the
  browser session (a previously-interrupted run left the modal `in_progress`
  and it intercepted clicks forever).
- **Double-toast rendering** (Radix renders title twice) → `.first()`.
- **`navigator.share` stub** so the clipboard fallback path is deterministic.
- **`require` → ESM import** in the download-read path.

## Verification

- Playwright e2e (real Chromium, production build): **6 passed / 1 skipped**.
- Server vitest: 674 tests / 91 files green.
- Client vitest: 930 tests / 138 files green (writeQueue +2).
- `tsc --noEmit` clean; `npm run build` + bundle budgets pass.
