# Connectivity & Recovery Pass 1 — Honest Status, Working Recovery

Three fixes this round, all on `main` / `develop` / `staging` /
`feature/fixes_web_app`.

## 1. ErrorBoundary "Clear Session & Restart" didn't clear the session (`d6d63a8`)

The crash-recovery button removed `wvi_auth_token` — a legacy key that
never held the JWT (the real key is `wedding-jwt` in `sdk/client.ts`).
A user stuck on a crash screen who clicked "Clear Session & Restart"
would reload **still logged in**, defeating the button. Now clears the
real token key (plus the legacy one for safety).

## 2. "Live Stream Active" badge lied (`d6d63a8`)

The dashboard's SSE badge only flipped to "Live Stream Active" on the
**first event** and never turned off — after the stream died (server
restart, token expiry), the badge kept claiming live updates. The SSE
stream now exposes `onStatus()` (`open` / `error` / `closed`) and
`useSSE` maps it to `isConnected`, so the badge honestly drops within a
second of the stream failing (and returns when EventSource reconnects).
Also removed a **duplicate `onerror` assignment** in `sdk/sse.ts` that
silently overwrote the new handler — a latent ordering bug that would
have kept the badge broken.

## 3. Magic-link origin centralized (`b8d2a6b`)

Seven call sites each reimplemented
`PUBLIC_APP_URL || BASE_URL || http://localhost:5173` — silent drift
risk, and zero visibility when production emailed links point at
localhost. New `appPublicBaseUrl()`:
- identical precedence + normalization everywhere;
- **warns once in production** when the origin resolves to localhost, so
  the misconfiguration shows up in logs instead of only in broken links;
- 4 unit tests.

## 4. Rate limits no longer masquerade as server errors (`f800c77`)

A guest hitting "Request secure link" (5/15 min) saw a misleading
"Server error" toast, and the query retry policy re-fired into the same
limit. `429` now classifies as its own `ApiError` kind `rate-limited`:
friendly copy ("Too many requests — please wait a moment") in the error
safety net, and queries **skip retrying** rate-limited responses.
Regression tests for classification + no-retry.

## Verification

- Server **580 tests / 80 files** · Client **894 tests / 134 files** —
  both suites green.
- `tsc --noEmit` clean; client build + bundle budgets satisfied.
- Working tree clean; all branches in sync at `f800c77`.
