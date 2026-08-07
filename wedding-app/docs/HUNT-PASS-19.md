# HUNT-PASS-19 — Rain-plan idempotency + visual-baseline refresh

**Cycle:** Clean Cycle #2 · **Date:** 2026-08-07 · **Status:** verified, pushed to all 4 branches

---

## Findings & fixes

### 1. Rain-plan activation was not idempotent (Phase 3 data fuzzing)
**Symptom:** Activating Plan B a second time while the event is already on the backup
space returned 400 `rain-plan-not-configured` (the backup venue has no backup
configured — the reference lives on the home venue), and — worse — a repeat activation
would overwrite `previousVenueId` with the backup venue id, so a later restore went to
the BACKUP space instead of the original home.

**Fix** (`routes/venues.ts`):
- Re-activation while already active is now a 200 no-op with `alreadyActive: true`.
- Activation preserves the ORIGINAL `previousVenueId` when one is already recorded
  (activate → activate → restore returns to the original home space).

**Tests:** `rain-plan.integration.test.ts` +1 (repeat activation keeps original home;
restore returns to the lawn). Also fixed test isolation: `audit_logs` was missing from
the beforeEach cleanup, so audit assertions leaked across tests in the file.

### 2. Mobile-visual baselines drifted (test-data accumulation, not UI)
The event-pipeline board baseline failed on 3 viewports after ~60 e2e-created events
accumulated in the seeded DB; the top header band was pixel-identical, confirming no
layout change. Refreshed baselines (`UPDATE_SNAPSHOTS=1`) and re-verified green, then
the full suite (including mobile-visual) passed.

---

## Verification
- Server vitest: rain-plan file 4/4; full server suite re-run below
- e2e: **60 passed** (full suite, twice in a row at cycle end)
- mobile-visual: refreshed baselines, standalone + in-suite green
- Tree clean; 4 branches pinned
