# Phase 38 · Day 1 — Catering Report, Revenue Chart & Guest Communication

Three high-impact features for day-of operations and business intelligence.

---

## 1. Printable Seating & Dietary Report

A new "Print Seating & Dietary Report" link on the Guests tab generates a printer-friendly document designed to be handed to caterers and coordinators.

### Report includes:
- **Event header**: title, date, guest count, table count, generation date
- **Dietary summary**: count per dietary type (Standard, Vegetarian, Vegan, Gluten-Free, etc.) — the caterer's first reference
- **Table-by-table breakdown**: each table shows guest name, RSVP status (color-coded), dietary requirements, accessibility notes
- **Unassigned section**: guests without table assignments

### Print optimization:
- `break-inside-avoid` on table groups
- Serif font for elegance
- Hides the app shell on print
- Footer with platform + event branding

---

## 2. Revenue by Month Chart (Analytics Dashboard)

A bar chart on the Analytics Dashboard showing monthly booked revenue:

- **12-month window** (current month back to 12 months ago)
- **Revenue calculation**: sum of `budget_cents` for events with `booked`, `planning`, or `completed` status in each month
- **Visual**: proportional bars with hover tooltips showing dollar amounts
- **Month labels**: "Jan '26", "Feb '26", etc.

---

## 3. Copy All Guest Emails

A "Copy Emails" button in the Guests toolbar that copies all guest email addresses to the clipboard for pasting into an email client.

- Filters to guests with email addresses only
- Comma-separated format (compatible with BCC fields)
- Available alongside "Import CSV" and "Add Guest" buttons

---

## Test Summary

| | Phase 37 | **Phase 38** | Δ |
|---|---|---|---|
| Server tests | 257 | **257** | 0 |
| Client tests | 414 | **414** | 0 |
| **Total** | **671** | **671** | 0 |
| Typecheck | clean | clean | — |
| Build | clean | clean | — |

---

## Files Added (2)

```
client/src/screens/events/guests/SeatingReport.tsx       # Printable seating/dietary report
docs/PHASE-38-DAY-1.md                                   # This file
```

## Files Modified (3)

```
client/src/screens/events/guests/EventGuestsTab.tsx       # SeatingReport integration + Copy Emails
client/src/screens/events/guests/GuestsToolbar.tsx        # Copy Emails button
client/src/screens/system/AnalyticsDashboard.tsx           # Revenue by month chart
```

---

## Platform Statistics (38 Phases)

| Category | Count |
|---|---|
| Database tables | 44 |
| API endpoints | 75+ |
| RBAC permissions | 71 |
| **Total tests** | **671** |
| Test files | 113 |
| Phases | **38** |
| Guest tab features | Table, search, sort, filter, bulk actions, CSV import, **Copy Emails**, detail drawer, **Seating Report** |
| Analytics features | KPIs, vendor compliance, utilization rates, **Revenue by Month chart** |
