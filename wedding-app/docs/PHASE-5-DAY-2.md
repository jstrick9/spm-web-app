# Phase 5 · Day 2 — Standalone Vendor Portal

Phase 5 introduces standalone, unauthenticated (public shareable) views allowing attached vendors to independently inspect events they are hired to manage.

## What's Built
- **Server API**: Added `GET /api/portal/vendors/:id/info` bypassing standard `memberships` authorization constraints exposing public logistical data based on dynamic `vendorId` links.
- **Client Route**: Added a public hash route parser pointing to `#/vendor/:vendorId` routing to a completely isolated `<VendorPortal>` wrapper application distinct from the `AppShell`.
- **Vendor Portal Screen**: 
  - Loads a cleanly styled read-only UI tailored exclusively for the logged-in vendor's use-case.
  - Generates top-level cards listing contracted amounts vs active deposits.
  - Injects a central `Timeline / Run of Show` card mapping natively against the `sdk.timeline.list` structures, keeping the vendor aligned visually on their day-of requirements.
- **Links generation**: Updated the `<EventVendorsTab>` inside the core UI providing a rapid link-copy string directly adjacent to their vendor contacts list allowing planners to instantly fire off the public portal URL.

## What's Next
- **Questionnaires & Logistic Forms**: Embed editable fields in the Vendor Portal allowing providers to upload COIs (Certificates of Insurance) and answer customized logistics questionnaires right from the public site.
- **Payments / Ledgers**: Establish the ledger tools back on the core App `VendorsTab` tracking individual payments against balances. 
