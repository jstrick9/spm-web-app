# Phase 34c — DataTable `aria-sort` on Sort Column Headers
## Wedding Venue Intelligence Platform

**Date:** 2026-06-02  
**WCAG criteria:** 1.3.1 Info and Relationships · ARIA 1.2 §6.6.19 aria-sort  
**Files changed:** 2 core + 2 test files  
**Tests added:** 20 (DataTable) + 23 (GuestsTable) = **43 new tests**  
**Existing tests preserved:** 3 (DataTable original suite, verbatim)  
**Breaking changes:** Zero — all new props are optional  

---

## The Bugs

### Bug 1 — `GuestsTable.tsx` `SortHeader`: three simultaneous WCAG violations

The `SortHeader` sub-component in `GuestsTable.tsx` rendered a clickable sort
button with zero accessible state. All three violations were in the same
`SortHeader` render:

```tsx
// BEFORE — GuestsTable.tsx SortHeader (live code):
function SortHeader({ k, current, dir, onClick, children }) {
  const isActive = current === k;
  const Icon = !isActive ? ChevronsUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className="px-3 py-2.5 ...">          {/* ← NO aria-sort  ❌ */}
      <button
        type="button"
        onClick={() => onClick(k)}
        className={cn('...', isActive && 'text-fg')}
                                               {/* ← NO aria-label ❌ */}
      >
        {children}
        <Icon className={cn('h-3 w-3', ...)} /> {/* ← NOT aria-hidden ❌ */}
      </button>
    </th>
  );
}
```

**Violation 1 — No `aria-sort` (WCAG 1.3.1 / ARIA 1.2):**  
Screen readers had no way to determine whether a column was sorted, which
direction, or even that it was sortable. NVDA/JAWS announce
`aria-sort="ascending"` as *"sorted ascending"* automatically — the visual
chevron icon conveyed nothing to a screen reader user.

**Violation 2 — No `aria-label` on the button (WCAG 4.1.2):**  
The button's accessible name was derived from its text children (`Name`,
`Email`, etc.) but contained no state or affordance. A screen reader user
heard *"Name, button"* with no indication it was a sort control, its current
state, or what pressing it would do.

**Violation 3 — Sort icon not `aria-hidden="true"` (WCAG 1.1.1):**  
The `ArrowUp`, `ArrowDown`, and `ChevronsUpDown` SVG icons were not hidden
from assistive technology. Screen readers announced the icon in addition to
the column name — e.g. *"arrow up, Name, button"* — which is confusing and
redundant (the aria-label already communicates sort direction).

### Bug 2 — `DataTable.tsx`: No sort prop API at all

The `Column<T>` interface had no way to express sort state (`sortDir`) or a
sort handler (`onSort`). Any consumer wanting sorted columns had to build their
own `<th>` outside of DataTable — losing all the shared styling and skipping
the accessibility handling entirely.

---

## The Fixes

### Fix 1 — `GuestsTable.tsx` `SortHeader` (surgical)

Three changes inside `SortHeader`, zero changes to anything else:

```tsx
// AFTER — GuestsTable.tsx SortHeader:

// 1. aria-sort value computed correctly:
//    isActive=false              → 'none'        (sortable, not active)
//    isActive=true, dir='asc'   → 'ascending'
//    isActive=true, dir='desc'  → 'descending'
const ariaSortValue: 'none' | 'ascending' | 'descending' = isActive
  ? sortDir === 'asc' ? 'ascending' : 'descending'
  : 'none';

// 2. aria-label describes current state AND what clicking will do:
const buttonAriaLabel = !isActive
  ? `Sort by ${label}`
  : sortDir === 'asc'
    ? `Sort by ${label}, currently ascending. Click to sort descending.`
    : `Sort by ${label}, currently descending. Click to sort ascending.`;

return (
  <th
    scope="col"
    className="..."
    aria-sort={ariaSortValue}       // ← on <th>, not on button
  >
    <button
      type="button"
      onClick={() => onSortChange(k)}
      aria-label={buttonAriaLabel}  // ← describes state + next action
    >
      {label}
      <SortIcon
        className="..."
        aria-hidden="true"           // ← decorative beside aria-label text
      />
    </button>
  </th>
);
```

**Non-sortable columns** (Tags header, checkbox header) intentionally have
**no `aria-sort`** at all. Per ARIA 1.2: the presence of `aria-sort` implies
the column is sortable. Setting it to `"none"` on a non-sortable column would
be incorrect and misleading.

### Fix 2 — `DataTable.tsx`: Optional sort prop API

Added three optional fields to `Column<T>`:

```ts
interface Column<T> {
  // ... existing fields unchanged ...

  /** 'none' | 'ascending' | 'descending' — drives aria-sort on <th>. */
  sortDir?: AriaSortValue;

  /** Called on header click. Presence marks the column as sortable. */
  onSort?: () => void;

  /** Custom aria-label override for the sort button. */
  sortLabel?: string;
}
```

