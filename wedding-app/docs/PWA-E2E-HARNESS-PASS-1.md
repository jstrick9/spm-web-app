# PWA-E2E-HARNESS-PASS-1 — reload loop, SW registration, rate-limiter, deploy packaging

Session date: 2026-08-05

This pass added a real-browser PWA/offline e2e spec to the Playwright
harness — and the harness immediately exposed **four genuine production
bugs**, including a self-inflicted reload loop that rate-limited the app
into unusability.

---

## 1. Service worker reload loop (critical)

**Symptom:** after login the app reloaded itself ~4-8× in a row, firing
~150 API requests per 6 seconds, tripping the API rate limiter (429s on
`/api/auth/me` etc.), which bounced the app back to the login screen or
threw ErrorBoundary chunk-import failures. The happy-path e2e failed every
time.

**Root cause chain:**
- The PWA's SW was never registering in production (vite-plugin-pwa's
  `virtual:pwa-register` compiled to a no-op stub), so we added explicit
  registration in `main.tsx`.
- `sw.ts` calls `skipWaiting()` + `clientsClaim()`, so on first install the
  SW takes control MID-SESSION → `controllerchange` fires →
  `ReloadPrompt`'s handler called `window.location.reload()`.
- Each reload re-registered/re-activated the SW → another
  `controllerchange` → another reload → **infinite reload loop**.

**Fix:** the update prompt is now **user-initiated only** (banner → click
"Reload" → SKIP_WAITING → reload). Auto-reloading mid-session was never
good UX anyway. Verified: page loads per session dropped from 8 → **1**.

## 2. Service worker never registered in production

`useRegisterSW` from `virtual:pwa-register/react` compiled to a stub —
`navigator.serviceWorker.getRegistrations()` returned 0 in a real browser,
so there was no offline shell, no push, and no update prompt. Fixed with an
explicit `navigator.serviceWorker.register('/sw.js')` in `main.tsx`
(production only) and a rewritten `ReloadPrompt` driven by raw
`updatefound`/`controllerchange` events.

## 3. Rate limiter counted static assets (self-DoS)

`@fastify/rate-limit` (300/min/IP, global) applied to EVERY route including
static files — a code-split SPA burns 150+ chunk requests per page load, so
two rapid loads exhausted the budget and 429'd the API mid-session. The
allowlist is now a function that exempts non-`/api/` paths (and keeps the
test-mode localhost bypass). Verified: static assets never 429; API limits
still enforce (320-request probe → 429 at the threshold).

Also raised login from 10/min to 30/min per IP (venue offices share IPs;
brute-force protection stays on the account-level failed-login lockout).

## 4. Server build didn't ship SQL migrations (deploy-blocking)

`tsc` doesn't copy `.sql` — `dist/db/migrations` was missing, so
`node dist/index.js` (production boot, smoke + a11y harnesses) crashed at
boot-time `applyAllMigrations()`. New post-build step
`scripts/copy-assets.js` copies `src/db/migrations` into `dist`.

## 5. Harness hardening

- **Seed:** demo owner's onboarding tour is pre-completed (the welcome
  modal's async save raced browser automation; now the harness never sees
  it).
- **happy-path spec:** waits for the tour modal before dismissing it
  (previously raced its late appearance).
- **New `e2e/pwa.e2e.spec.ts`:** manifest + every declared icon resolve,
  the SW registers/activates/controls, and with the browser set OFFLINE a
  reload still serves the precached app shell.

## Verification

- e2e (real Chromium, production build): happy-path + pwa specs **both
  pass**.
- Server vitest: 674 tests / 91 files green.
- Client vitest: 928 tests / 138 files green.
- `tsc --noEmit` clean; `npm run build` + bundle budgets pass.
