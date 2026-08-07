# Systematic Hunt Pass 9 — Event-Tab URL Sync Bug + Four New Interaction Gates

**Date:** 2026-08-07

---

## Real bug found & fixed

### Event-detail tabs ignored the URL after mount (back/forward + shared links)
`EventDetail` read `?tab=` from the URL **only at mount** and then only
WROTE the URL. Consequences (reproduced in a real browser):
- navigating `#/events/:id?tab=staff` → `?tab=chat` (browser back/forward,
  manually edited links) did NOT switch panels — the URL said Chat while
  the Staff panel stayed on screen;
- a shared `?tab=` link opened the right tab only if the page fully
  reloaded; any in-session hash navigation showed the WRONG panel.

**Fix** (`EventDetail.tsx`): a URL→state sync effect re-reads `?tab=` on
every router query change (hashchange from back/forward or replaceState),
guarded by a ref so the URL-writing effect's synthetic hashchange can't
fight it. Unknown tab ids fall back to Overview (same as mount).

Tests: `EventDetail.test.tsx` +2 — switching `?tab=guests` → `?tab=timeline`
via the router moves the active trigger, and an unknown `?tab=` lands on
Overview.

## New e2e gates (4)

| Spec | Flow |
|---|---|
| `manager-dayof` | fresh venue_manager (client-side manager flag set via init script like the couple-hub share stub) → header Day-of toggle → dock with Run sheet/Guests/Vendors/Check-in/Staff/Emergency/Voice/Photo/Device QA/Offline/Lock → Run sheet navigates → Hide turns mode off (dock persists on event pages by design, hides off-event) |
| `shell-utils` | Help Center (search filters lessons, lesson toggle persists to localStorage) → Keyboard Shortcuts dialog via user menu → Notifications bell with a dispatched synthetic `wvi:sse-event` renders "New Event Created" and clicks through |
| `guest-submissions` | token guest saves reminder preferences (server), submits privacy request (message required ≥3 chars), accessibility request, and event-day "Running late" — each verified in `guest_help_requests`/prefs via API |
| `staff-chat` | planning event (Staff tab is stage-gated to planning+) → "Create checklist" seeds event-week checklist (server-verified) → Staff setup wizard applies a task template → Chat tab sends a message that renders (local-first IndexedDB) |

## De-flake
`debug-rsvp2` (a debug harness) used coordinate clicks on the wizard's
footer Continue/Submit — the documented CDP hit-test quirk. Converted to
programmatic `element.click()`; 4/4 consecutive runs pass.

## Hardening
`i18n/translations.test.ts` +4 — enforces that all four locales define
EXACTLY the same key set (a missing key silently falls back to English),
values are non-empty with balanced braces, and translated values keep the
same `{placeholder}` names. Guards the i18n layer from future drift.

## Totals
Client unit 988 (was 982) · server 698 · e2e 49 specs — all green.
