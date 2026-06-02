# Phase 51 — Guest Identity Resolution (cross-event dedup)

**Date:** 2026-06-01
**Type:** Feature — data quality / intelligence
**Status:** server 328 tests · client 442 tests · typecheck + builds clean

---

## What this delivers

Guests are stored per-event (the same person at three weddings = three rows).
This feature clusters rows that are likely the **same person** across (and
within) an org's events, so staff can:

- spot **repeat guests** (the same person across multiple events), and
- **merge true duplicates** (e.g. a CSV-imported row + a hand-typed row) into a
  single primary record.

Surfaced as a collapsible **"Possible Duplicate Guests"** panel on the
cross-event Guest Browser.

## Methodology (explainable fuzzy matching, no ML)

Union-find over guest rows linked by any shared signal:

| Signal | Normalization | Confidence |
|---|---|---|
| email | trim + lowercase, must contain `@` | high |
| phone | digits-only, ≥7 digits | high |
| name  | lowercase, strip punctuation/whitespace | medium |

Each cluster reports its matched `signals`, a `confidence` (high if email/phone
linked it, else medium), and `hasInEventDuplicate` (≥2 rows in the *same* event
— a real duplicate vs. a legit cross-event repeat).

## Merge — always human-confirmed

`merge(orgId, primaryId, duplicateIds)`:
- validates **every id belongs to the org** (no cross-tenant deletes),
- backfills the primary's **empty** contact fields (email/phone/party/dietary/
  accessibility) from the duplicates — never overwrites existing primary data,
- soft-deletes the duplicate rows, in a transaction,
- is audit-logged (`guest.merge`).

There is **no silent auto-merge** — staff pick the primary in the UI (defaults
to the earliest-created row) and confirm.

## Files

```
server/src/db/repos/guestIdentity.ts                  # findDuplicates + merge
server/src/routes/guest-identity.integration.test.ts  # 13 tests
client/src/screens/guests/GuestMergePanel.tsx          # UI
client/src/screens/guests/GuestMergePanel.test.tsx
```

## Modified

```
server/src/db/repos/index.ts        # export guestIdentityRepo
server/src/routes/guests.ts         # +2 endpoints (below)
client/src/sdk/guests.ts            # duplicates() + merge() + cluster types
client/src/screens/guests/CrossEventGuestBrowser.tsx  # render <GuestMergePanel/>
```

## API

| Method | URL | Auth | Purpose |
|---|---|---|---|
| GET | `/api/orgs/:orgId/guest-duplicates` | `guests.view` | Duplicate-candidate clusters |
| POST | `/api/orgs/:orgId/guests/merge` | `guests.manage` | Merge duplicates into a primary |

## Security
- Both gated by org-scoped `guests.*`. `merge` re-validates all ids against the
  org, so a request can't merge/delete another org's guests (cross-org → the
  foreign id is simply ignored → `no-valid-duplicates` 400). Cross-org listing
  → 403; unauth → 401. Verified by tests, consistent with the empty-scope audit.

## Tests (17 new)
- **Detection:** distinct→none; email cluster (case-insensitive, diff names);
  phone cluster (ignores formatting); name cluster (medium) + in-event flag;
  cross-org isolation.
- **Merge:** backfill + soft-delete; no-overwrite of existing primary fields;
  cross-org id rejected (untouched).
- **Routes:** list clusters; merge + audit; invalid-merge 400; cross-org 403; auth 401.
- **UI:** cluster render; merge calls SDK with selected primary; renders nothing
  when no duplicates; hides controls without `guests.manage`.

## Demo
Adding the same guest (by email/phone) to two events surfaces a high-confidence
cluster; merging backfills the primary's missing contact info and removes the
duplicate (cluster count drops to 0). Verified end-to-end.
