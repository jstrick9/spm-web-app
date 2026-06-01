# Phase 33 · Day 1 — Duplicate Event UI & React Hooks Fix

Phase 33 makes the Duplicate Event feature accessible from the UI and fixes a critical React hooks ordering issue.

---

## 1. Duplicate Event Button

The `POST /api/events/:id/duplicate` endpoint (Phase 32) was server-only — now it has a UI.

### Where it appears
- **EventDetail header actions** — alongside "View Guest Portal", "Print Run Sheet", and "Vendor Check-In"
- Button text: "Duplicate" with copy icon
- Shows loading state during the mutation
- On success: toast notification + navigates to the new event's detail page
- New event starts as "lead" status with "(Copy)" suffix

### UX Flow
```
Event Detail → [Duplicate] button
  → POST /api/events/:id/duplicate
  → Toast: "Event duplicated! 'Smith Wedding (Copy)' created as a new lead."
  → Navigate to the new event's detail page
  → Events list automatically refreshes (React Query invalidation)
```

---

## 2. React Hooks Ordering Fix

**Bug:** The `useToast()` and `useQueryClient()` hooks for the duplicate mutation were placed AFTER conditional early returns (`if (eventQuery.isLoading)` / `if (eventQuery.isError)`). This violated React's Rules of Hooks — hooks must be called in the same order on every render.

**Symptom:** "Rendered more hooks than during the previous render" error when the event was loading.

**Fix:** Moved all hooks (useToast, useQueryClient, useMutation) above the conditional returns, ensuring consistent hook call order regardless of loading/error state.

---

## Test Summary

| | Phase 32 | **Phase 33** | Δ |
|---|---|---|---|
| Server tests | 236 | **236** | 0 |
| Client tests | 406 | **406** | 0 |
| **Total** | **642** | **642** | 0 |
| Typecheck | clean | clean | — |
| Build | clean | clean | — |

The EventDetail test was rewritten cleanly (was broken by sed corruption) and now includes verification of the Duplicate button.

---

## Files Modified (1)

```
client/src/screens/events/EventDetail.tsx       # Added Duplicate button + fixed hooks ordering
client/src/screens/events/EventDetail.test.tsx   # Rewritten: 5 tests including Duplicate
```

---

## Platform Statistics (33 Phases)

| Category | Count |
|---|---|
| Database tables | 44 |
| API endpoints | 73+ |
| RBAC permissions | 71 |
| **Total tests** | **642** |
| Test files | 108 |
| Phases | 33 |
| Untested components | 0 |
| Production mock data | 0 |
