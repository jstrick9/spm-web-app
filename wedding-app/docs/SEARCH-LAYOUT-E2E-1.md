# SEARCH-LAYOUT-E2E-1 — command palette + couple floor-plan approval e2e

## Added
1. `e2e/search-palette.e2e.spec.ts` — the global Command-K palette is the
   app's primary navigation accelerator. Verifies: palette opens from the
   header button, typing an event title surfaces the dynamic event result,
   selecting it navigates to `/#/events/:id` with the event detail rendered.
2. `e2e/couple-layout-approval.e2e.spec.ts` — full couple floor-plan
   approval: owner builds a layout via the API (create → save →
   review-request → queue-decision approved), the couple opens the hub,
   clicks "Approve floor plan", the toast confirms, and the approval lands
   in event metadata (`coupleLayoutApproval.status === 'approved'`,
   verified through the couple layout API).

## Verification
- e2e: **14 passed / 0 skipped**.
