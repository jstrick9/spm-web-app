# RSVP Spoofing Fix — Invitation Tokens Now Required

## The vulnerability

The public guest portal lets anyone **look up** a guest by name and
receive their guest ID (`POST /api/portal/:eventId/lookup` returns full
UUIDs). The RSVP endpoint (`POST /api/portal/:eventId/rsvp`) only
required a token when the guest **already had** a token hash:

```js
if (g.portal_token_hash && (parsed.data.token || prior.n > 0) && verify... !== 'valid') → 403
```

Guests who were **never issued a secure link** (the default for imported
guests — tokens are only created when the venue/couple sends an invite
link) had no token hash, so **anyone** who knew the guest's name (public
wedding info) and the event id could submit or change an RSVP for them:
attending/declined, meal choice, allergies, notes — spoofing headcounts
that drive **catering orders, seating, and staffing**.

The client's own flow already gates this (`lookup` results say
`requiresSecureLink: true` and the wizard sends the link token), but the
server never enforced it — the client gate was cosmetic.

## The fix (`routes/guests/portal.ts`)

1. **An RSVP now requires a valid invitation token** — either the guest's
   own or **a household member's** (one invite per household; the client
   submits the primary's link token for the whole party, so
   `guestHouseholdKey` matching is honored).
2. Guests with **no issued token** and no valid household token are
   rejected with `403 portal-token-required` (audited as
   `rsvp.no_token_hash`) and directed to the lookup → request-secure-link
   flow.
3. Unrelated parties cannot use someone else's token (cross-household
   tokens still 403).

### Client

`GuestRsvpWizard` now shows friendly copy for
`portal-token-required` / `portal-token-invalid` /
`portal-token-required-for-rsvp-edit` instead of a raw "403 …" message:
the guest is pointed at "I cannot find my name" / "Request your secure
link" / asking the couple.

## Tests (all fail against the old code)

- `portal-flow.integration.test.ts`:
  - **5b** — tokenless RSVP for a never-invited guest → 403
    `portal-token-required`, no attendance recorded; same guest succeeds
    once their secure link is issued.
  - **5c** — household member RSVPs with the primary's token → 201;
    an unrelated guest with the same token → 403.
  - Tests 2/3/4/7 updated to issue tokens first.
- `guests-module.integration.test.ts` — RSVP edit-window tests issue the
  token before first submission.
- `core-crud.integration.test.ts` — "RSVP without auth" now asserts the
  403 for tokenless and 201 with token.

## Verification

- Server **573 tests / 80 files** · Client **887 tests / 134 files**.
- `tsc --noEmit` clean; client build + bundle budgets satisfied.
