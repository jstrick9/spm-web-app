# Phase 50 — Vendor Reliability Scoring + Smart Matching

**Date:** 2026-06-01
**Type:** Feature — intelligence layer (builds on `vendor_ratings`)
**Status:** server 315 tests · client 438 tests · typecheck + builds clean

---

## What this delivers

1. **Reliability score (0–100) + tier** for every vendor, derived from the
   `vendor_ratings` sub-scores — surfaced as a badge on the Vendor Directory.
2. **Smart matching:** a "Recommended Vendors" panel on each event's Vendors tab
   that ranks the org's vendors by *fit for this event* (reliability + budget
   band + category) with an explanation for each recommendation.

A defensible differentiator that turns the rating data (collected since the
Phase 47 vendor-ratings feature) into actionable booking guidance.

## Methodology (explainable, no ML)

**Composite score** (when sub-scores exist), each normalized 1–5 → 0–100:
```
base = 0.40·overall + 0.25·quality + 0.20·timeliness + 0.15·communication
```
**Confidence factor** tempers thin samples (so one 5★ can't outrank twenty 4.6★):
```
confidence = min(1, ratingCount / 5)          # full weight at 5+ reviews
score      = round(base · (0.6 + 0.4·confidence))
```
**Tiers:** `top_rated ≥85` · `trusted ≥70` · `promising >0` · `unrated`.

**Smart matching `fit`** = reliability score, then:
- `+8` preferred vendor
- budget band: vendor's typical contract vs ~35% of event budget →
  `+10` within / `+4` under / `−12` over
- optional hard **category** filter; recurring vendors de-duplicated by name.

Each candidate carries `matchReasons[]` ("Preferred vendor", "Top rated (5★, 6
reviews)", "Fits the budget band", …) so the recommendation is never a black box.

## Files

```
server/src/db/repos/vendorScoring.ts                 # scoreAll / scoreOne / matchForEvent
server/src/routes/vendor-scoring.integration.test.ts # 11 tests
client/src/screens/vendors/ReliabilityBadge.tsx       # shared tier+score chip
client/src/screens/vendors/ReliabilityBadge.test.tsx
client/src/screens/events/vendors/VendorMatchPanel.tsx       # matcher UI
client/src/screens/events/vendors/VendorMatchPanel.test.tsx
```

## Modified

```
server/src/db/repos/index.ts        # export vendorScoringRepo
server/src/routes/intelligence.ts   # +2 endpoints (below)
client/src/sdk/intelligence.ts      # vendorScoringSdk + VendorScore/VendorMatch types
client/src/sdk/index.ts             # register sdk.vendorScoring
client/src/screens/vendors/VendorDirectory.tsx        # ReliabilityBadge on cards
client/src/screens/events/vendors/EventVendorsTab.tsx # render <VendorMatchPanel/>
```

## API

| Method | URL | Auth | Purpose |
|---|---|---|---|
| GET | `/api/orgs/:orgId/vendor-scores` | `vendors.view` | Reliability scores for all org vendors |
| GET | `/api/events/:eventId/vendor-matches?category&limit` | `vendors.view` (event-scoped) | Ranked, fit-scored recommendations for the event |

## Security
- Org scores gated by `vendors.view` on the org; matches gated by `vendors.view`
  scoped to the event (cross-org → 403, unauth → 401) — consistent with the
  empty-scope IDOR audit. Verified by tests.

## Performance / bundle
- Pure SQL aggregation; the matcher de-dupes in memory. UI is small CSS/Badge
  components — eager `index` bundle essentially unchanged (650 → 655 kB).

## Tests (15 new)
- **Model:** unrated→0; strong well-reviewed→100/top_rated; **confidence
  tempering** (single 5★ < high-volume vendor); preferred-first sort; category
  filter; **budget fit** (within vs over) ranking; recurring de-dup.
- **Routes:** scores list; event matches; cross-org 403; auth 401.
- **UI:** badge (rated + unrated); match panel (ranked reasons + empty-state).

## Demo
With the seeded vendors, rating one 5/5/5/5 yields a "promising" 68 (correctly
tempered for n=1); preferred vendors sort first and surface as top
recommendations with budget-fit reasons.
