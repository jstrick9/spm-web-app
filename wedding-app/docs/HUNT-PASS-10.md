# Systematic Hunt Pass 10 — Sub-Event Creation UI Gap

**Date:** 2026-08-07

## Feature gap found & fixed

### Venues could never create a sub-event from the UI
The SDK (`sdk.events.createSubEvent`) and the server
(`POST /api/events/:id/sub-events`) supported sub-event creation, but **no
client screen called it** — the Portal-settings card only EDITED
pre-existing sub-events' guest-facing metadata and even told venues to
"add rehearsal dinner or weekend events from the event timeline/sub-event
tools" that did not exist. Guests only ever saw weekend itinerary cards
when sub-events happened to exist in the DB.

**Fix:**
- `PortalSubEventsCard.tsx` — new "Add a sub-event" form (title,
  datetime-local start, invite-only toggle) wired to the create mutation;
  the empty state now points at the form when creation is available.
- `GuestPortalSettingsTab.tsx` — `createSubEventMutation` (creates then
  refreshes the list, success/destructive toasts).
- Guest itinerary benefits immediately: new sub-events appear under
  "Weekend Sub-Events" with the venue-filled location/host/etc.

Tests:
- `PortalSubEventsCard.test.tsx` +5 — form present/disabled, create payload
  (title/startsAt/inviteOnly), no-create without title/time, legacy fallback
  when no create mutation, existing-sub-event editing preserved.
- `e2e/subevent.e2e.spec.ts` — venue creates "Rehearsal Dinner" from the
  Portal tab (planning event; Portal tab is stage-gated), fills location +
  host, server verifies the sub-event + metadata, and a guest's portal
  itinerary shows the sub-event with the venue details.
