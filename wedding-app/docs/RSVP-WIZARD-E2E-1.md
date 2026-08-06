# RSVP-WIZARD-E2E-1 — full guest RSVP journey verified in a real browser

## Gap
The guest portal's RSVP wizard — the single most important guest action in
the product (every guest uses it once per event) — was only covered by
axe-scans of the rendered tab and API-level integration tests. No e2e drove
the actual multi-step wizard with a real secure link.

## Added
`client/e2e/rsvp-wizard.e2e.spec.ts`:
1. API setup: owner adds a fresh guest + generates their secure portal
   link (`couple-guests/:id/portal-link`).
2. Browser: guest opens `/#/portal/:eventId?guest=…&token=…` — home tab
   shows the token-identified "RSVP as {name}" itinerary line.
3. Walks the wizard: identify (guest preselected from the link, "Secure
   invitation link verified" note) → attendance (Joyfully accept) → party
   → meal (dietary restriction entered) → review (privacy acknowledgement
   is REQUIRED — first Submit attempt shows the inline error, then the
   consent checkbox + submit succeeds) → confirmation receipt with the
   entered details.
4. Server-side verification: guest `rsvpStatus` → `attending` in the
   couple guest list; the `rsvp_submissions` row (via the catering
   dietary export CSV) contains the dietary notes + `submitted_at`.

## Notes / harness lessons
- The wizard's "Secure invitation link verified" text lives on the wizard's
  identify step, not the portal home — the home assertion uses the
  personalized itinerary line instead.
- `getByLabel('Your Name')` is a fuzzy match against "Search your name" —
  needs `{ exact: true }`.
- CSV cells are quoted (`"Ada Import"`) — unquote before comparing.

## Verification
- e2e: 12 passed / 0 skipped (a11y ×2, couple-hub ×3, fonts, happy-path,
  offline-queue, push-ux, pwa, rsvp-wizard, vendor-portal).
