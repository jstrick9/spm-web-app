# HUNT-PASS-16 — Rain-plan wiring, i18n raw-key leak, native-prompt removal

**Cycle:** Clean Cycle #2 · **Date:** 2026-08-07 · **Status:** verified, pushed to all 4 branches

---

## Findings & fixes

### 1. Rain-plan "Plan B" was cosmetic — the backend move was never wired (feature gap)
**Symptom:** The Emergency tab's Plan A/Plan B toggle only wrote `metadata.emergency_active_plan`.
The server's `POST /api/events/:eventId/activate-rain-plan` (moves the event to the venue's
configured backup space) had **zero client callers**; `metadata.rainPlanVenueId` had zero
client references (not even a UI to configure it). The Plan B banner + toasts hardcoded
"indoor ballroom"/"Outdoor Garden" copy that lied for any real venue, and the button labels
were fake-generic ("Plan A: Outdoor Garden", "Plan B: Weather Backup").

**Root cause:** Backend capability built (route + venue PATCH validation) but never surfaced;
UI copy promised automatic adjustment that didn't happen.

**Fix:**
- **Server** (`routes/venues.ts`): `activate-rain-plan` now records `previousVenueId` +
  `rainPlanActivatedAt` + `emergency_active_plan: 'plan-b'` in event metadata on activation,
  and accepts `{ restore: true }` to move the event back (clears the tracking keys, sets
  `emergency_active_plan: 'plan-a'`, audits `event.rain_plan.restored`). Response stays
  shape-compatible (`{ event, rainPlan: { fromVenue, toVenue } }`) with added `activated`/
  `restored` flags.
- **SDK** (`sdk/events.ts`): new `activateRainPlan(eventId, { restore? })`.
- **Client** (`EventEmergencyTab.tsx`): resolves the event's current venue + configured
  backup space from the org venues; Plan B actually moves the event (with honest error
  toast + guidance when no backup is configured); Plan A restores when the event was moved;
  buttons and banner show the **real space names**; occupancy compliance label uses the real
  backup space name.
- **Client** (`VenueBuilder.tsx`): new "Rain plan backup space" selector per venue space
  (lists approved sibling spaces; PATCHes `metadata.rainPlanVenueId`; toast + local state
  sync). Backend already validated the reference (org + approval) — now reachable from UI.
- **Type fix:** `SdkEvent` was missing `venue_id`/`rsvp_deadline`/`lead_source`/
  `organizationName`/`supportEmail` (server returns full rows) — added so typed reads
  compile instead of requiring `as any`.

**Tests:**
- Server integration (`rain-plan.integration.test.ts`): +2 tests (activate records
  previousVenueId + plan flag; restore swaps back + audits + resets flag; restore before
  activation → 400 `rain-plan-not-active`).
- Client unit (`EventEmergencyTab.test.tsx`): +3 tests (Plan B w/ backup calls
  `activateRainPlan`; Plan A after activation calls `{ restore: true }`; Plan B w/o backup
  never moves the event) + updated label assertions to the real-space names.
- e2e (`rain-plan.e2e.spec.ts`): +3 specs — full activate/restore round-trip with
  server-side venue_id verification, no-backup honest-guidance path, Venue Builder backup
  selector with server-side verification.

### 2. i18n used-but-undefined keys leaked raw key text to guests (a11y/i18n bug)
**Symptom:** `t('home.remindersQuietHoursStart')` / `t('home.remindersQuietHoursEnd')` were
called in the guest portal's reminder-preferences card but missing from the dictionary. `t()`
falls back to the raw key, so the two time inputs rendered `aria-label="home.remindersQuietHoursStart"`
— screen readers announced raw key names, and es/fr/zh guests saw untranslated strings.

**Root cause:** The parity test only checks cross-locale consistency, not used-vs-defined.

**Fix:** Added the two keys to all 4 locales; new regression test in
`translations.test.ts` scans `screens/portal` + `screens/events` for every `t('…')` call and
asserts the key exists in the English dictionary.

**Tests:** `translations.test.ts` +1 (5 tests total; 330 keys × 4 locales).

### 3. Native `window.prompt` in the layout canvas (UX/code consistency)
**Symptom:** CanvasPage's "Request reopening" used `window.prompt` while `usePrompt`'s `ask`
was already imported — jarring native dialog, inconsistent with every other in-app prompt.

**Fix:** Replaced with `ask({ title, label, multiline, required })`.

**Tests:** existing CanvasPage tests cover the surrounding flow (no direct unit assertion
needed for the swap; e2e layout flows remain green).

---

## Verification
- Server vitest: **707 passed** (95 files)
- Client vitest: **1008 passed** (145 files)
- e2e: **58 passed** (55 prior + 3 new rain-plan specs); `emergency.e2e` re-verified green
- tsc clean on server + client; client bundle rebuilt; server restarted on :3000
- git tree clean after push; all 4 branches pinned

## Documented (no change) — re-audited this pass
- `setVendorZoneInspection` (layout per-vendor zone inspections) — server route + SDK exist,
  no UI promise; floor-walk "vendor zones" boolean covers the intent. Net-new surface;
  deferred.
- Decor arrangements/packages, staff areas, webhooks/health, org events/broadcast — backend
  CRUD with no UI promise; client-side equivalents exist where users would notice. Net-new
  surfaces; deferred.
- `sdk.contracts.createGoNoGoFlag` — redundant wrapper (escalation path covers it); harmless.
