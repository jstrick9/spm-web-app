# Week 1 · Day 2 — Guests Management Complete

The Guests tab on every event detail page is now real product. A planner
can manage 150+ guests for a wedding through a clean, fast, accessible UI.

## What you can do RIGHT NOW

```bash
cd wedding-app
npm run dev:server  # terminal 1
npm run dev:client  # terminal 2
# Open http://localhost:5173/ → log in → Events → pick one → Guests tab
```

1. **Add a guest** — full form with name, email, phone, party, RSVP status,
   table, dietary, accessibility, plus-one, portal access. Field-level
   validation via zod (try entering "not-an-email" and clicking Add).
2. **Edit a guest** — click any row → drawer slides in → click Edit. Same
   form, pre-filled.
3. **Inline RSVP change** — click the colored RSVP pill on any row →
   dropdown opens → pick a new status → it patches the server and updates
   the toolbar counts immediately (no row click required).
4. **Search** — type a name, email, or party — instant client-side filter
   with 250ms debounce.
5. **Filter by RSVP** — click a chip (Pending / Attending / Declined / Maybe).
6. **Sort by any column** — click "Name" / "Email" / "Party" / "RSVP" / "Table"
   — first click ascending, second descending.
7. **Multi-select** — check rows individually OR use the header checkbox
   to toggle all visible rows. The header checkbox shows as indeterminate
   ("−") when some-but-not-all are selected.
8. **Bulk actions** — with 1+ selected, the toolbar shows "N selected".
   Click "Actions" to:
   - Set RSVP status (pending / attending / declined / maybe)
   - Allow / revoke portal access
   - Delete (with confirmation; 5+ items require typing "DELETE" to confirm)
9. **Guest detail drawer** — slides in from the right with:
   - Contact info (email, phone)
   - Assignment (table, room, seat)
   - Dietary + accessibility notes (in highlighted cards)
   - RSVP submission history (loaded from /api/events/:id/rsvps)
   - Portal-access status with "Open portal" link
   - Edit + Delete actions

## Files added/modified

```
client/src/ui/Checkbox.tsx                                   # NEW - Radix Checkbox (tri-state)
client/src/ui/Sheet.tsx                                      # NEW - slide-over panel (Radix Dialog under the hood)
client/src/ui/DropdownMenu.tsx                               # NEW - Radix DropdownMenu
client/src/screens/events/guests/rsvpMeta.tsx                # NEW - centralized RSVP status meta
client/src/screens/events/guests/GuestFormDialog.tsx         # NEW - add/edit dialog (react-hook-form + zod)
client/src/screens/events/guests/GuestDetailDrawer.tsx       # NEW - slide-over detail panel
client/src/screens/events/guests/DeleteConfirmDialog.tsx     # NEW - destructive-action confirm
client/src/screens/events/guests/BulkActionsMenu.tsx         # NEW - bulk-update + delete
client/src/screens/events/guests/GuestsToolbar.tsx           # NEW - search + filter chips + add/import
client/src/screens/events/guests/GuestsTable.tsx             # NEW - sortable, multi-select, inline RSVP
client/src/screens/events/guests/EventGuestsTab.tsx          # NEW - composes the whole tab
client/src/screens/events/EventDetail.tsx                    # Wire the Guests tab into EventDetail
client/src/test/handlers.ts                                  # Strengthened PATCH /guests handler to map camelCase

# Tests (39 new)
client/src/screens/events/guests/rsvpMeta.test.tsx           # 2 tests
client/src/screens/events/guests/GuestFormDialog.test.tsx    # 8 tests
client/src/screens/events/guests/GuestsTable.test.tsx        # 10 tests
client/src/screens/events/guests/BulkActionsMenu.test.tsx    # 6 tests
client/src/screens/events/guests/EventGuestsTab.test.tsx     # 7 tests
client/src/screens/events/guests/DeleteConfirmDialog.test.tsx # 6 tests
```

## What the 39 new tests cover

### `GuestFormDialog` (8 tests)
- All fields render (create mode)
- Empty name blocks submit with "Name is required"
- Invalid email rejected ("Invalid email")
- onSaved + onOpenChange(false) on success
- Plus-one checkbox sends `plusOneAllowed: true` in POST body
- Server error surfaces a toast and dialog stays open
- Edit mode pre-fills with the guest's values
- PATCH on save

### `GuestsTable` (10 tests)
- One row per guest renders
- Empty state (no guests at all)
- Empty state (filtered — shows "Clear filters")
- Click row → onRowClick fires with the guest
- Click checkbox does NOT also fire onRowClick (stopPropagation)
- Select-all in indeterminate state when some rows are selected
- Select-all clears/sets all visible row ids
- Click header → onSortChange fires
- Inline RSVP dropdown patches server and does NOT open the drawer
- +1 / 🍽 / ♿ / 🔒 tags render appropriately

### `EventGuestsTab` (7 tests)
- Lists guests + shows toolbar
- Search filters client-side (with debounce)
- Status chip filters
- Click row opens detail drawer
- Selecting reveals bulk-actions bar
- Sort name asc → desc flips order
- "Add guest" opens create form

### `BulkActionsMenu` (6 tests)
- Shows selected count
- Clear button calls onCleared
- Bulk-set RSVP fires one PATCH per selected guest
- Partial failure surfaces "Updated N of M" toast
- Bulk delete < 5 single-click confirm works
- Bulk delete ≥ 5 requires typing "DELETE"

### `DeleteConfirmDialog` (6 tests)
- "Delete guest?" for single
- "Delete N guests?" for bulk
- < 5: Delete enabled immediately
- ≥ 5: typing "DELETE" enables button (case-sensitive)
- Cancel closes
- Delete invokes onConfirm

### `rsvpMeta` (2 tests)
- Every RSVP status has metadata
- RsvpBadge renders the right label

## Test gate

| Layer | Last (Day 1.5) | **Day 2** |
|---|---|---|
| Server tests | 139 | **139** (unchanged) |
| Client tests | 170 | **209** (+39) |
| Client coverage (lines) | 81% | **82%** |
| Smoke E2E | 11/11 | **11/11** |
| Typecheck | clean | clean |
| Build | clean | clean |
| **Total automated checks** | 320 | **359** |

## What's NOT in Day 2 (deliberately)

- **CSV import** — Day 3 is dedicated to this (full file picker + column
  detection + per-row validation + import-with-progress + error report).
  The "Import CSV" button in the toolbar is wired but opens a "coming
  tomorrow" placeholder.
- **Drag-drop table assignment** — Week 2 with the Floor Plan canvas.
  Today, table assignment is free-text.
- **Magic-link guest invitation email** — Day 4 (Portal) wires email via
  the integration framework from yesterday.
- **Server-side search/sort/pagination** — current scope filters
  client-side (instant, no network) and the SDK list call returns the
  whole event's guests. Server-side filtering arrives when a real event
  has > 500 guests (today the page works smoothly with thousands locally).

## Day 3 preview

**Production-grade CSV import**:
- File picker (`.csv`, `.tsv`, `.xlsx` planned)
- Auto-detect columns: name / email / phone / party / RSVP / table / dietary / accessibility
- Header-row picker (manual override if auto-detect is wrong)
- Preview table with per-row validation errors highlighted in red
- "Skip / Replace / Append" strategy when emails collide with existing guests
- Import with live progress bar
- Success / error summary report (downloadable as a "failures.csv" so the
  planner can fix and retry)
- ~25 more tests

Estimated: 1 working day. By the end of Day 3, the wedding-critical
flow (event → guests → RSVP) is shippable.
