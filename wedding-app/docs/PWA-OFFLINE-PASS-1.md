# PWA-OFFLINE-PASS-1 — missing icons, GET-only portal cache, notification URL guard

Session date: 2026-08-05

## 1. PWA icons did not exist (install-to-home-screen showed a blank tile)

`vite.config.ts` references `pwa-192x192.png`, `pwa-512x512.png`,
`apple-touch-icon.png`, `mask-icon.svg`, `favicon.ico` in the manifest and
`index.html` links `/favicon.svg`, `/apple-touch-icon.png` — but the client
had **no `public/` directory at all**, so every icon 404'd.

**Fix:** created `client/public/` with a branded icon set (plum `#4A1942`
tile, interlocking rings, gold accents) rendered via SVG + ImageMagick:
`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png` (180),
`mask-icon.svg`, `favicon.svg`, and a multi-size `favicon.ico`. Precache
grew 80 → 86 entries; manifest icons now resolve.

## 2. Portal API cache intercepted POST endpoints

`registerRoute(/\/api\/portal\/.*/i, NetworkFirst(...))` matched **all
methods**, so RSVP submits, guest help requests, privacy requests, and
memory submissions were routed through the offline cache layer — interfering
with the app's own offline write queue and holding network failures.

**Fix:** restricted the route to `'GET'`. Reads keep the offline fallback;
writes always reach the server.

## 3. Push notification click could open arbitrary origins

`notificationclick` used `event.notification.data?.url` verbatim in
`clients.openWindow(url)` — a crafted/compromised push payload could
navigate the browser to any origin (open-redirect / phishing surface).

**Fix:** new pure helper `lib/swUrl.ts` `sanitizeNotificationUrl()` —
same-origin paths and in-app `#` hash routes only, everything else falls
back to `/`. Wired into `sw.ts`; unit-tested (5 tests).

## Verification

- `npm run build` green; bundle budgets satisfied.
- Full client suite green.
