# Phase 41 · Day 1 — "Today" Intelligence View

The single most-requested feature for daily venue operations: opening the app and immediately seeing what needs attention right now.

---

## What Was Built

### TodayView Component

A new intelligence card on the dashboard answering three questions:

#### 1. "What events do I have today?"
If any events are scheduled for today, a prominent card with brand-colored border shows:
- Event title
- Guest count + budget
- "TODAY" badge
- Click to navigate to event detail

#### 2. "What's happening this week?"
A compact 7-day calendar strip showing:
- Day name (Mon, Tue, etc.)
- Date number
- Month abbreviation
- Events on each day (truncated titles with links)
- Today highlighted with brand color
- "+N more" indicator if multiple events on one day

#### 3. "What needs my attention?"
Action items generated from real data analysis:
- **Upcoming events within 14 days**: shows "X days away" with guest count
- **Vendors with outstanding balances**: total unpaid amount across all vendors with $100+ remaining
- Each item links to the relevant page (guests tab, vendor directory)

If nothing needs attention:
> ✅ "All clear! No events today and nothing needs immediate attention."

---

## Where It Appears

The TodayView sits on the main Dashboard between the KPI widgets and the Event Pipeline Summary:

```
┌──────────────────────────────────────────────────┐
│  KPI Widgets (booking conversion, RPE, etc.)      │
├──────────────────────────────────────────────────┤
│  ┌──── Today's Events (if any) ─────────────┐    │
│  │  Smith Wedding  · 120 guests · $50,000   │    │
│  │                                   TODAY   │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  ┌──── This Week ───────────────────────────┐    │
│  │ Mon  Tue  Wed  Thu  Fri  Sat  Sun        │    │
│  │ 29   30    1    2    3    4    5          │    │
│  │ May  May  Jun  Jun  Jun  Jun  Jun        │    │
│  │            Smith                          │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  ┌──── Needs Attention ─────────────────────┐    │
│  │ ⚠ 1 vendor with outstanding balance       │    │
│  │   $1,000 total remaining                  │    │
│  └──────────────────────────────────────────┘    │
│                                                   │
│  Event Pipeline Summary · Quick Actions           │
└──────────────────────────────────────────────────┘
```

---

## Tests: 4 new tests

| Test | What it validates |
|---|---|
| Shows today event card | "Today's Events" heading + event title + TODAY badge |
| Renders this week strip | 7-day calendar with current date |
| Shows vendor payment alerts | "Needs Attention" + outstanding balance text |
| TODAY badge rendering | Badge appears for current-day events |

---

## Test Summary

| | Phase 40 | **Phase 41** | Δ |
|---|---|---|---|
| Server tests | 258 | **258** | 0 |
| Client tests | 422 | **426** | **+4** |
| **Total** | **680** | **684** | **+4** |
| Typecheck | clean | clean | — |
| Build | clean (11 chunks) | clean (11 chunks) | — |

---

## Files Added (3)

```
client/src/screens/dashboard/TodayView.tsx          # Today intelligence component
client/src/screens/dashboard/TodayView.test.tsx      # 4 tests
docs/PHASE-41-DAY-1.md                               # This file
```

## Files Modified (1)

```
client/src/App.tsx    # TodayView wired into DashboardScreen
```

---

## Platform Statistics (41 Phases)

| Category | Count |
|---|---|
| Database tables | 44 (7 migrations) |
| API endpoints | 75+ |
| RBAC permissions | 71 |
| **Total tests** | **684** |
| Test files | 116 (26 server + 90 client) |
| Phases | **41** |
| Dashboard sections | KPIs + **Today View** + Event Pipeline + Quick Actions |
| Main bundle (gz) | 336 KB |
| Code-split chunks | 11 |
