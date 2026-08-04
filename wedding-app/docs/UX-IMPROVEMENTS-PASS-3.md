# UX/UI Improvements — Pass 3 (Keyboard Power, Paging, Accessibility)

**Date:** 2026-08-04 · **Status:** shipped (UX-08…UX-12)

---

## UX-08 — Audit-log server-side paging

The audit screen was capped at the newest 200 rows with no way to see older
history. The Module-8 server work already exposed `total` + `nextBefore`;
this pass wired the client:

- `sdk/audit.list` now sends `before` and surfaces `total`/`nextBefore`.
- The AuditLog screen keeps `before` in its query key and renders a pager
  ("Showing X of Y record(s)" + **Newest** / **Older** buttons) whenever
  `total > logs.length`.
- Changing the action filter resets paging to the newest page.

Test: AuditLog.test.tsx asserts the pager renders for `total: 250` and that
**Older** refetches with `before = nextBefore`.

## UX-09 — Keyboard navigation for the gallery lightbox

- Arrow **Left/Right** cycles through the filtered gallery (wrapping);
  **Escape** closes.
- Added visible **prev/next** chevron buttons (with `aria-label`) so the
  lightbox is also touch/mouse friendly and the affordance is discoverable.
- The lightbox index is derived from the *filtered* list, so paging respects
  the active category filter.

Test: EventGalleryTab.test.tsx drives arrow keys + asserts prev/next button
visibility flips correctly at the ends.

## UX-10 — Keyboard-first floorplan editing (canvas)

With an object selected (e.g. via the Layers panel), the canvas now supports:

- **Arrow keys** nudge the selected object by 5px (Shift = 20px),
  pushing undo history.
- **Delete/Backspace** removes the selected object (protected/locked items
  and the permanent arch are excluded), matching mouse UX.

Typing in any input/textarea/select never triggers nudging; Ctrl/Cmd+Z/Y
undo/redo still work as before.

Test: CanvasPage.test.tsx selects a table in the Layers panel, presses
ArrowRight, verifies Save enables and persists the object at x+5.

## UX-11 — Skip-to-content link + dev-log hygiene

- AppShell now renders a **Skip to content** link as the first focusable
  element (visually hidden until focused) targeting the existing
  `#main-content` landmark — completing keyboard top-level navigation.
  (Existing AppShell test covers the contract.)
- The couple magic-link dev token console log is now gated to
  `import.meta.env.DEV` — it no longer prints in production builds.

## UX-12 — Verification

- Client `tsc --noEmit` ✅ · server `tsc --noEmit` ✅
- Client vitest **832/832** (126 files, +3 tests) ✅
- `npm run build` + bundle budgets ✅

## Follow-ups (future passes)

- Server-side search/actor-email filters surfaced into the audit toolbar
  (the API already supports them from Module 8).
- Arrow-key navigation between guests in the seating chart and between
  timeline items in day-of mode.
- Touch swipe gestures for the gallery lightbox (mobile parity with arrows).
