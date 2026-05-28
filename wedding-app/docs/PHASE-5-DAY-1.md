# Phase 5 · Day 1 — Vendor Management Foundation

Phase 5 is all about integrating the vendors that actually execute the event. We start by adding the `Vendor` tracking interfaces inside the `EventDetail` module securely storing service providers.

## What's Built
- **EventVendorsTab**: Replaced the 'Coming Soon' placeholder tab with a dynamic UI listing active vendors.
  - Generates top-line summary tiles analyzing total contracted value across all assigned vendors.
  - Implements the generic `DataTable` layout displaying names, categories, rich contact action-links (Email/Phone/Web), and Contract Amounts.
- **VendorFormDialog**: Built a react-hook-form managed form validated with `zod`.
  - Supports string manipulation ensuring dollar amounts are serialized down to integers `contractAmountCents` before hitting the `vendorsSdk`.
  - Sends creations against the `api/orgs/:orgId/vendors` pipeline.

## What's Next
- **Payments / Balances Tracking**: Adding payment ledger capabilities beneath each vendor to track deposits vs remaining balances.
- **Vendor Portal Hub**: Develop the standalone vendor-shareable views allowing catering partners to view their event timelines and answer logistical questionnaires.
