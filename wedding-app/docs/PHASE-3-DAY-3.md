# Phase 3 · Day 3 — App Shell + Theme Presets + Backend Persistence

The configurability layer from Day 2 is now **end-to-end usable**: an
owner/admin can switch themes via a UI, the choice persists to the server,
every user in the org sees the change on their next page load, and all of
it is gated by the RBAC system from Phase 1.1.

## What Day 3 delivered

### 🏗️ App Shell (`src/ui/AppShell.tsx` + `CommandPalette.tsx`)
The persistent layout every authenticated screen lives inside:

- **TopBar**: brand logo (from `useBranding()`), spacer, ⌘K search trigger, theme toggle, user menu
- **Sidebar**: nav items from `useNavItems()` — order, labels, and hidden state all admin-configurable; bottom "Platform Studio" link always available to admins
- **Responsive**: desktop = fixed rail; mobile = slide-over drawer with hamburger toggle
- **Command palette** (⌘K / Ctrl-K): cmdk-powered fuzzy search across navigation + actions + dev tools

### 🎨 Platform Studio (`src/screens/PlatformStudio.tsx`)
The admin UI for changing themes. Day 3 ships the **presets tab**:
- 6 hand-tuned theme cards with color swatches + font preview
- **Hover any card → live preview** of the whole app (no save needed)
- Click "Apply to organization" → persists via `PUT /api/orgs/:id/config`
- "Active" badge on the currently applied preset
- Tabs for Widgets / Layout / Branding stubbed out (built in Days 4 + 9)

### 🔌 Backend persistence (`server/src/routes/platformConfig.ts`)
3 endpoints, fully RBAC-gated:

| Endpoint | Permission required |
|---|---|
| `GET / PUT /api/orgs/:orgId/config` | `org.view` to read, `roles.manage` to write |
| `GET / PUT /api/events/:eventId/config` | `events.view` / `events.edit` |
| `GET / PUT /api/users/me/preferences` | authenticated user |

Storage: org config → `organizations.settings.platformConfig`, event config → `events.metadata.platformConfig`, user prefs → `users.preferences.platformConfig`. No schema migration needed — existing JSON fields just gained a new key.

64KB payload limit. Audit log entry written on every PUT.

### 🧠 The full configurability loop now closes

1. Admin opens `Settings → Platform Studio`
2. Hovers a preset → app reskins live (via `setPreviewOverride`)
3. Clicks "Apply" → `PUT /api/orgs/:id/config` → server validates + audits
4. `onSaved` callback updates the local `orgConfig` state
5. `ConfigProvider` re-resolves the cascade → `ThemeProvider` rewrites CSS vars
6. Every component re-renders with the new theme — **instantly, no remount**

Other users in the org will see the new theme on their next page load
(or sooner if we add a config-changed SSE event in Phase 8).

## Test totals

| | Day 1 | Day 2 | **Day 3** |
|---|---|---|---|
| Server tests | 89 | 89 | **100** (+11 platform-config endpoints) |
| Client tests | 106 | 141 | **145** (+4 PlatformStudio) |
| Client coverage (lines) | 87% | 88% | 81% (App.tsx + AppShell newly excluded from coverage; Day 10 E2E covers them) |
| **Total automated checks** | 206 | 241 | **256** |

## Files added Day 3

```
server/src/routes/platformConfig.ts                # 3 endpoints + size guard + audit
server/src/routes/platformConfig.integration.test.ts  # 11 integration tests
client/src/sdk/platformConfig.ts                   # SDK wrapper
client/src/ui/AppShell.tsx                         # TopBar + Sidebar + responsive
client/src/ui/CommandPalette.tsx                   # ⌘K palette built on cmdk
client/src/screens/PlatformStudio.tsx              # Presets gallery + live preview
client/src/screens/PlatformStudio.test.tsx         # 4 tests
client/src/App.tsx                                 # Refactored to use AppShell + hash routing
design-preview.html                                # Updated static preview
```

## How to evaluate Day 3

### Live (interactive)
```bash
cd wedding-app
npm run dev:server      # terminal 1
npm run dev:client      # terminal 2
# → http://localhost:5173/
```
Log in as `owner@demo.local` / `wedding123`. Then:

1. **Top bar** has the brand, ⌘K search button, theme toggle, user menu
2. **Sidebar** with Dashboard / Events / Guests / Vendors / Reports / System
3. **Dashboard** shows the 4 KPI widgets (booking conversion, RPE, RSVP velocity, vacancy)
4. **Press ⌘K** — command palette opens, type to filter
5. **Click "Platform Studio"** in the sidebar footer (or via the palette)
6. **Hover any theme preset** — the whole app reskins LIVE — including the sidebar, KPIs, every component
7. **Click "Apply to organization"** — the choice saves to the server; refresh and it persists
8. **Resize the browser** — sidebar collapses to a hamburger on mobile
9. **Try the Coastal Navy preset, then the Modern Onyx, then back to Aubergine** — each takes effect instantly

### Static (no server)
Open `design-preview.html` — shows the App Shell + Platform Studio layout side-by-side, no JS required.

## Day 4 preview

Day 4 builds the **Custom Theme editor** — the granular tab that opens behind the "Open Custom Editor" button. Spec:
- Color pickers for every theme token (with HSL/RGB/hex inputs)
- Font selectors with live preview at multiple sizes
- Density / Radius / Motion controls with sample component previews
- Side-by-side "before / after" pane
- Save / Discard / Reset-to-Preset buttons

Day 4 also adds:
- **Branding tab**: platform name, logo upload, support email, tagline
- **User preferences page** (`#/settings/preferences`): per-user color scheme override + density override (accessibility)

Estimated: 1 working day. By end of Day 4 the Theme story is 100% complete and Days 5-7 can focus on Events + Guests with confidence that the design system is locked in.
