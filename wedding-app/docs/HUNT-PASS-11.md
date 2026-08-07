# Systematic Hunt Pass 11 — Password-Protected Portal Was a False Sense of Security

**Date:** 2026-08-07

## Security gap found & fixed

### The "Require a password" portal toggle enforced NOTHING
The venue-facing Portal settings let the venue set a portal password
(stored as a hash + `requiresPassword` in the info payload + a
`verify-password` endpoint), but:

- **no client code ever called `verifyPassword`** (SDK method had zero
  callers), and
- **the server returned the FULL guest payload regardless** — guests,
  schedule, RSVP data — to anyone with the link.

The venue believed the portal was password-protected; it was not. A
false sense of security for real venues.

### Fix (server-enforced, stateless)
- `lib/portalGate.ts` — HMAC-signed, short-lived (30 min), single-purpose
  proof: `<eventId>.<expiry>.<signature>` (JWT secret; timing-safe compare;
  event-scoped).
- `POST /api/portal/:eventId/verify-password` now returns
  `{ ok: true, token }` on success (401 otherwise).
- `GET /api/portal/:eventId/info` — when a password is set and no valid
  `?pw=` proof is presented, returns ONLY the locked shell
  (`passwordLocked: true`, event title) and audits `portal.password_required`.
  Correct proof → full payload. Portals without a password are untouched.

### Fix (client)
- `sdk.portal.info` accepts `pw`; `verifyPassword` return type gains `token`.
- `PublicGuestPortal` — a `PortalPasswordGate` unlock screen (title,
  password input, inline error, loading state) renders when the server
  reports `passwordLocked`; the proof is cached in sessionStorage
  (`wvi_portal_pw_<eventId>`) so the 5-minute info polling and reloads
  don't re-prompt; a wrong password shows an inline error.
- Gate UI is localized (en/es/fr/zh keys added to all four dictionaries).

### Tests
- `routes/portal-password-gate.integration.test.ts` +4 — locked shell
  without proof (no guests/schedule), wrong-pw 401 + correct-pw proof
  unlocks the full payload, proofs are event-scoped (can't unlock a second
  portal), and unprotected portals are unaffected.
- `e2e/portal-password.e2e.spec.ts` — venue sets a password → guest sees
  the gate (NOT the RSVP UI) → wrong password rejected → correct password
  unlocks → reload keeps the session unlocked. (Expected 401s from the
  negative step are filtered from the clean-gate assertion.)

## Also this pass
- Sub-event creation UI (HUNT-PASS-10 continued) verified in the full
  suite (e2e `subevent`).

## Totals
Client unit 993 · server 702 · e2e 51 — all green.
