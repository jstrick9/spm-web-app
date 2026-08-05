# Session doc — inline error states, PWA audit, SSE/auth probe batch #6

Session date: 2026-08-05

Five focused passes, each with regression tests, all pushed to the four
branches (`main`, `develop`, `staging`, `feature/fixes_web_app`).

---

## 1. Couple-hub per-section inline error treatment

**Before:** the couple hub had a global failure banner, but every section
still rendered its false empty state ("No X yet") or a fabricated 0% when
its query failed — a network blip looked like "the venue hasn't shared
anything".

**Fix (`CoupleEventHub.tsx`):**
- New `SectionLoadError` component (inline warning + per-section Retry).
- Event Week updates, RSVP progress, and Documents sections now show the
  inline error instead of the false empty state / 0%.
- The Wedding readiness score shows "—" when any score source
  (guests/planning/profile/timeline/layout) failed — no fabricated 0%.
- Tests: +2 new, +2 updated (multi-alert tolerance, no misleading 0%).

## 2. PWA / offline audit

**Found (severe):** the client had NO `public/` directory — every icon the
manifest and `index.html` reference (`pwa-192x192.png`, `pwa-512x512.png`,
`apple-touch-icon.png`, `mask-icon.svg`, `favicon.svg`, `favicon.ico`)
404'd; install-to-home-screen showed a blank tile.

**Fixes:**
- Branded icon set created (plum `#4A1942`, interlocking rings) in
  `client/public/`; precache 80 → 86 entries; manifest icons resolve.
- `sw.ts` `/api/portal/.*` route restricted to GET — RSVP/help/privacy/
  memory POSTs were being routed through the offline cache layer,
  interfering with the app's own offline write queue.
- `notificationclick` open-redirect guard: payload URLs are sanitized via
  new pure helper `lib/swUrl.ts` (same-origin paths and `#` hash routes
  only; `javascript:`/`data:`/cross-origin → `/`). 5 unit tests.

## 3. Probe batch #6 — SSE + auth-token edge cases

`server/src/routes/probe-batch6.integration.test.ts` (9 tests):
- sse-token: auth required, org-scoped (403 for other orgs), `sseOnly`
  claim present.
- Stream rejects no-token / main-JWT / malformed tokens / garbage orgs.
- Adversarial `lastId` values (`NaN`, `Infinity`, `1e999`, negative,
  whitespace, `%00`) — verified via a real HTTP socket (app.inject can't
  complete on never-ending SSE): **never 5xx**.
- Tampered / expired / wrong-session-version JWTs → 401; disabled user →
  401; password-reset token reuse/malformed → 400; magic-link garbage → 4xx.
- Logout audit row + password-change session invalidation.

**Server improvement found by the probe:** the SSE stream wrote nothing
until an event or the 30s heartbeat. Added an immediate `: connected`
keep-alive comment on connect (best practice; lets clients/proxies see the
stream as open instantly). Native EventSource ignores comments.

## 4. SSE client reconnect resilience (`sdk/sse.ts`)

- `onerror` now closes the dead EventSource (which would otherwise retry
  the same expired-token URL forever) and reconnects with a fresh sse-token.
- Token-fetch failures (offline at startup, 401 blips) schedule a debounced
  retry instead of dying silently.
- `close()`/dispose cancels pending reconnect timers; re-subscribing re-arms;
  `onopen` cancels pending reconnects.
- Tests: +3 (fresh-token reconnect, fetch-failure retry, no stray timers).

## 5. Guest memory-submission URL scheme hardening

**Found:** `z.string().url()` accepts `javascript:`, `data:`, `vbscript:`
schemes — guests could store `javascript:alert(1)` as a "photo link" that
later surfaces to venue staff review (latent stored-XSS / phishing vector).

**Fix:** `guestMemorySubmissionSchema.photoUrl` restricted to http/https
(400 `photo-url-unsafe-scheme`). Regression tests for all three unsafe
schemes in the portal-flow suite.

## Verification

- Server: 669 tests / 88 files, full suite green.
- Client: 924 tests / 138 files, full suite green.
- `tsc --noEmit` clean both apps; `npm run build` + bundle budgets pass.
