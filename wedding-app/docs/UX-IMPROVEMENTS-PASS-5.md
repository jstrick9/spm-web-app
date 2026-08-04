# UX/UI Improvements — Pass 5 (Final Backlog)

**Date:** 2026-08-04 · **Status:** shipped (UX-16…UX-18)

---

## UX-16 — Timeline keyboard navigation

The day-of timeline's completion dot was a click-only `div` — no keyboard
path at all. Now:

- The dot is a real `<button>` with an accessible name describing state
  ("Arrival — not completed, click to mark complete").
- **Enter/Space** toggles completion.
- **ArrowUp/ArrowDown** moves focus between timeline items (the keyboard
  analog of the drag-reorder gesture, which remains mouse/touch-only).

## UX-17 — Reduced-motion: no smooth scrolling

The global `prefers-reduced-motion: reduce` block already collapsed
animation/transition durations; it now also forces
`scroll-behavior: auto`, so users with vestibular sensitivity no longer get
smooth anchor scrolling on the document.

## UX-18 — Shared `FormField` primitive

New `src/ui/FormField.tsx` — label + control + hint/error wrapper that
guarantees accessible names by construction:

- Label wired to the control via `htmlFor`/`id`; required fields get a
  visible `*` plus `aria-required` on the control.
- Errors render with `role="alert"` and are wired via `aria-describedby`;
  `aria-invalid` pairs with the message.
- Hint text uses the same `aria-describedby` channel when no error is shown.

Migrated the two highest-traffic form surfaces:

- **`usePrompt` dialogs** (every ask/askForm across the app) now render
  fields through FormField — per-field validation messages instead of a
  single summary line.
- **PaymentsPanel amount** — the FI-14 inline error is now a FormField
  error (kept the exact copy and behavior, added `id` + alert semantics).

## UX-19 — Verification

- Client `tsc --noEmit` ✅ · server `tsc --noEmit` ✅
- Client vitest **839/839** (127 files, +5 tests) ✅
- `npm run build` + bundle budgets ✅

With this pass, the UX improvement backlog is complete: native dialogs are
gone, the theme is tokenized, keyboard navigation covers the canvas,
lightbox, timeline, staffing calendar, and guest lists, forms are accessible
by construction, and reduced-motion is honored end to end.
