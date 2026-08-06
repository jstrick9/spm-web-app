# FIRST-RUN-E2E-1 — venue setup wizard journey verified

## Gap
The 5-step first-run **Venue Owner Setup Wizard** (identity → spaces →
rules → catalog → first event) is the very first screen a new venue owner
ever sees, but no e2e covered it — only unit-level pieces. The full
registration → wizard → sample-event path was untested.

## Added
`e2e/setup-wizard.e2e.spec.ts`:
1. Registers a brand-new owner **through the UI** (the wizard flag is set
   client-side on registration, so API registration wouldn't trigger it).
2. Asserts the wizard auto-opens, then drives all 5 steps: venue identity
   (name + support email), spaces (ceremony/reception), rules (defaults),
   catalog (defaults), first event (sample default) → Finish setup.
3. Handles the intended post-wizard **Welcome tour** modal (scoped locators
   — both the wizard and the tour are `role=dialog`).
4. Server-side verification: org config persisted (branding.platformName,
   supportEmail, setup.ownerSetup.spaces), and the sample event was created.

## Notes
- The wizard's dialog is `max-w-3xl` and the welcome tour `max-w-2xl` —
  locators must be scoped by content (`hasText`), not just role.
- Config is stored under `config.setup.ownerSetup.*` (not `config.venue`).
