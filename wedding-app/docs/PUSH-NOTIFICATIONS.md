# Push Notifications — End-to-End

## Status before this change (NON-FUNCTIONAL feature)

The platform shipped with a **server-side push API** (`/api/push/subscribe`,
`/api/push/subscriptions`, `/api/push/vapid-key`, `push_subscriptions` table,
integration tests) and a **service worker** that could render `push` events —
but the middle was missing:

1. **No client ever subscribed.** `sdk.push.subscribe()` had zero callers, so
   no user could enable push even in a fully configured deployment.
2. **Unsubscribe was broken by a client bug.** `api.delete()` ignored its
   `body` argument, so `pushSdk.unsubscribe(endpoint)` never sent the
   endpoint; the server replied `400 endpoint-required`. Dead subscriptions
   could never be removed.
3. **No server send-side existed.** Nothing delivered a push — even with a
   subscription on file, `web-push` was never invoked.

Net effect: push notifications were a phantom feature. Everything below
closes the loop.

## What changed

### Client

- **`sdk/client.ts`** — `api.delete(path, body?, opts?)` now accepts a body
  (matching `post/put/patch`). This fixes any future DELETE-with-payload
  call, not just push.
- **`sdk/push.ts`** — `unsubscribe(endpoint)` now actually sends
  `{ endpoint }`; added `status()` for the new `/api/push/status` endpoint.
- **`lib/usePushNotifications.ts`** (new) — full subscription lifecycle:
  - detects browser support (PushManager + service worker + Notification);
  - reads the server's VAPID configuration state and the browser's existing
    subscription on mount (toggle stays in sync across reloads);
  - `enable()` — requests permission → fetches the VAPID key → subscribes via
    `pushManager.subscribe` → registers the endpoint server-side;
  - `disable()` — unregisters server-side, then drops the local subscription;
  - every failure mode (unsupported browser, denied permission, missing
    server VAPID keys, no org) surfaces as a friendly `error` string.
- **`components/notifications/NotificationCenter.tsx`** — new "Browser push"
  toggle in the notification bell dropdown (aria-pressed switch, busy state,
  `role="alert"` errors, "not configured" hint when the server lacks VAPID
  keys). `AppShell` now passes the user's memberships through so the hook
  knows which org to subscribe against.
- **`sw.ts`** — already rendered `push` events and handled
  `notificationclick` (deep-link navigation); unchanged.

### Server

- **`src/push/service.ts`** (new) — web-push delivery:
  - `isPushConfigured()` — degrades gracefully when `VAPID_*` env keys are
    missing (like SMTP: the platform runs, push just isn't sent, and the
    client shows the "not configured" state);
  - `sendPushToOrg()` / `sendPushToUser()` — sends a JSON payload
    (`{ title, body, url, tag }`) with a 24 h TTL to every subscribed
    device;
  - **stale pruning** — 404/410 responses from the push service delete the
    dead subscription so we never hammer invalid endpoints;
  - **failure audit** — real delivery failures (5xx etc.) write one
    `push.send.failed` audit row (successes are not audited — that would
    flood the log).
- **`routes/push.ts`** — added `GET /api/push/status` (auth required)
  returning `{ configured }`.
- **`jobs/timelineReminders.ts`** — in-app timeline reminders now also
  dispatch a web push (`tag` groups per-event reminders).
- **`jobs/guestHelpSla.ts`** — SLA breaches now also dispatch a web push.
- **`scripts/generate-vapid-keys.ts`** (new) + `npm run push:keys` — prints
  the three `VAPID_*` lines for `.env`.
- **`.env.example` / README / OPERATIONS_RUNBOOK** — VAPID docs + ops
  section (rotate keys → subscriptions invalidate; users just re-toggle).

## Delivery sources today

| Source | Trigger | Push payload |
|---|---|---|
| Timeline reminder (in_app) | worker scan (60 s) | "⏰ {item}" → `/events/:id?tab=timeline` |
| Guest-help SLA breach | worker scan (hourly) | "⚠ Guest help request past SLA" → `/events/:id?tab=guest-help` |

## Configure

```bash
cd server
npm run push:keys          # prints VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT
# paste into wedding-app/.env, restart the server
```

Users then toggle **Browser push** in the notification bell (top-right).
HTTPS (or localhost) is required by the browser for the Push API.

## Tests

- `server/src/push/service.test.ts` (9) — configured/unconfigured paths,
  org/user targeting, stale 404/410 pruning, failure audit, and wiring
  proofs for both jobs (reminder + SLA breach fire a push).
- `server/src/routes/push.integration.test.ts` (+1) — `/api/push/status`.
- `client/src/sdk/sdk.test.ts` (+3) — subscribe round-trip and the
  DELETE-with-body regression (fails on the old `api.delete`).
- `client/src/lib/usePushNotifications.test.ts` (7) — unsupported browser,
  existing-subscription detection, enable/disable, denied permission,
  missing VAPID, missing org.
- `client/src/components/notifications/NotificationCenter.push.test.tsx`
  (6) — toggle on/off, VAPID hint, error alert, unsupported state.
