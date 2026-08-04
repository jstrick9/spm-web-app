# UX/UI Improvements — Pass 2 (A11y, Dead Code, Empty States)

**Date:** 2026-08-04 · **Status:** shipped (UX-04…UX-07)

---

## UX-04 — Accessibility: accessible names for icon-only buttons + images

Audited every `<button>` and `<img>` in product code for accessible names:

- **Labelled icon-only buttons** that had none: email-block reorder chevrons in
  `EventInvitesTab` ("Move block up/down"), revision-diff overlay close in
  `CanvasStageArea`, canvas item drag handles in `CanvasSidebar`, lightbox
  close in `EventGalleryTab`, lodging editor close, vendor tour dismiss
  (upgraded `title` → `aria-label`), branding color pickers ×5.
- **Keyboard accessibility**: `StaffingCalendar` day cells were
  `role="button"` + `tabIndex` but had **no keyboard handler** — added
  Enter/Space activation + a descriptive `aria-label` (date + event/shift
  counts).
- **`<img>` alt**: print-popup image in `VenueBuilder` now carries the venue
  title.
- Verified the rest of the flagged candidates were false positives (visible
  text labels, `sr-only` spans, or `aria-label` already present), and that
  the global `:focus-visible` ring in `tokens.css` covers all interactive
  elements.

## UX-05 — Removed ~2,500 lines of dead legacy code (and its stray hexes)

Verified repo-wide (source + tests + e2e) that these were unreferenced and
removed them:

- `src/pages/` — the original POC screens (`Dashboard`, `Events`,
  `FloorPlan`, `Guests`, `Settings`) never wired into the router.
- `src/components/layout/Header.tsx` + `Sidebar.tsx` — replaced by the
  `AppShell` navigation years ago.
- `src/components/ThemeSwitcher.tsx` (used only by the dead header),
  `src/components/RecentBookingsTable.tsx`, `src/components/ui/PremiumUI.tsx`
  (legacy styling, used only by dead pages).

This also resolved the bulk of the "remaining hardcoded hexes" finding —
those lived in the deleted files. The hexes that remain in live code are
legitimate **data**: portal palette definitions (`constants/design.ts`,
`themeDefinitions.ts`), floorplan item color defaults, and Konva canvas
marker colors.

## UX-06 — Empty-state upgrades on the venue dashboard

The dashboard's first-run empty state was already excellent; extended the
same `EmptyState` treatment to:

- **Venue layout approval queue** — "No layouts awaiting approval" with an
  icon and guidance copy (was a bare muted line).
- **Portfolio readiness** — "All active events look ready" (was a bare line).

Audited the timeline tab, vendors tab, TodayView, staff kanban, and couple
hub — those already ship proper icon + copy + CTA empty states.

## UX-07 — Verification

- Client `tsc --noEmit` ✅ · server `tsc --noEmit` ✅
- Client vitest **829/829** (126 files) ✅
- `npm run build` + bundle budgets ✅ (bundle unchanged — dead code was never
  imported)
- Repo `grep` confirms zero remaining unlabelled icon-only buttons / missing
  image alts in live code.

## Follow-ups (future passes)

- Keyboard navigation polish for the floorplan canvas (arrow-move selected
  objects) and lightbox (arrow keys between images).
- A shared `FieldError`/`FormField` wrapper to guarantee every form control
  gets an accessible name by construction.
- Audit-log screen pagination controls in the client (server-side paging
  from Module 8 already exists).
