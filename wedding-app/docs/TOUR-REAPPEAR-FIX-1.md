# Onboarding Tour Reappear Flake — Root-Cause Fix

**Date:** 2026-08-07
**Symptom:** the onboarding tour modal *occasionally reappears* on full-suite
e2e runs while passing isolated runs. Mitigated before (close-when-completed-
config-arrives, `d019f27`); this pass fixes the actual root causes.

---

## Root causes found (three, all in `WelcomeModal.tsx`)

### 1. The modal flashed open while the tour state was still loading
`userConfig` (which carries `onboarding.welcomeTourByOrg.<org>.status`) loads
asynchronously. The open effect treated `undefined` config as
`not_started` — so the modal opened the instant the shell mounted and only
closed when the completed config arrived. Under full-suite load the
preferences fetch is slow, the open window widens, and:

- e2e clicks land on the modal overlay → timeout → flake (passes isolated
  because the server is idle and the fetch is fast);
- **a stray Escape during the window wrote `in_progress` server-side,
  poisoning every later owner spec in the same run** (the modal then
  legitimately reopens for them).

**Fix:** the open effect now returns early while `userConfig === undefined`.
The modal simply cannot open until the real tour state is known. Fresh
users are unaffected — the server returns `{config: {…}}` (an object, never
undefined) so `not_started` users still get the tour.

### 2. Dismissing the modal (Escape / backdrop / X) persisted `in_progress`
Both the keydown handler and `Dialog onOpenChange` called `resumeLater()`,
which writes status `in_progress`. Result: a user who dismissed the modal
via Escape saw it **reopen on the next login** — the literal "tour
occasionally reappears" symptom, for real users, not just e2e.

**Fix:** dismissal gestures (Escape via Radix's DismissableLayer → the
Dialog's `onOpenChange`, backdrop click, X button) now persist status
**`dismissed`** — the modal never auto-reopens. The explicit in-tour
"Resume later" BUTTON still writes `in_progress` (that's a deliberate
"continue later" choice, and reopening at the saved slide is correct).
Escape was removed from the custom keydown handler (Radix already handles
it) to avoid double-writing the preference.

### 3. "Resume later" closed the modal… and instantly reopened it
`saveState` round-trips the written config through `onUserConfigChanged`
(the App feeds the PUT response back into `userConfig`). That re-triggered
the open effect (status `not_started` → `in_progress`), so the modal
reopened in the same render cycle — this is why the happy-path spec notes
"Resume later persists and re-opens it".

**Fix:** an `intentionallyClosedRef` — once the user closes the tour via any
button (Finish / Resume later / Take me there / dismiss), the open effect
ignores subsequent config round-trips. A fresh mount (page reload) or the
explicit `wvi:restart-welcome-tour` event resets it, so mid-tour users still
resume at their saved slide after reloading.

## Tests
- `WelcomeModal.test.tsx` grew 5 → 12 tests, including:
  - *never opens while the config is still loading, stays closed when the
    completed config arrives* (no flash — the old behavior is asserted
    away), and **no preference write** is issued while the state is unknown;
  - close-button dismissal persists **`dismissed`** and stays closed after
    the config round-trip;
  - **Escape** dismisses permanently (writes `dismissed`, never
    `in_progress`);
  - **"Resume later"** closes the tour and the `in_progress` round-trip does
    NOT reopen it (regression for root cause 3);
  - mid-tour `in_progress` users still reopen at their saved slide on a
    fresh mount (behavior preserved);
  - "Finish tour" persists `completed` and closes.
- New e2e `tour-no-flash.e2e.spec.ts`: completes the owner tour via API,
  **delays the preferences GET by 2s** (widening the old race window), logs
  in, and polls at high frequency for 4s asserting the tour NEVER appears —
  then confirms the dashboard stays interactive.

## Verification
- Full e2e suite: **45/45**, **44/45** (one unrelated transient in
  `couple-layout-approval`, not reproducible in 3 full runs + 12 isolated
  repeats; that spec's tour state is API-completed for a fresh couple, so it
  cannot involve the tour), **45/45** across three consecutive full runs.
- happy-path spec: 15s "Resume later" safety-net wait reduced to 3s (the
  modal is now guaranteed closed for completed users; the old wait cost 15s
  per run) — happy-path dropped ~20s → ~5s.
- Client unit 982 (was 976) · server 698 — all green.

## Notes for future sessions
- The tour's dismissal semantics are now: **Finish = completed, Resume
  later button = in_progress, Escape/backdrop/X = dismissed**.
- `page.keyboard.press('Escape')` in specs can no longer poison tour state —
  it only ever writes `dismissed` now.
- If a spec ever needs the tour to auto-open for a fresh user, it must wait
  for the preferences fetch to resolve first (the modal no longer opens
  before config arrives) — the setup-wizard spec already covers this path.
