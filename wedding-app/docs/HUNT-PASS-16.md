# Gap-Hunting Pass 16 — Data-Overflow Fix: Documents & Timeline "Show All"

**Date:** 2026-08-07
**Process:** GAP-HUNTING-PROCESS.md Phase 1.2 (data-truncation scan).

---

## Gap found & fixed

### The Couple hub hard-capped lists and silently hid user data

The Couple Event Hub truncated long data without any way to see the rest:

- the **Document Hub** rendered only the first **8** documents
  (`documents.slice(0, 8)`), and
- the **Couple Timeline Review** rendered only the first **10** timeline
  items (`items.slice(0, 10)`).

For a couple with a busy wedding (contracts, vendor docs, insurance, guest
spreadsheets, playlists, ceremony docs, plus old versions), anything beyond
the cap was **permanently unreachable**: no pagination, no "show more", no
search. The files existed server-side and the counts at the top of each card
("12 documents") advertised data the grid refused to show — a silent
data-loss experience exactly like the guest-show caps we fixed in earlier
passes.

Worse, the cap had a *functional* bite: the "New version" and "Edit
details" buttons live on the same cards, so a doc pushed past position 8
could no longer receive a new version or metadata edits at all.

## Fix

`CoupleEventHub.tsx`:

- `const [showAllDocs, setShowAllDocs] = useState(false)` —
  `documents.slice(0, showAllDocs ? undefined : 8)`, with a toggle below the
  grid when `documents.length > 8`: **"Show all N documents" ⇄ "Show
  fewer"**.
- `const [showAllTimeline, setShowAllTimeline] = useState(false)` —
  `items.slice(0, showAllTimeline ? undefined : 10)`, with a matching toggle
  when `items.length > 10`: **"Show all N timeline items" ⇄ "Show fewer"**.

Toggles render as a centered ghost button and disappear automatically when
data drops back under the cap. Toggling does not refetch — it only reveals
already-loaded data, so it is instant and offline-safe.

## Regression tests

1. **Unit** (`CoupleEventHub.test.tsx`, 2 new):
   - *"shows ALL documents when a couple has more than 8"* — mocks 11
     documents; asserts doc-10 is hidden, the "Show all 11 documents" toggle
     appears, and clicking it reveals doc-10.
   - *"shows ALL timeline items when a couple has more than 10"* — mocks 13
     timeline items; asserts item-12 hidden then revealed via the toggle.
   - The describe-level `beforeEach` also now restores the default documents
     payload so the new tests cannot pollute the ones after them.
2. **E2E** (`couple-documents.e2e.spec.ts`, 1 new): seeds 10 real documents
   through the API (staggered >1s apart because `created_at` has second
   precision and the list sorts newest-first), logs in as the couple, asserts
   only 8 cards render with `toggle-doc-1.pdf` hidden, clicks **Show all N
   documents**, asserts the hidden docs appear, clicks **Show fewer**, and
   asserts they hide again.
   - Also hardened the pre-existing spec: it now self-cleans its own
     leftover `sample-*`/`toggle-*` documents from the demo event before each
     test. Without cleanup, accumulated docs from prior runs pushed the fresh
     upload past the 8-card cap and the "New version" input never rendered —
     a latent test-order bug exposed by the fix itself.

## Verification

- client `tsc --noEmit`: clean
- server `tsc --noEmit`: clean
- client unit: **1002 passed** (144 files)
- server unit: **702 passed** (94 files)
- e2e (Playwright, chromium): **54 passed** (was 53)
- Browser-verified: toggle appears/reveals/hides in a real Chromium session
  against the running server.