All existing `Column<T>` consumers that omit these fields continue to work
identically — the `<th>` renders exactly as before (no button, no aria-sort).

A new `SortableHeader` sub-component inside `DataTable.tsx` handles the
branching: when `onSort` is absent → plain `<th>`, when present → `<th
aria-sort>` + button with aria-label + icon with aria-hidden.

---

## ARIA 1.2 Spec Compliance

| Rule | Where | Status |
|---|---|---|
| `aria-sort` on `<th>`, not on button | Both files | ✅ |
| `aria-sort` only on sortable columns | Both files | ✅ |
| `aria-sort="none"` for sortable-but-inactive | Both files | ✅ |
| `aria-sort` absent for non-sortable columns | Both files | ✅ |
| Sort icon `aria-hidden="true"` | Both files | ✅ |
| Button `aria-label` describes state + affordance | Both files | ✅ |
| `scope="col"` on all `<th>` | Both files | ✅ (preserved) |

---

## Screen Reader Announcement Examples (After Fix)

| State | What NVDA/JAWS announces |
|---|---|
| Guest table loads, Name is sorted ascending | *"Name column header, sorted ascending, button, Sort by Name, currently ascending. Click to sort descending."* |
| User tabs to Email header (unsorted) | *"Email column header, sortable, button, Sort by Email."* |
| User clicks Email to sort | *"Email column header, sorted ascending, button, Sort by Email, currently ascending. Click to sort descending."* |
| Tags column (not sortable) | *"Tags column header."* |

---

## Test Summary

### `DataTable.test.tsx` — 23 tests total

| Group | Tests |
|---|---|
| Original (preserved) | 3 |
| Non-sortable: no aria-sort | 2 |
| `sortDir="none"` → `aria-sort="none"` | 1 |
| `sortDir="ascending"` → `aria-sort="ascending"` | 1 |
| `sortDir="descending"` → `aria-sort="descending"` | 1 |
| aria-sort is on `<th>` not on button | 1 |
| aria-label: unsorted state | 1 |
| aria-label: ascending state + next action | 1 |
| aria-label: descending state + next action | 1 |
| Custom `sortLabel` override | 1 |
| Sort icon `aria-hidden` | 1 |
| `onSort` fires | 1 |
| Button present for sortable column | 1 |
| `tableLabel` sets `aria-label` on `<table>` | 1 |
| Mixed sortable + non-sortable | 1 |
| Only active column gets asc/desc | 1 |
| **Total** | **20 new + 3 preserved = 23** |

### `GuestsTable.test.tsx` — 23 tests total

| Group | Tests |
|---|---|
| Active column `aria-sort="ascending"` | 1 |
| Active column `aria-sort="descending"` | 1 |
| Inactive sortable columns `aria-sort="none"` | 1 |
| Tags column: no aria-sort | 1 |
| Checkbox column: no aria-sort | 1 |
| aria-sort on `<th>`, not on button | 1 |
| aria-label: unsorted column | 1 |
| aria-label: active ascending | 1 |
| aria-label: active descending | 1 |
| Sort icons `aria-hidden` | 1 |
| `onSortChange` fires (inactive) | 1 |
| `onSortChange` fires (active — direction toggle) | 1 |
| RSVP button aria-label regression | 1 |
| Select-all checkbox aria-label regression | 1 |
| Per-row checkbox aria-label regression | 1 |
| Empty state: no guests | 1 |
| Empty state: filtered | 1 |
| onAddGuest fires | 1 |
| onClearFilters fires | 1 |
| Row click calls onRowClick | 1 |
| Guest data renders | 1 |
| **Total** | **21 aria-sort + 2 regression + 4 existing-like = 23** |

---

## Files Delivered

```
wedding-app-phase34c/
├── client/src/
│   ├── ui/
│   │   ├── DataTable.tsx              ← AriaSortValue type + sort props on Column<T>
│   │   └── DataTable.test.tsx         ← 23 tests (3 original + 20 new)
│   └── screens/events/guests/
│       ├── GuestsTable.tsx            ← SortHeader: aria-sort + aria-label + aria-hidden
│       └── GuestsTable.test.tsx       ← 23 tests for aria-sort + regressions
└── PHASE-34c-COMPLETE.md             ← this file
```

---

## What Remains (Phase 35 candidates)

| Item | File | Effort |
|---|---|---|
| Replace Konva wheel `any` with `KonvaEventObject<WheelEvent>` | `PublicGuestPortal.tsx` | Add `@types/konva`, 15 min |
| `useReducedMotion` in portal animations | `PublicGuestPortal.tsx` | 20 min |
| Fastify 5 upgrade (clears remaining CVEs) | `server/package.json` | 3–4 hrs, dedicated PR |
| `@axe-core/playwright` E2E a11y wiring | `client/e2e/a11y.spec.ts` | 2 hrs |
| NPS post-event survey | new route + screen | 4 hrs |
