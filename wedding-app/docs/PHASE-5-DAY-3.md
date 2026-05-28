# Phase 5 · Day 3 — Vendor Questionnaires & Uploads

We've extended the standalone Vendor Portal by giving vendors an actionable way to respond to logistical questions, upload their forms, and sync this data back into the main application.

## What's Built
- **Backend API Mutator**: Added `POST /api/portal/vendors/:id/questionnaire`. Instead of hardcoding static table schema columns for arbitrary logistics, the endpoint dynamically patches responses securely into the `vendors.metadata` JSON blob natively supporting iteration.
- **Client Logistics View**: Embedded the `VendorLogistics` questionnaire block into the Vendor Portal exposing standard required inputs:
  - Expected Arrival Time
  - Expected Departure Time
  - Team Size (number input)
  - COI Link (A flexible URL field accepting external Drive/Dropbox links to Certificates of Insurance).
- **Save & Status UI**: Connects to the React Query system to mutation-lock saving logic. Once successfully updated, dynamically injects a `Submitted` badge confirming their compliance.

## What's Next
- **Payments / Ledgers**: Now that external providers can view their tasks and fill out compliance/logistics info, we need to allow the internal team to log payments explicitly within the primary planner `EventVendorsTab` system. 
