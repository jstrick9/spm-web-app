# Gap-Hunting Pass 15 — Read-Receipt Bug + Four UI Gaps + Dead-Code Sweep

**Date:** 2026-08-07
**Process:** GAP-HUNTING-PROCESS.md Phase 1.1 (unwired-feature scan with an
improved multi-line SDK-caller scanner).

---

## Real bug found & fixed

### The venue's "viewed X/Y" acknowledgment panel always showed 0
The venue panel tracks how many couples VIEWED an Event Week update
(`viewed_count`), and the server's `POST couple-updates/:id/view` writes
the read receipt — but **no client ever called it**. Every couple read
every update, and the venue saw "viewed 0/1" forever.

**Fix** (`CoupleEventHub`): each update is marked VIEWED once per session
(fire-and-forget, per-update-id ref). The venue panel is now honest.
Verified in the e2e: after the couple opens the hub, the venue summary's
`viewed_count >= 1`.

## UI gaps wired (backend existed, UI never called it)

1. **Guest editing** (`PATCH couple-guests/:id` had zero callers): couples
   couldn't fix a typo'd guest name/email — delete + re-add was the only
   option (losing RSVP history). Added a browsable guest list in the Couple
   Guest List Center with per-row Edit (askForm dialog) → `updateGuest`.
2. **Document metadata editing** (`PATCH couple-documents/:id` had zero
   callers): category/visibility/notes were set once at upload and never
   fixable. Each doc card gains "Edit details" which loads the shared form
   row into edit mode → `updateDocument`.
3. **Feedback composer** (`POST events/:id/feedback` had zero callers): the
   "Polls & Feedback" tab said "No feedback collected yet" with no way to
   collect it. Added target/rating/comments/submitted-by composer.
4. **Custom role rename/delete** (`PATCH/DELETE /api/roles/:id` had zero
   callers): venues could CREATE custom roles but never rename or remove
   them. The Access Control matrix now shows Rename/Delete for non-system
   roles.

## Dead code removed
- `sdk.couple.templateGallery` + server route `couple-template-gallery`
  (weaker duplicate of the venue-templates path the hub actually uses).
- `sdk.guests.rotatePortalToken` → pointed at a non-existent route (404).
- `sdk.integrations.events` → pointed at a non-existent route (404).

## Tests
- Unit: +3 couple-hub (view receipt fires per update; guest edit calls
  updateGuest; doc metadata edit calls updateDocument), +2 feedback
  composer, (roles rename/delete covered by e2e).
- e2e extended: couple-hub (edit guest + venue viewed_count ≥ 1),
  couple-documents (category edit persists; run-unique filenames so
  repeated runs never hit stale rows), access-control (create → rename →
  delete custom role).

## Totals
Client unit 1000 (was 995) · server 702 · e2e 53 — all green.
