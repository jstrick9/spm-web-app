# Phase 5 · Day 4 — Payments & Ledger System

This concludes Phase 5 by equipping planners with an integrated ledger tool to track vendor deposits versus total contracted obligations natively inside the Event detail interface.

## What's Built
- **Ledger UI Columns**: Updated the `DataTable` structure on the `EventVendorsTab` adding a dynamically calculating `Balance` column mapping `.contract_amount_cents` minus `.amount_paid_cents`. 
- **VendorPaymentDialog**: Placed a `Log Payment` quick-action button right on the row which summons a cleanly parsed react-hook-form to register positive deposit integers.
- **Backend API Routes**: Configured `POST /api/vendors/:id/payments` verifying payloads (`amountCents`, `paidAt`, `method`) correctly passing them down through to `vendorsRepo` mutating both the parent `vendor` summary row and keeping the granular log in `vendor_payments`.
- **Validation**: Handled negative-value edge cases formatting the view down to standard decimal numbers with positive assertions guarding the Zod definitions. 

## Phase 5 Completion
Phase 5 successfully transformed the web app from a pure guest/layout planner into a business-grade ecosystem managing both B2B contacts (Vendors) and financial ledgering (Payments) all natively secured. 
