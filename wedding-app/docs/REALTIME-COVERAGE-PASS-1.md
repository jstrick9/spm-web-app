# REALTIME-COVERAGE-PASS-1 — SSE event-type parity

Session date: 2026-08-05

## Problem

A scripted diff between server SSE broadcasts and client invalidation
handlers found **8 mismatched event types**:

### Server broadcast → no client handler (stale UI)
- `staff.area_created` / `staff.area_deleted` — staff-area changes never
  refreshed the staffing panel.
- `vendor.updated` / `vendor.deleted` / `vendor.payment` — vendor edits,
  deletions, and payments never invalidated vendor tabs, run sheets, the
  couple vendor board, vendor matches, payment dialogs, or portal tokens.

### Client handler → no server broadcast (dead handlers)
- `couple.design_submitted` — the couple design review submission wrote a
  request row but never broadcast, so venue managers didn't see it live.
- `integration.connected` / `integration.error` — integration verify
  success/failure only wrote audit rows; the integrations hub never
  refreshed in real time.
- `lifecycle_email.sent` — manual "send now" never broadcast; the
  lifecycle-emails tab stayed stale until manual refresh.

## Fix

**Client** (`client/src/lib/useRealtimeInvalidation.ts`): added handlers for
the five server-only events, invalidating `['vendors', eventId]`,
`['vendor-board']`, `['vendor-matches', eventId]`, `['vendorPayments']`,
`['vendor-portal-tokens']`, `['staffingRequirements']` as appropriate.

**Server**:
- `integrations/runtime.ts` `verifyIntegration()` — broadcasts
  `integration.connected` on success and `integration.error` on failure
  (with the error message) so the hub updates live.
- `routes/couple/planning.ts` `couple-design/submit-review` — broadcasts
  `couple.design_submitted` with `eventId` + `requestId`.
- `routes/lifecycleEmails.ts` manual-send route — broadcasts
  `lifecycle_email.sent` with trigger type and scheduled count.

## Tests

- `client/src/lib/useRealtimeInvalidation.test.ts` (+5): handler registration
  for all five vendor/staff-area events; invalidation targets for
  vendor.updated/deleted/payment and staff.area_*.
- `server/src/routes/integrations-module.integration.test.ts`: Twilio
  verify-failure now asserts an `integration.error` SSE row.
- `server/src/routes/lifecycle-emails.integration.test.ts`: manual thank-you
  send asserts a `lifecycle_email.sent` SSE row.
- `server/src/routes/portals-module.integration.test.ts`: couple design
  review submission asserts `couple.design_submitted` SSE row (and staff is
  still 403).

## Verification

- Full suites green: server 660+ / client 905+.
- `tsc --noEmit` clean on both apps.
- SSE diff is now empty in both directions (all broadcast types handled;
  all handlers have a real broadcast source).

## Follow-up — unhandled promise rejections in click handlers

- `CoupleEventHub` planning-task "Ask" button called
  `sdk.couple.askPlanningTaskQuestion` with no catch — a network/4xx failure
  was a silent unhandled rejection. Now shows a destructive toast.
- `DashboardScreen` layout approval queue "Approve" / "Request changes"
  buttons called `sdk.layouts.queueDecision` with no catch. Now wrapped with
  success/error toasts.
- `DashboardScreen.test.tsx` now wraps renders in `ToastProvider` (the new
  `useToast` hook requires it).
- Automated sweep confirms zero remaining unhandled `await sdk.*` patterns
  in click/submit handlers.
