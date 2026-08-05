# HONEST-STATE-PASS-1 — Failure banners, vendor retry, password-change audit

Session date: 2026-08-05

This pass targets silent-failure UX (screens that render "No X yet" when a
request actually failed) and one missing audit signal.

---

## 1. Venue event-detail manager panels — honest failure banner

**File:** `client/src/screens/events/eventDetailPanels.tsx`

**Problem:** the venue manager's event-detail screen runs ~15 parallel
section queries (couple invitations, final-review readiness, setup packet,
communication templates, day-of contact, couple updates, live operations,
health command center, staff tasks, vendors, guest manifest, layouts,
workload). None had error handling: a transient network/server blip rendered
"None yet", "No staff assignments yet", or empty dashboards as if the data
simply did not exist — a manager could act on stale numbers.

**Fix:** a tracked section list mirrors the couple-hub pattern. When any
section query is in error state, a warning banner appears listing exactly
which sections failed, with "Retry failed sections" and "Refresh everything"
buttons. No banner when everything succeeds.

**Tests:** `client/src/screens/events/EventDetail.test.tsx` — banner appears
and names the failed section when `venueManifest` rejects; banner absent
when all queries succeed. Test SDK mock completed with the previously
un-mocked `venueManifest` and `timeline.setupPacket`.

---

## 2. Vendor portal load-failure retry

**File:** `client/src/screens/VendorPortal.tsx`

**Problem:** when the day-of vendor portal failed to load (Wi-Fi blip on a
vendor's tablet), the error card was a dead end — reload the whole page or
give up. Vendors need run-of-show minutes before load-in.

**Fix:** the error card now explains the likely cause (network) and offers a
"Try again" button wired to `refetch()` with loading state. The existing
60-second refetchInterval continues to self-heal once connectivity returns.

**Tests:** `client/src/screens/VendorPortal.test.tsx` — on first-load
rejection the error card + retry button render; clicking retry re-invokes
`portalInfo` and the portal renders normally (2 calls total).

---

## 3. Failed password change now audited

**File:** `server/src/routes/auth.ts`

**Problem:** `POST /api/auth/change-password` with a wrong current password
returned `{ error: 'invalid-current-password' }` with **no audit log** —
failed credential changes are a classic tampering signal and were invisible
to venue security reviews.

**Fix:** failed attempts log `user.password.change_failed` with actor, IP,
and user agent. HTTP shape unchanged (the client branch checks the 200
`error` field — kept as the contract).

**Tests:** `server/src/routes/auth.integration.test.ts` — new test asserts
the audit row is written on a wrong-current-password attempt.

---

## Verification

- Server: full suite green (642 tests / 84 files).
- Client: full suite green (901 tests / 135 files).
- `tsc --noEmit` clean on both apps.
