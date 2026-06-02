# Phase 52 — Anomaly & Risk Alerts (event health)

**Date:** 2026-06-01
**Type:** Feature — intelligence layer (proactive monitoring)
**Status:** server 341 tests · client 446 tests · typecheck + builds clean

---

## What this delivers

A proactive **"event health"** assessment that flags at-risk events *before*
they become problems — reusing signals the platform already tracks. Two surfaces:

1. **Event Health card** on each Event Detail overview — a health score (0–100)
   + a severity-coded list of risks, each deep-linking to the tab to fix it.
2. **"Events Needing Attention"** card on the Intelligence dashboard — org-wide,
   riskiest events first, with their top alerts.

## Risk signals (all from existing data, no new tables)

| Alert | Trigger | Severity |
|---|---|---|
| RSVP overdue | deadline passed, guests still pending | critical |
| RSVPs behind | ≥30% pending within 14d of deadline, or ≥40% pending within 14d of event | warning |
| Unsigned contracts | contracts not `signed` near the event (≤14d critical, ≤45d warning) | critical/warning |
| Budget over plan | actual ≥15% over planned (≥30% → critical) | warning/critical |
| Balance due | ≥50% of actual unpaid within 45d (≤14d → critical) | warning/critical |
| No vendors | event ≤45d with zero vendors | warning |
| No timeline | event ≤14d with no run-of-show | warning |
| Over capacity | attending guests exceed planned `guest_count` | warning |

**Health score** = `100 − Σ weights` (critical 30, warning 15, info 5), floored
at 0. Tiers: ≥85 Healthy · ≥60 Needs attention · <60 At risk.

Only **live** events (lead/hold/booked/planning) are assessed; completed/
cancelled/lost are excluded.

## Files

```
server/src/db/repos/risk.ts                       # forEvent + forOrg (the model)
server/src/routes/risk-alerts.integration.test.ts # 13 tests
client/src/screens/events/EventRiskCard.tsx        # per-event health panel
client/src/screens/events/EventRiskCard.test.tsx
client/src/screens/system/RiskAlertsCard.tsx        # org-wide "needs attention"
client/src/screens/system/RiskAlertsCard.test.tsx
```

## Modified

```
server/src/db/repos/index.ts        # export riskRepo
server/src/routes/intelligence.ts   # +2 endpoints (below)
server/src/db/seed.ts                # at-risk demo event (Patel Engagement Party)
client/src/sdk/intelligence.ts      # riskSdk + EventRisk/RiskAlert types
client/src/sdk/index.ts             # register sdk.risk
client/src/screens/events/EventDetail.tsx           # render <EventRiskCard/>
client/src/screens/system/IntelligenceDashboard.tsx # render <RiskAlertsCard/>
```

## API

| Method | URL | Auth | Purpose |
|---|---|---|---|
| GET | `/api/orgs/:orgId/risk-alerts` | `reports.view` | Org-wide at-risk events, riskiest first |
| GET | `/api/events/:eventId/risk-alerts` | `events.view` (event-scoped) | One event's health assessment |

## Security
- Org list gated by `reports.view`; per-event by `events.view` scoped to the
  event (cross-org → 403, unauth → 401). Verified by tests; consistent with the
  empty-scope IDOR audit.

## Performance / bundle
- Pure SQL aggregation per event (a handful of indexed COUNT/SUM queries). The
  org-wide RiskAlertsCard lives in the already-lazy Intelligence chunk
  (+~2 KB); the EventRiskCard adds ~6 KB to the eager bundle (Event Detail is core).

## Tests (17 new)
- **Model:** each alert kind fires on its trigger; healthy far-off event → 0
  alerts / 100; score decreases with severity; org list filters to alerting
  events only, sorts riskiest-first, excludes completed.
- **Routes:** per-event + org envelopes; cross-org 403; auth 401.
- **UI:** EventRiskCard (alerts + score + all-clear); RiskAlertsCard (list +
  empty state renders nothing).

## Demo
The seed now includes an at-risk near-term event ("Patel Engagement Party") that
surfaces all six categories (3 critical + 3 warning → health 0), so the Event
Health and "Events Needing Attention" panels are populated out of the box.
