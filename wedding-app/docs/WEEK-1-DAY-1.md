# Week 1 · Day 1 — Events Spine Complete

The "spine" of the platform is in place: a real Events list with kanban +
table views, search + status filters, a production-grade create dialog,
and an Event Detail screen with the full tab structure that Weeks 1-8
will fill in.

## What you can do RIGHT NOW

```bash
cd wedding-app
npm run dev:server    # terminal 1
npm run dev:client    # terminal 2
# Open http://localhost:5173/, log in as owner@demo.local / wedding123
```

1. **Open `/events`** — see the kanban-style status board with one column per status
2. **Toggle to "List"** — same data as a sortable table with budget/guest count columns
3. **Type in the search box** — debounced 250ms, fires a real server query with the search param
4. **Click a status chip** — filters live by status
5. **Click "New event"** — proper modal form with react-hook-form + zod validation:
   - "Title required" / "End date must be after start date" / "Budget can't be negative"
   - Status picker with descriptions for each option
   - Budget in dollars (converted to cents server-side)
6. **Submit** — creates the event, invalidates the cache, navigates you to its detail page, shows a success toast
7. **Land on event detail** — 7 tabs: Overview, Guests, Timeline, Vendors, Layout, Portal, Settings
   - **Overview** shows real KPIs (guest counts, RSVP rate) + the configurable widget slot
   - **Settings** has a live status dropdown (changes persist + update the events list when you go back)
   - Other tabs show a friendly "coming soon" stub with the roadmap date
8. **Press ⌘K** — command palette includes navigation, sign-out, and dev tools
9. **Open `/system/platform`** and apply a different theme — the events screen reskins instantly

## What Day 1 delivered

### 🧭 Routing
- New `src/lib/router.ts` — hash-based router with `:param` matching, query-string parsing, programmatic `navigate()`
- `matchPath('/events/:id', actualPath)` → typed params
- `matchPrefix()` for "is this a sub-route?"
- Tab selection persisted in `?tab=` query string so refresh/sharing works
- 10 tests for `matchPath` / `matchPrefix`
- 3 tests for `useDebouncedValue` (used by search)

### 🗂️ Events List (`src/screens/events/EventsList.tsx`)
- **Two view modes**: Kanban (one column per status) and List (sortable table)
- **Search**: full-text against title + slug, debounced 250ms
- **Status filter chips**: All + 7 statuses with live counts
- **Status meta** (`statusMeta.tsx`): centralized labels, colors (color-blind-safe), dot colors, badge variants
- **Loading state**: skeleton tiles for kanban / skeleton rows for table
- **Error state**: surfaced inline with the actual error message
- **Empty state**: differentiates "no events at all" vs "no events match filters"
- **TanStack Query** with `placeholderData: keepPreviousData` so the screen doesn't flash empty between filter changes
- Click any card / row → navigate to event detail

### ➕ Create Event Dialog (`CreateEventDialog.tsx`)
- **react-hook-form + zod** form layer with proper error UI
- Validated fields: title (1-200 chars), status enum, dates in YYYY-MM-DD, end ≥ start, non-negative guest count + budget
- Budget input shows `$` prefix, value in dollars; converts to cents on submit
- Status select shows description per option (e.g. "Lead — Initial inquiry")
- Optimistic UX: mutation cancels duplicate clicks (`disabled while pending`), success toast, error toast with friendly translation of `forbidden` / `validation` / etc.
- React-query `invalidateQueries(['events', orgId])` so the list refreshes
- Auto-navigate to the new event's detail page

### 🗒️ Event Detail (`EventDetail.tsx`)
- Header shows title (Fraunces serif), status badge, date range, guest count, budget
- **7-tab structure** with icons, persisted in the URL via `?tab=`
- **Overview tab**: 4 real KPI tiles wired to live guest counts (`Guests invited / RSVP rate / Pending / Confirmed attending`) + the admin-configurable widget slot for further intelligence
- **Settings tab**: live status dropdown using the new Select component; mutation updates both `['event', id]` and `['events']` caches; toast confirmation
- **Other tabs**: "Coming Soon" stubs explaining the roadmap week each will arrive — so the platform looks complete from day one without faking depth

