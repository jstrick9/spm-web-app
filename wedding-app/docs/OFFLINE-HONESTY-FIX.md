# Offline Honesty — Check-in Sync & Silent-Loss Fix

## The gap

The app advertised offline behavior in two places that didn't exist:

1. **Check-in app** claimed "if WiFi drops, updates will retry when the
   app comes back online" (and its SW comment claimed BackgroundSync
   covered check-ins — it only covers `PATCH /api/staff/tasks/*`). In
   reality an offline check-in failed, showed a scary "Status update
   failed — will retry when online" toast, and **never retried**.
2. **The global mutation safety net** (UX Pass 6) deliberately *skipped*
   offline errors on the theory that "the write queue owns retry" — but
   the persistent write queue (`dual-write/writeQueue.ts`) had **zero
   registered executors and zero enqueues**. Every non-check-in mutation
   that failed offline was therefore **silently lost** (no toast, no
   queue entry, no retry).

## What changed

### Check-in offline sync (the advertised behavior is now real)

- `VendorCheckInApp.tsx` registers a replay executor
  (`vendors` / `checkin.update`) at module load and, on an offline
  failure, **enqueues** `{ eventId, vendorId, status }` into the
  persistent queue instead of failing.
- On reconnect, the queue drains and replays the update in order; the
  server's `vendor.checkin` SSE then refreshes every open board.
- Toast copy is now honest and split:
  - offline → **"Saved on this device — it will sync automatically when
    you are back online"** (success, not error);
  - any other failure → the real error message.
- Fixed the false SW comment in the file header.

### Real-time refresh for check-ins

- `useRealtimeInvalidation.ts` gained a `vendor.checkin` handler that
  invalidates `['checkins', eventId]` and `['checkins']` — previously a
  status change on one tablet never refreshed another tablet's board.

### No more silent offline data loss

- `QueryProvider`'s MutationCache safety net no longer skips `offline`
  errors (it still skips `unauthorized` — the auth flow owns that).
- `unhandledErrorBus` renders honest copy for offline: **"You're
  offline — this change wasn't saved. Reconnect and try again."**
- Mutations with their own `onError` (like check-in now) still manage
  their own UX — no double toasts.

## Tests

- `VendorCheckInApp.test.tsx` +2: offline failure → queued + "Saved on
  this device"; drain replays the update and empties the queue.
  Non-offline failure → real error message + queue stays empty.
- `useRealtimeInvalidation.test.ts` +1: `vendor.checkin` invalidates the
  event + global check-in caches.
- `QueryProvider.test.tsx`: updated to assert the honest offline toast
  (regression for the silent-loss hole).

## Verification

- Client suite green: **885 tests / 134 files** (was 882/134).
- `tsc --noEmit` clean; production build + bundle budgets satisfied.
