# Session doc — offline queue, vendor token lifecycle, e2e journey sweep

Session date: 2026-08-05

Three audit passes, one **major bug fixed**, all pushed to the four branches.

---

## 1. Dual-write / offline-queue audit (`e5bba7c`)

**Found (functional gap):** the offline write queue paused on
`unauthorized` (session expired mid-flight) and only auto-drained on
`server-reachable` events. After the user re-logged-in, `setToken` fired
`token-changed` — but nothing listened, and `server-reachable` would never
fire again (the 401 response already marked the server reachable). **Queued
offline writes (guest updates, RSVPs, check-ins) sat in localStorage
forever after re-auth.**

**Fixes (`dual-write/writeQueue.ts`):**
- `startAutoReplay` also drains on `token-changed` with `hasToken=true`.
- `validation` (400) and `forbidden` (403) are permanent — dropped
  immediately instead of burning `MAX_ATTEMPTS` retries with the queue head
  blocked. (`conflict` already dropped; `unauthorized` waits for re-auth.)
- Tests: +3 (validation drop, forbidden drop, re-auth drain); suite 12 green.

## 2. Vendor portal token lifecycle (`f573293`)

Token storage was already sound: opaque 32-char tokens, hashed+salted at
rest, expiry enforced (`julianday`), revocation on rotation, `last_used_at`
tracked, invites delivered with honest `copy_only` fallback, all public
endpoints rate-limited.

**UX gap fixed:** the vendor portal error card treated an expired/revoked
token the same as a network blip. Now token errors show "This vendor portal
link has expired or was revoked" + ask-the-venue guidance (no pointless
retry button); transient failures keep the Try-again path. Test: +1.

## 3. E2E journey sweep (`3b18adf`) — **major bug found**

New `e2e-journey2.integration.test.ts` covers the operations half the
original journey skipped: stage lifecycle (lead→booked→planning→
final_review→completed with the readiness gate), staff shifts + conflict
guard + clock in/out, layout create→save→review→approve, vendor portal E2E
(token→info→questionnaire→COI→message→rotation), audit + metadata
consistency.

**The journey caught a real production bug:** `direct_messages.sender_id`
had `REFERENCES users(id) ON DELETE CASCADE` (migration 0001), but the
vendor portal sends with `sender_id = vendor.id` — **every vendor portal
message returned 500 internal-error** (FK violation). The vendor chat
feature was completely broken.

**Fix:** migration `0053_direct_messages_sender_any.sql` rebuilds the table
without the users FK on `sender_id` (table-rebuild pattern the runner
supports via `PRAGMA foreign_keys = OFF`). All other callers pass
`req.auth!.userId`; `sender_role` discriminates vendor vs staff/couple.
Data preserved; index recreated.

## Verification

- Server: 670 tests / 89 files, full suite green.
- Client: 928 tests / 138 files, full suite green.
- `tsc --noEmit` clean both apps; `npm run build` + bundle budgets pass.
- Migration applies cleanly in-memory (tests) and on disk.
