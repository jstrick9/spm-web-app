# Module 02 — Guests (Guest List, RSVPs, Import/Export, Seating, Portal Identity, Help Desk)

**Reviewed:** 2026-08-04
**Surface:** `routes/guests/{core,portal,shared}`, `db/repos/guests.ts` + `guestIdentity.ts`, `sdk/guests.ts`, `EventGuestsTab` + guest screens, `ImportGuestsDialog` + `csvMapping`/`csv`, `CrossEventGuestBrowser` + `GuestMergePanel`, `GuestOperationsPanel`, `SeatingReport`, `LodgingBuilder`, `GuestHelpInbox`, `GuestPortalSecurityDashboard`, public portal screens (`PublicGuestPortal`, `GuestRsvpWizard`, `GuestPortalHome`)
**Affected modules:** couple hub (guest exports), venue guest operations, catering exports, SSE/realtime, portal security dashboard, audit log

---

## 1. Bugs (fixed in this pass)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| GU-01 | High | **Guest merge feature is non-functional.** `GuestMergePanel` (rendered in `CrossEventGuestBrowser`) calls `POST /api/orgs/:orgId/guests/merge`, which **always throws 403** ("intentionally unavailable") — yet the repo (`guestIdentityRepo.merge`) is fully implemented and human-confirmed, and the UI is fully built. A completed feature wired to a dead endpoint. | Endpoint now works, gated to **owner/admin** (`org.manage` — per blueprint: owner-only data-quality tool). Audits each merge. |
| GU-02 | High | **Merge orphans RSVP data.** When merging, duplicates' `rsvp_submissions` rows keep pointing at the soft-deleted duplicate guest → the merged primary loses their RSVP/meal/dietary history. | `guestIdentityRepo.merge` now re-points duplicate `rsvp_submissions` (and `guest_sub_event_invitations`) to the primary before soft-deleting. |
| GU-03 | High | **Cross-event browser's inline RSVP edit always 403s** for its actual audience. The edit calls the couple-only guest update endpoint, but the browser is reachable only by staff/owners (couples lack org-scope `guests.view`) — every inline edit fails with a toast. | Removed the inline RSVP editor from the cross-event browser (read-only data-quality tool per blueprint); the venue's read-only manifest remains the correct staff surface. |
| GU-04 | Medium | **`resend-link` invalidates the guest's existing portal token even when delivery is impossible** (no SMTP connected): the token is rotated, `queued` stays false, and the guest's old link dies with nothing sent. | Token is only rotated when a delivery job can actually be enqueued (SMTP connected); otherwise the old link stays valid and the response reports `queued: false`. |
| GU-05 | Medium | **RSVP edit window is configurable but never enforced.** `rsvpEditWindowDays` is surfaced in portal settings and portal info, but the RSVP endpoint accepts edits indefinitely. | Enforced server-side: when editing a prior RSVP and the portal config sets `rsvpEditWindowDays` + the event has an `rsvp_deadline`, edits after `deadline + window` return `403 rsvp-edit-window-closed`. |
| GU-06 | Medium | **Venue catering/dietary export misses couple-entered meal choices.** The CSV joins only `rsvp_submissions`, but couples can enter meal choices on guest records (stored in `metadata.mealChoice`) — those never reach catering. | Export now coalesces `rsvp_submissions.meal_choice` with `metadata.mealChoice` and appends couple notes to the catering notes column. |
| GU-07 | Low | **Guest lifecycle gaps:** `DELETE /api/guests/:id`, portal-token rotate/revoke, and bulk create lack audit entries (delete/rotate/revoke) and SSE broadcasts (delete/bulk) — other devices don't refresh; security audit is incomplete. | Added audit + SSE to delete, audit to token rotate/revoke, SSE to bulk create. |
| GU-08 | Low | **Duplicate import implementations.** `lib/guestImport.ts` (10-field importer, better synonyms) is dead code; the live `csvMapping.ts` supports only 8 fields — CSV import cannot set plus-one or portal access. | Extended `csvMapping.ts` with `plusOneAllowed` + `allowPortalAccess` (with true/false parsing in the dialog), deleted the dead `lib/guestImport.ts`. |

## 2. Verified-working (no change needed)

- RSVP submit security: token-required-for-edit, honeypots, per-endpoint rate limits, device fingerprints, `rsvp.edit` telemetry, SSE broadcast to org, confirmation email/SMS jobs.
- Severe-allergy auto-escalation into `guest_help_requests` with a 1-day SLA; privacy/accessibility/memory/day-of-help requests with SLAs and routing to the configured contact.
- Portal token lifecycle: hashed-at-rest capability secrets, expiry, revocation sets `allow_portal_access = 0`, last-used tracking, per-guest rotation.
- Guest lookup privacy masking, `guest-pass.txt`/`travel-card.txt`/ICS exports, invite-only sub-event gating, household RSVP grouping, wayfinding privacy modes.
- Identity duplicate detection (union-find over email/phone/name) — now actionable end-to-end with the merge fix.
- Venue `venue-guest-manifest` is genuinely read-only.

## 3. Improvements & notes (documented)

1. **Import collision modes** (`skip/replace/append`) are user-chosen with in-dialog duplicate warnings — `append` can still create duplicate emails by design; consider a server-side `append` guard later (scale note).
2. **`lookup` name matching** is substring-based ("Sam" matches "Samantha") — acceptable for the masked, 5-result privacy design.
3. **RSVP edit window semantics:** `0` days + a deadline = immediate lock after the deadline; no deadline = window not applicable (open). Documented in the route comment.
4. **Merge is owner-only** (blueprint §6); admin role intentionally cannot merge (admin lacks `org.manage`). If the venue later wants admin merge access, grant a dedicated permission.

## 4. Regression coverage added

- `server/src/routes/guests-module.integration.test.ts` — 8 tests: merge owner-allowed/audited + non-owner 403; merge preserves RSVP submissions; resend-link rotates only when delivery possible; RSVP edit window enforced (open/closed); catering export includes couple-entered meal choice; guest delete audits; token rotate audits.
- `client/src/screens/events/guests/csvMapping.test.ts` — 4 tests: new field mapping (incl. hyphen/plus normalization fix in `guessMapping`), core fields, 10-field UI contract, boolean cell parsing; `lib/guestImport.ts` removed.
- Full suites re-run green (see §5).

## 5. Post-fix validation

- Server: typecheck clean, **473 tests passing** (67 files).
- Client: typecheck clean, **803 tests passing** (125 files).
- Production build + bundle budgets green (main 192 KB).
- Pre-existing merge tests updated to the new owner-only contract (they encoded the old always-403 decision).
