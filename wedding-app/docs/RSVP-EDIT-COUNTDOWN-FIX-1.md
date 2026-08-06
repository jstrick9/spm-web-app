# RSVP-EDIT-COUNTDOWN-FIX-1 — guest portal countdown perf + RSVP edit flow

## 1. Wedding-day countdown re-rendered the ENTIRE guest portal every 10s
`PublicGuestPortal` kept `nowTime` state and a 10-second `setInterval` at
the ROOT, re-rendering the whole portal tree — including the multi-step
RSVP wizard, home tab, and map — ten times a minute on every guest phone.
Aside from the jank, the re-render raced in-progress interactions.

**Fix**: extracted a self-contained `PrecisionCountdown` component that owns
its own tick. The portal root no longer re-renders on the interval.

## 2. RSVP edit flow (latest-submission-wins) now covered by e2e
The RSVP wizard spec's new edit section: after the first submission, the
guest reopens the portal with the same link, edits the RSVP to declined
with a note, and the server's latest submission wins
(`rsvpStatus` → `declined`; the decline note lands in the submission).

### Test-harness lesson (not an app bug)
A Playwright **coordinate click** on the footer's Continue button can land
on the freshly re-rendered Submit RSVP button — both occupy the same
footer position, and CDP re-hit-tests each mouse event (mousedown on
Continue → React advances the step → mouseup/click hit Submit → form
submits in the same interaction). Real browsers hit-test the original
element, so human users are unaffected. The spec uses programmatic
`element.click()` for step transitions, which dispatches on the node only
and is deterministic.
