# UX Improvements — Pass 6

Scope: **error handling honesty** and **audit-log filter correctness**, plus
the push-notification feature gap (see `PUSH-NOTIFICATIONS.md`).

---

## UX-6a — Silent mutation failures now surface (global safety net)

**Problem:** an audit of every `useMutation` in the app found **64 of 164
mutations (39%) had no `onError` handler**. When one of those failed —
a delete, a save, a toggle — the user clicked and *nothing happened*.
Silent failures are the fastest way to lose trust in a CRUD tool.

**Fix (one place, zero per-mutation churn):**

- `lib/unhandledErrorBus.ts` (new) — framework-free pub/sub so the error
  can flow from `QueryProvider` (which mounts *outside* `ToastProvider`) to
  the toast renderer without provider-ordering constraints.
- `dual-write/QueryProvider.tsx` — a `MutationCache.onError` safety net
  that:
  - **skips mutations that pass their own `onError`** (they own their UX —
    no double toasts) by inspecting `mutation.options.onError`;
  - **skips `offline`** (the dual-write queue owns retry) and
    **`unauthorized`** (the auth flow owns redirect);
  - routes everything else to the bus.
- `ui/Toast.tsx` — subscribes and renders a destructive toast with
  **kind-specific copy**: permission needed / not found / conflict /
  validation / server error, with the server's human message when present.
  Also bumped the default toast duration from 1 s (too fast to read) to 5 s;
  error toasts show 8 s.

**Tests** (`dual-write/QueryProvider.test.tsx`): no-onError mutation →
destructive toast; own-handler mutation → no double toast; offline error →
no toast.

## UX-6b — Audit log filters now match reality (server-side)

**Problems found in the audit screen:**

1. **Action chips lied.** Chips were derived from *the currently loaded page
   only* and filtered *client-side* — "All (200)" when the org has 2,000
   records, and clicking "Event Created" searched just one page of history.
2. **Actor filtering was a hidden heuristic.** Typing an email into the
   free-text search box silently switched to a server filter; typing a name
   silently didn't. Users couldn't tell which mode they were in.
3. **Paging didn't reset on filter changes.** Page back into history, then
   change the action filter → you got a filtered slice of an old window,
   which reads as "missing records".
4. **No time-range filter**, even though the API supports `after`.

**Fix (toolbar rebuilt):**

- **Actor email input** (explicit, labeled, with a Clear button) → sent as
  the server's `actorEmail` (exact match, case-insensitive), participates in
  `total`/paging. The `@`-in-search heuristic is gone; free-text search is
  now honestly labeled "Search loaded records".
- **Action chips** → a curated list applied **server-side** across the whole
  history (the API already supported exact `action`); counts removed (they
  were misleading).
- **Time range select** (All time / 24 h / 7 d / 30 d) → server `after`.
- **Paging resets on any filter change** (search, actor, action, range).
- **"Server-filtered" badge** + "Clear all filters" so the user always knows
  the query is filtered and how.
- Empty-state copy updated for the server-filter case; the pager's
  "Showing X of Y" now reflects the filtered server totals.

**Tests** (`AuditLog.test.tsx`, rewritten/extended): actor email sent +
paging reset; chip → `action` param + badge + toggle-off; time range →
`after` timestamp; clear-all resets everything.

## UX-6c — Bug: `api.delete` dropped its body (push unsubscribe always failed)

`sdk/client.ts`'s `delete` helper never forwarded a request body, so the
push-unsubscribe call (`DELETE /api/push/subscribe` with `{ endpoint }`)
always hit the server without a body → `400 endpoint-required`. Fixed the
helper signature to match `post/put/patch` and the SDK call; regression
tests at the SDK level (the old code fails them).

## UX-6d — Feature gap: push notifications were never wired up

Full detail in `docs/PUSH-NOTIFICATIONS.md`. Summary: server API + service
worker existed; subscription UI and send-side did not. Added the
subscription hook, the bell toggle, the web-push delivery service, job
wiring (timeline reminders + guest-help SLA), a VAPID key generator
(`npm run push:keys`), and `GET /api/push/status` so the UI can explain
"not configured" instead of failing silently.

## Verification

- Server: **550 tests / 77 files** (was 540/76).
- Client: **861 tests / 130 files** (was 839/127).
- `tsc --noEmit` clean (both apps), production build clean, bundle budgets
  satisfied (main 208/300 KB, react 140/190 KB, radix 160/210 KB).
- Live smoke: register → subscribe 201 → status 200 → unsubscribe 200.
