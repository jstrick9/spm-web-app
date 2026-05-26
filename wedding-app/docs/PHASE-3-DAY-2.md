# Phase 3 · Day 2 — Configurability Foundation Complete

The platform now has the **infrastructure** for owner/admin to configure
**everything** about the look and behavior of the app. Day 3 builds the
admin UI (Theme Studio + Widget Studio); Days 4+ build screens that
consume this foundation natively.

## What's in Day 2

### 🧬 The PlatformConfig schema (`src/config/schema.ts`)
A single zod-validated type covering every configurable aspect:

| Section | Configurable items |
|---|---|
| `theme` | 11 brand colors, font choice for display/body/mono, density (compact/comfortable/spacious), radius (sharp/soft/pill), motion (minimal/standard/expressive), color scheme |
| `widgets` | Per-slot widget lists with per-instance options (thresholds, periods, labels) |
| `layout` | Nav item order + visibility, sidebar default state, per-feature flags |
| `branding` | Platform name, logo, favicon, support email, tagline |

### 🌊 The cascade resolver (`src/config/resolveConfig.ts`)
4-layer merge: `SYSTEM_DEFAULTS → org → event → user`.
- Theme: per-field later-wins
- Widgets: per-slot replacement (so partial slot edits don't surprise admins)
- Layout: nav items later-wins, feature flags per-field merge
- Branding: per-field later-wins

### 🎨 Six curated theme presets (`src/config/presets.ts`)
Each picks colors + fonts + density + radius + motion:
- **Classic Aubergine** (default — deep purple + champagne)
- **Coastal Navy** (navy + sand)
- **Garden Sage** (sage + terracotta, botanical)
- **Modern Onyx** (high-contrast B&W + electric accent)
- **Blush Rose** (soft pink, romantic)
- **Industrial Slate** (concrete + brass, loft-venue)

Admins pick one with one click; the "Custom" mode (Day 3) lets them tweak any token.

### 🪝 React provider + hooks (`src/config/ConfigProvider.tsx`)
```tsx
<ConfigProvider org={orgConfig} event={eventConfig} user={userConfig}>
  <App />  {/* every screen auto-themes */}
</ConfigProvider>
```
And inside any component:
```ts
const theme    = useTheme();             // resolved theme
const branding = useBranding();          // platform name, logo, etc.
const navItems = useNavItems();          // configured nav order
const slot     = useWidgetSlot('venue.dashboard.kpis');
const onReports = useFeatureEnabled('reports');
const { setPreviewOverride, previewActive } = usePlatformConfig();
```

### ⚡ Live-preview engine (`src/config/ThemeProvider.tsx`)
Writes CSS variables to `<html>`. Hot-reloadable — change a token, every component using `bg-brand` / `text-fg-muted` updates instantly (no React remount). This is what powers the Theme Studio's live preview in Day 3.

```ts
applyTheme(theme);                  // imperative, also works from non-React code
<ThemeProvider theme={resolved.theme}>...</ThemeProvider>   // declarative
```

### 🧩 The widget registry (`src/config/widgets/registry.tsx`)
Each widget is a typed entry with:
- stable id (`kpi.booking-conversion`)
- which slot families it fits (so the Widget Studio can show valid placements)
- a default grid size (sm/md/lg/xl)
- optional zod schema for per-instance options (e.g. industry benchmark %)
- the React component

Day 2 ships 10 widgets across 4 categories:
- KPIs: booking conversion, revenue per event, RSVP velocity, vacancy, guest count, RSVP rate
- Charts: dietary breakdown, timeline density
- Hero: event countdown, RSVP CTA

Adding an 11th is **one entry in the registry** — the Widget Studio (Day 9) and every slot consumer auto-pick it up.

### 🔌 `<WidgetSlot id="…">` — the render glue
```tsx
<WidgetSlot id="venue.dashboard.kpis" />
```
Renders the configured widgets in the configured order. Unknown widget ids log a console warning and skip (graceful degradation if a deploy drops a widget the org config still references).

## Test totals

| | Phase 2 | Day 1 | **Day 2** |
|---|---|---|---|
| Client tests | 62 | 106 | **141** (+35) |
| Client coverage (lines) | 83% | 87% | **88%** |
| Server tests (unchanged) | 89 | 89 | 89 |
| Smoke E2E | 11/11 | 11/11 | 11/11 |
| **Total checks** | 162 | 206 | **241** |

## What the 35 new tests cover

- **Schema validation** — full + partial, including rejection of bad rgb triplets, unknown density/radius values, etc.
- **All 6 presets parse correctly**
- **Resolver cascade** — all combinations: system-only, org overrides system, event overrides org, user overrides event, branding merges field-wise, feature flags merge, widget slots replace
- **`SYSTEM_DEFAULTS` is never mutated** (the resolver uses `structuredClone`)
- **ConfigProvider** — exposes resolved config, applies CSS vars, density affects control height, feature flags observable, preview override reactive, hooks throw outside provider
- **WidgetSlot** — renders defaults, respects org overrides, skips unknown widget ids quietly, honors per-widget options

## Architecture diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  PlatformConfig (zod-typed schema — single source of truth)      │
│  ├─ theme        (colors, type, density, radius, motion)         │
│  ├─ widgets      (per-slot widget choice + thresholds)           │
│  ├─ layout       (nav order, hidden features)                    │
│  └─ branding     (logo, name, support email, tagline)            │
└────────────────────────────┬─────────────────────────────────────┘
                             │ stored across 3 scopes:
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  Storage (priority: low → high)                                  │
│   1. SYSTEM_DEFAULTS  (in code — src/config/defaults.ts)         │
│   2. ORG config       (organizations.settings.platformConfig)    │
│   3. EVENT config     (events.metadata.platformConfig)           │
│   4. USER config      (users.preferences.platformConfig)         │
└────────────────────────────┬─────────────────────────────────────┘
                             │ resolved by
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  resolveConfig({org, event, user}) → PlatformConfig              │
│           ↓                                                      │
│  <ConfigProvider> (React context)                                │
│           ↓                                                      │
│  ├─ <ThemeProvider> applies CSS vars to <html>                   │
│  ├─ useTheme() / useBranding() / useFeatureEnabled()             │
│  ├─ useWidgetSlot('venue.dashboard.kpis') → ordered widget ids   │
│  └─ <WidgetSlot id="…" /> renders the widgets                    │
└──────────────────────────────────────────────────────────────────┘
```

## What Day 3 builds

The admin Theme Studio + the App Shell:

- **App shell** — sidebar (uses `useNavItems`), top bar with org/event switcher, command palette ⌘K, responsive
- **Settings → Platform Studio** admin page:
  - "Choose a preset" gallery (the 6 themes shown as cards with live mini-previews)
  - "Custom Theme" tab — color pickers + font choosers + density toggles + motion + radius
  - **Live preview** — every change reskins the surrounding app instantly (powered by `setPreviewOverride`)
  - "Save to organization" persists via `PUT /api/orgs/:id/config`
- **Save flow** — preview state vs. saved state separately tracked, "Discard changes" reverts

Server endpoint to add: `PUT /api/orgs/:id/config`, `PUT /api/events/:id/config`, `PUT /api/users/me/preferences`. All store `partialPlatformConfig` JSON in the existing `settings` / `metadata` / `preferences` columns — no schema migration needed.

## What Days 9+ build

- **Widget Studio** — drag-drop reorder, add/remove widgets per slot, configure per-widget options
- **Layout Studio** — reorder nav items, toggle feature flags, set default sidebar state
- All written to the same `PlatformConfig` shape, no extra endpoints needed