### 🧩 New UI primitive: Select (`src/ui/Select.tsx`)
- Built on Radix Select for full keyboard support, focus management, portal-positioned dropdown
- Themed with our brand tokens
- Used by the create dialog's status picker and the settings tab's status changer

### 🗄️ Server changes
- `eventsRepo.listForOrg()` accepts `search`, `status[]`, `startsAfter`, `startsBefore`, `limit`, `offset`
- New `eventsRepo.countByStatus(orgId)` returns counts per status for the chip badges
- `GET /api/orgs/:orgId/events` returns `{ events, counts }` (was just `{ events }`)
- All 100 existing server tests still pass

### 🗃️ Real migrations infrastructure
- Migration runner at `src/db/migrate.ts` reads `src/db/migrations/NNNN_name.sql` in order
- Records applied migrations in `schema_version` table
- Each migration runs in a transaction; failure rolls back
- First migration `0001_initial.sql` contains the existing schema (no schema changes today; Days 2-5 add 0002+)

## Test totals

| | Day 3 (last) | **Week 1 Day 1** |
|---|---|---|
| Server tests | 100 | **100** |
| Client tests | 145 | **170** (+25) |
| Smoke E2E | 11/11 | **11/11** |
| Typecheck (server + client) | clean | clean |
| Build | clean | clean |
| **Total automated checks** | 256 | **281** |

### 25 new client tests cover
- Router: `matchPath` with 0/1/n params, segment-count mismatches, URL decoding
- Router: `matchPrefix` exact, sub-path, partial-word rejection, trailing slash
- Debounce: initial value, delay timing, rapid-change reset (last-write-wins)
- EventsList: page header + toolbar, kanban groups events by status, view toggle to list, empty state, search query reaches server, opens create dialog
- CreateEventDialog: all fields render, empty title blocks submit with field error, date range cross-validation, successful create calls onCreated + closes, server error shows toast + stays open, budget dollars→cents conversion

## Files added/modified Day 1

```
client/src/lib/router.ts                          # NEW
client/src/lib/router.test.ts                     # NEW - 10 tests
client/src/lib/useDebouncedValue.ts               # NEW
client/src/lib/useDebouncedValue.test.ts          # NEW - 3 tests
client/src/ui/Select.tsx                          # NEW
client/src/screens/events/EventsList.tsx          # NEW
client/src/screens/events/EventsList.test.tsx     # NEW - 6 tests
client/src/screens/events/CreateEventDialog.tsx   # NEW
client/src/screens/events/CreateEventDialog.test.tsx  # NEW - 6 tests
client/src/screens/events/EventDetail.tsx         # NEW
client/src/screens/events/statusMeta.tsx          # NEW
client/src/App.tsx                                # rewritten to use new router + screens
server/src/db/repos/events.ts                     # listForOrg + countByStatus enhanced
server/src/routes/events.ts                       # GET /events returns counts; accepts search/status/dates
server/src/db/migrate.ts                          # NEW - migration runner (replaces old applySchema)
server/src/db/migrations/0001_initial.sql         # NEW - bootstrap migration
design-preview.html                               # updated to show the new Events screen
docs/WEEK-1-DAY-1.md                              # this file
```

## What Day 2 will build (already specified)

**Guests management** — full-featured guest list:
- Searchable, filterable, sortable table of all guests in an event
- Inline rsvp_status edit, table assignment dropdown, dietary notes
- Add / edit / delete guest dialogs (react-hook-form + zod)
- Plus-one handling, party grouping
- Bulk select with bulk operations (assign table, mark RSVP, delete)
- Guest detail panel (slide-over)
- 25+ new tests

After Day 2: real wedding planning can happen. Day 3 builds CSV import on top.
