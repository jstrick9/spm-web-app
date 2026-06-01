# Phase 47 · Day 1 — Intelligence Platform Features

Nine major features that transform the platform from operations tool to intelligence platform.

---

## Features Implemented

### 1. Lead Source Tracking
- **Database**: `lead_source` column on events (website, referral, the_knot, weddingwire, facebook, instagram, google, walk_in, other)
- **UI**: Lead source dropdown in CreateEventDialog + EventSettingsForm
- **Analytics**: Lead source → conversion rate analysis in Intelligence Dashboard

### 2. RSVP Deadline Alerts
- **Database**: `rsvp_deadline` column on events
- **UI**: Date picker in EventSettingsForm
- **Alerts**: TodayView shows warning when RSVP deadline is within 14 days

### 3. Vendor Performance Ratings
- **Database**: `vendor_ratings` table (rating 1-5, quality/timeliness/communication sub-scores, review text)
- **API**: `POST/GET /api/vendors/:id/ratings` with aggregate calculation
- **Analytics**: Average ratings shown in vendor category insights

### 4. Email Templates
- **Database**: `email_templates` table (name, subject, HTML body, text body, category, merge fields)
- **API**: Full CRUD + `/preview` endpoint with merge rendering
- **Categories**: save_the_date, invitation, rsvp_reminder, thank_you, logistics, custom
- **Merge fields**: `{{guest_name}}`, `{{event_title}}`, `{{event_date}}`, `{{table_assignment}}`, `{{portal_link}}`

### 5. Payment Processing Infrastructure
- **Database**: `payment_links` table (provider, amount, status, external_id, payment_url)
- **Providers**: manual, stripe, square, paypal (extensible)
- **API**: `POST/GET /api/events/:id/payments`, `PATCH /api/payments/:id/status`
- **Status flow**: pending → processing → completed/failed/refunded

### 6. Multi-Venue Support
- **Database**: `venue_id` column on events (references existing venues table)
- **UI**: Venue assignment in event settings
- **Effect**: Events can be associated with specific venue locations within an org

### 7. Seasonal Demand Heatmap
- **Implementation**: `recommendationsRepo.forOrg()` aggregates events by month
- **UI**: Color-intensity grid on Intelligence Dashboard showing booking density per month
- **Insights**: Peak season + low season identification with specific percentages

### 8. Statistical Recommendations Engine
- **Implementation**: Pure SQL aggregation — no ML needed
- **Budget benchmarks**: P25/median/P75 from historical data
- **Guest count benchmarks**: Same percentile approach
- **Vendor category insights**: Most-booked categories with average ratings
- **Meal preference trends**: Popular choices across all RSVPs
- **Timeline benchmarks**: Average items per event

### 9. Data-Driven Event Recommendations
- **UI**: "Recommendations for New Events" card on Intelligence Dashboard
- **Requires**: 3+ historical events with budget data
- **Suggests**: Budget range, guest count, top vendor categories, optimal timeline length, peak pricing months

---

## Database Changes (Migration 0008)

| Change | Type | Purpose |
|---|---|---|
| `events.lead_source` | ALTER TABLE | Track lead origin for marketing ROI |
| `events.rsvp_deadline` | ALTER TABLE | RSVP deadline for automated alerts |
| `events.venue_id` | ALTER TABLE | Multi-venue assignment |
| `vendor_ratings` | CREATE TABLE | Per-event vendor scoring (1-5 stars + sub-scores) |
| `email_templates` | CREATE TABLE | Reusable email templates with merge fields |
| `payment_links` | CREATE TABLE | Payment tracking with multi-provider support |

---

## New API Endpoints (11)

| Method | URL | Permission | Purpose |
|---|---|---|---|
| POST | `/api/vendors/:id/ratings` | `vendors.manage` | Rate a vendor for an event |
| GET | `/api/vendors/:id/ratings` | `vendors.view` | Get ratings + aggregate |
| GET | `/api/orgs/:id/email-templates` | `invites.view` | List templates |
| POST | `/api/orgs/:id/email-templates` | `invites.manage` | Create template |
| DELETE | `/api/email-templates/:id` | `invites.manage` | Delete template |
| POST | `/api/email-templates/:id/preview` | `invites.view` | Render preview |
| GET | `/api/events/:id/payments` | `budget.view` | List payment links |
| POST | `/api/events/:id/payments` | `budget.manage` | Create payment link |
| PATCH | `/api/payments/:id/status` | `budget.manage` | Update payment status |
| GET | `/api/orgs/:id/recommendations` | `reports.view` | Get statistical recommendations |
| GET | `/api/events/:id/export.ics` | `events.view` | iCal calendar export |

---

## Verification

```
Server:  258/258 tests (0 failures)
Client:  426/426 tests (0 failures)
Total:   684/684 (0 regressions)
Typecheck: clean
Build: clean (13 chunks — +2 from intelligence dashboard lazy loading)
```

---

## Files Added (7)

```
server/src/db/migrations/0008_intelligence_platform.sql
server/src/db/repos/vendorRatings.ts
server/src/db/repos/emailTemplates.ts
server/src/db/repos/paymentLinks.ts
server/src/db/repos/recommendations.ts
server/src/routes/intelligence.ts
client/src/sdk/intelligence.ts
client/src/screens/system/IntelligenceDashboard.tsx
```

## Files Modified (12)

```
server/src/db/repos/index.ts          # +4 repo exports
server/src/index.ts                    # +1 route registration
server/src/routes/events.ts            # lead_source, rsvp_deadline, venue_id in schema + keyMap
server/src/routes/exports.ts           # iCal export endpoint
client/src/sdk/index.ts               # +4 SDK module exports
client/src/sdk/events.ts              # lead_source, rsvp_deadline, venueId fields
client/src/App.tsx                    # Intelligence dashboard route + command palette
client/src/screens/events/CreateEventDialog.tsx  # Lead source field
client/src/screens/events/settings/EventSettingsForm.tsx  # Lead source + RSVP deadline
client/src/screens/dashboard/TodayView.tsx  # RSVP deadline alerts
client/src/config/widgets/registry.tsx  # Pipeline forecast widget
client/src/config/defaults.ts          # Forecast in default dashboard
```

---

## Platform Statistics (47 Phases)

| Category | Count |
|---|---|
| Database tables | **51** (+6: vendor_ratings, email_templates, payment_links + 3 ALTER TABLE) |
| API endpoints | **104** (+11 new) |
| RBAC permissions | 72 |
| **Total tests** | **684** |
| Dashboard widgets | **12** |
| Intelligence features | Seasonal heatmap, lead source ROI, budget benchmarks, guest count benchmarks, vendor insights, meal trends, timeline benchmarks, event recommendations, pipeline forecast |
| Payment providers | manual, stripe, square, paypal |
| Email template categories | 6 (save_the_date → custom) |
| Lead sources | 9 (website → other) |
