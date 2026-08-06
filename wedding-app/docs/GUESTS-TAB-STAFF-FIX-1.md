# GUESTS-TAB-STAFF-FIX-1 — venue staff lost the event Guests tab (+ the guest-help inbox)

## Bug
Commit `e856cdc` ("reserve event guest tab for couples") gated the event
detail's Guests tab to couples only:

```js
TAB_DEFS.filter((t) => hasPermission(t.permission) && (t.id !== 'guests' || isCoupleForEvent))
```
and rendered `<AccessDenied feature="Couple guest management" />` for
non-couples. Consequences for VENUE STAFF:
1. **No per-event guest management** — creating/importing guests, editing
   RSVP status, dietary, seating, lodging per event (EventGuestsTab) became
   unreachable. The org-wide Guest Browser only browses/merges/exports.
2. **The guest-help inbox became unreachable** — GuestHelpInbox renders only
   inside EventGuestsTab. Guests who requested help from the public portal
   (cannot-find-name, event-week questions) were invisible to the venue
   team — the SLA/email machinery kept running but no UI could surface it.
3. **Dead-end click-through** — the Guest Browser's "click through to event
   detail's guest tab" navigated staff to an AccessDenied page.

## Fix
Restored the Guests tab to everyone with `guests.view` (venue staff AND
couples), and the content to a normal permission-gated tab. Couples keep
the tab (they had it before and after the reservation commit); staff get
their per-event guest tools + the help inbox back.

## Regression coverage
- `EventDetail.test.tsx`: +1 (staff with guests.view sees the Guests tab);
  the RBAC-allowed-tabs assertion updated to expect the tab (grantAll is
  the beforeEach default).
- `e2e/guest-support-loop.e2e.spec.ts` (NEW): full loop — guest clicks
  "I cannot find my name" in the public portal → help request created →
  venue opens the event's Guests tab → sees the request → "Reply + resolve"
  → server records the reply + resolves the request. This spec only passes
  with the tab fix (before it, the venue could not reach the inbox).
