# UX/UI Improvements — Pass 1 (Native Dialogs → In-App, Theming, File Picker)

**Date:** 2026-08-04 · **Status:** shipped (UX-01…UX-03)

---

## UX-01 — Killed every native `window.prompt()` / `window.confirm()` (40+ sites)

Native browser prompts/dialogs were the single biggest end-user UX anti-pattern in the app:
inconsistent with the design system, page-blocking, and broken-feeling on mobile. The guest portal,
couple hub, vendor panels, admin queues, and layout canvas were riddled with them.

**New primitive:** `src/ui/usePrompt.tsx` — promise-based `ask()` / `askForm()` / `askConfirm()`
hooks that render proper Radix dialogs (autofocus, Enter submits, Escape cancels, required-field
validation, multiline textareas, destructive variant) and resolve promises so call sites keep their
natural `const note = await ask({...})` shape.

**Migrated surfaces:**
- **Couple hub + advanced planning + post-event closeout** (20+ sites): partner/planner invites,
  venue questions, event-change requests, vendor requests/questions, planner collaboration, layout
  comments, table assignment, timeline changes, appointments (request + reschedule), decisions
  (title + detail form), contract signing (typed signature dialog), finance questions, change
  orders, lost-item reports, testimonials, final-review change requests.
- **Public guest portal**: help requests (email + note form), secure-link requests, and the
  unsaved-RSVP discard warning — the most consumer-facing surface of all.
- **Venue surfaces**: day-of contact configuration (5 prompts → one multi-field form), COI change
  requests, admin change-request decisions (with notes), guest help replies/assignment, closeout
  queue follow-ups, communication-template editing, layout approval "request changes", purge-cache.
- **All delete/confirm flows** now use in-app destructive confirm dialogs: budget items, contracts,
  gallery images, inventory, questions, decor items/categories, venues, webhooks, staff tasks/
  shifts, timeline items, payments, layout version restores, AI layout replacement, layout status
  changes, sensitive broadcasts, portal enablement, branding resets, access revocation, admin
  defaults restore, event cancel/lost.

**Bug found & fixed while migrating:** reading `e.target.value` after an `await` in a controlled
select (the layout status change) silently used the pre-await value once React re-rendered the
select during the dialog — the new handlers capture the value before awaiting.

**Tests:** `usePrompt.test.tsx` (4) covering required-field validation, cancel/Escape, multi-field
forms, and confirm resolution; updated `PublicGuestPortal` + `CanvasPage` tests to drive the new
dialogs; full suite green.

## UX-02 — Themed the "paper" palette (329 hardcoded hex literals → tokens)

`bg-[#FDFBF7]`, `border-[#e1d5c9]`, `text-[#2C2A29]`, `bg-[#4A1942]` were scattered across 25+
files — run sheets, staff panels, payments — ignoring the design system and breaking dark mode.

- Added `--color-paper` (warm cream), `--color-paper-border`, `--color-paper-ink` to
  `styles/tokens.css` (light + dark values) and bound them in `styles/global.css`.
- Replaced **329 literals** with `bg-paper` / `border-paper-border` / `text-paper-ink` /
  `bg-brand`. Light-mode visuals are pixel-identical (values copied exactly); dark mode and future
  brand changes now apply everywhere automatically.

## UX-03 — Real file picker for couple documents

The couple hub previously had a single "Upload sample" button that uploaded a hardcoded fake PDF.
Now:
- A real **Choose file** button (hidden `<input type="file">` with `accept=".pdf,.jpg,.jpeg,.png,.webp"`)
  reads the file as a data URI, pre-fills the filename, and validates type + 8 MB size with inline
  error messages.
- **Upload** appears once a file is chosen; **Use sample file** remains as an explicit demo option.

**Tests:** `CoupleEventHub.test.tsx` (+1) — choosing a real file populates the draft and Upload
calls the SDK with the file's data URI.

---

## Validation

- Client `tsc --noEmit` ✅ · server `tsc --noEmit` ✅
- Client vitest **829/829** (126 files) ✅ (was 824 — +5 new tests)
- `npm run build` + bundle budgets ✅
- No native prompts/confirms remain in product code (`grep` clean).

## Follow-ups (next passes)

- Convert remaining bare `<button>` elements with only icon children to include `aria-label`
  (a11y pass), add empty-state illustrations on key dashboards, and unify the remaining one-off
  hex values (`#92400e` etc.) into semantic tokens.
- Apply the same dialog treatment to any remaining `window.confirm` in `client/e2e` or docs-adjacent
  code (none found).
