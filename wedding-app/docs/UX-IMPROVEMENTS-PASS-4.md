# UX/UI Improvements — Pass 4 (Natural Next Steps)

**Date:** 2026-08-04 · **Status:** shipped (UX-13…UX-15)

---

## UX-13 — Audit toolbar server-side search + mobile guest-list arrows

- **Audit actor search now queries the server.** When the audit search box
  contains an email address (contains `@`), the request sends
  `actorEmail` to the server-side filter (Module 8's API already supported
  it) instead of only filtering the current page client-side. Typing a new
  search resets paging to the newest page, and the query key includes the
  debounced search so results refresh as you type.
- **Mobile guest lookup list is arrow-navigable.** The compact guest result
  buttons on the guests tab now move focus with ArrowUp/ArrowDown
  (wrapping-free, stops at the ends), so keyboard users can scan the first
  five matches without tabbing through every control in each row.

## UX-14 — Touch swipe navigation for the gallery lightbox

The lightbox (which already supported arrow keys) now handles touch:
swipe left → next image, swipe right → previous, with a 40px threshold to
avoid accidental triggers while scrolling/zooming. This closes the mobile
parity gap for guests browsing event photos.

## UX-15 — Verification

- Client `tsc --noEmit` ✅ · server `tsc --noEmit` ✅
- Client vitest **834/834** (126 files, +2 tests) ✅
- `npm run build` + bundle budgets ✅

## Follow-ups (future passes)

- Seating-chart arrow navigation for the couple hub's guest list (the venue
  canvas already has object arrow-nudge; the couple list is a native list so
  it inherits default keyboard behavior).
- Timeline day-of arrow navigation between items.
- Reduced-motion-aware carousel transitions (CSS already honors
  `prefers-reduced-motion` globally).
