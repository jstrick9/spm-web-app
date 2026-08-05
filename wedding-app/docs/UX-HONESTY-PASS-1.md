# UX Honesty Pass — No More Fake Success Claims

A sweep for UI/server copy that claimed something happened when it didn't.
Five fixes, each with regression coverage.

## 1. Couple hub: failed sections masqueraded as "empty" (`59d28e0`)

The hub fires ~20 parallel section queries. A transient failure made a
section render its empty state — "No guests yet", "No messages yet" —
as if the data simply didn't exist. Now any failed section query shows a
`role="alert"` banner naming exactly which sections failed (guest list,
finance, documents, …) with a **Retry** button that refetches only the
failed queries; the banner clears once they load.
*Test: failed guests query → banner + retry refetches + banner clears.*

## 2. "Last synced" was `new Date()` on every render (`a33656e`)

The app shell claimed "Last synced 3:47 PM" even when nothing had synced
or the app was offline. `syncMonitor` already records every successful
request with a timestamp; the label now shows the newest successful
request time, and "—" before the first successful request.

## 3. Payment receipt fabricated a transaction time (`11affdd`)

The generated payment receipt printed `new Date()` when `created_at` was
missing — inventing a transaction time on a quasi-legal document.
Missing dates now render **"Not recorded"**.

## 4. Couple digest claimed "sent" when nothing was sent (`5cb9597`)

"Send wedding planning digest" returned `sent: true` and toasted "Digest
sent" while only inserting a history row. Now:
- with SMTP connected → a real `email.send` job is queued to the
  requester's address (`delivered: true`);
- otherwise `delivered: false`, `deliveryNote: 'recorded_in_history'`,
  history status `queued`, and the toast says "Digest recorded — saved
  to your reminder history" with a pointer to connecting venue email.
- Endpoint rate-limited (10/min). Regression assertions added.

## 5. "Send to Guests" was a tracking-only mark (`c523e5e`)

The invites builder toasted "Invitations Sent! Dispatched to N guests"
while the server only marks `invite_tracking` rows as sent — no email
ever goes out. Now labeled **"Mark all sent"**, preceded by a confirm
dialog ("this updates invite tracking only — it does NOT email anyone"),
and the toast says exactly that, pointing to Lifecycle Email Automations
for real sends. Test updated.

## Verification

- Client **888 tests / 134 files** · Server **574 tests / 80 files** —
  both suites green.
- `tsc --noEmit` clean; client build + bundle budgets satisfied.
- All commits pushed to `main` / `develop` / `staging` /
  `feature/fixes_web_app`.
