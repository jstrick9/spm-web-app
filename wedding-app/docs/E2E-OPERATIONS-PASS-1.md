# E2E-OPERATIONS-PASS-1 — vendor portal message 500 fix + operations journey

Session date: 2026-08-05

## The bug (found by the new journey test)

`direct_messages.sender_id` had `REFERENCES users(id) ON DELETE CASCADE`
(migration 0001). The **vendor portal sends messages with `sender_id =
vendor.id`** (`routes/vendors.ts`, senderRole `'vendor'`) — a vendor id is
not a user id, so every insert failed the FK and the endpoint returned
**500 internal-error**. Every message a vendor tried to send through their
portal was silently broken; the client showed a generic error.

**Fix:** migration `0053_direct_messages_sender_any.sql` rebuilds
`direct_messages` without the users FK on `sender_id` (table rebuild with
`PRAGMA foreign_keys = OFF`, which the migration runner supports). All other
callers pass `req.auth!.userId`; `sender_role` discriminates vendor vs
staff/couple senders. Data preserved; index recreated.

## E2E journey #2 — operations half

`server/src/routes/e2e-journey2.integration.test.ts` (1 comprehensive test)
covers the operational lifecycle the first journey skipped:

1. Register owner → event created as `lead` (entry status accepted).
2. Stage lifecycle: `lead → booked → planning` (audit rows written).
3. Staff member added (org + event membership) and shift scheduled —
   **overlapping shift rejected** (`staff-shift-conflict`).
4. Layout create → save → review-request → queue-decision **approved**
   (approval lock respected afterwards).
5. Vendor portal E2E: token issued → `info` → questionnaire → COI upload
   (magic-byte-valid PDF) → **message send (the fixed path)** → token
   rotation revokes the old token (401).
6. Staff shift clock-in → clock-out persisted.
7. Final-review readiness gate: rejects while incomplete, then passes after
   prerequisites (approved layout + accessible route, timeline + approval,
   event staff membership, setup packet, confirmed counts, rain plan,
   accessibility); stage → `final_review` → `completed`.
8. Consistency: stage-transition audit rows, vendor metadata questionnaire
   + `lastPortalActivityAt` persisted.

## Verification

- Server full suite green: 670 tests / 89 files.
- `tsc --noEmit` clean; migration applies cleanly in-memory and on disk.
