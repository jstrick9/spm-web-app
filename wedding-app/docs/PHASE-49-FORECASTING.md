# Phase 49 — Predictive Booking & Revenue Forecasting

**Date:** 2026-06-01
**Type:** Feature — intelligence layer
**Status:** server 304 tests · client 434 tests · typecheck + builds clean

---

## What this delivers

A forward-looking **revenue & booking forecast** on the Intelligence dashboard:
projected revenue and bookings for the next N months, a trend direction +
growth %, the open **pipeline** value, and a per-month timeline chart showing
actuals → projection. It answers "what's next quarter likely to look like?"

## Methodology (transparent, no ML)

Consistent with the existing recommendations engine — plain SQL + arithmetic,
fully explainable to a venue owner:

1. **Monthly series** — bookings + revenue (`SUM(budget_cents)`) per calendar
   month over a trailing window (default 24mo), gap-filled with zeros.
2. **Trend** — least-squares linear regression over the trailing **12** months
   → slope (monthly $ change) + direction (up/down/flat).
3. **Seasonal index** — each calendar month's average ÷ overall average, so
   June projects above January where history supports it.
4. **Projection** — next H months (default 6) = `regression baseline × seasonal
   index`, clamped at ≥ 0, for both revenue and bookings.
5. **Pipeline** — future open events (`lead/hold/booked/planning` with a
   start_date ≥ today) as a leading indicator that grounds the statistics.
6. **Confidence** — `high ≥12` / `medium ≥6` / `low` months of non-empty
   history, so the UI never over-promises on thin data.

## Files

```
server/src/db/repos/forecast.ts                # forecastRepo.forOrg() — the model
server/src/routes/forecast.integration.test.ts # 8 tests
client/src/screens/system/RevenueForecastCard.tsx       # UI (CSS bars, no recharts)
client/src/screens/system/RevenueForecastCard.test.tsx  # 2 tests
```

## Modified

```
server/src/db/repos/index.ts                 # export forecastRepo
server/src/routes/intelligence.ts            # GET /api/orgs/:id/forecast (reports.view)
server/src/db/seed.ts                         # 18 months of historical events (demo signal)
client/src/sdk/intelligence.ts               # forecastSdk + RevenueForecast types
client/src/sdk/index.ts                       # register sdk.forecast
client/src/screens/system/IntelligenceDashboard.tsx  # render <RevenueForecastCard/>
```

## API

| Method | URL | Auth | Query | Returns |
|---|---|---|---|---|
| GET | `/api/orgs/:orgId/forecast` | `reports.view` | `history` (6–36, def 24), `horizon` (1–12, def 6) | `{ forecast: RevenueForecast }` |

`RevenueForecast` = `{ history[], projection[], trend, totals, pipeline, meta }`
(see `sdk/intelligence.ts` for the full shape). Query params are clamped server-side.

## Security
- RBAC `reports.view`, scoped to the path org (cross-org → 403, unauth → 401) —
  verified by tests, consistent with the empty-scope audit.

## Performance / bundle
- The forecast card uses **pure-CSS bars** (no recharts), so it adds ~3 kB to
  the **already-lazy** `IntelligenceDashboard` chunk (8.6 → 11.4 kB). The eager
  `index` bundle is unchanged (~650 kB).

## Tests (10 new)
- **Model:** zeroed/low-confidence on no history; rising projection from an
  upward trend (high confidence, positive slope); seasonal index (a strong
  month projects above a quiet one); pipeline counts future open events.
- **Route:** envelope shape; `history`/`horizon` clamping; cross-org 403; auth 401.
- **UI:** renders projected revenue/growth/pipeline/confidence + legend; shows
  empty-state under 3 months of history.

## Demo
The seed now creates 18 months of historical completed events with a gentle
upward trend + summer seasonality, so the forecast renders with **high
confidence** and visible seasonal projections out of the box.
