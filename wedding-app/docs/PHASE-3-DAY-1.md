# Phase 3 · Day 1 — Design Foundation Complete

This is the first slice of Phase 3 (the broadened 10-day intelligence-platform
build). Day 1 establishes the **design system** — the components, tokens,
typography, motion, and intelligence primitives that every subsequent screen
will compose.

## What's in Day 1

### 🎨 Brand tokens (`src/styles/tokens.css` + `global.css`)
- **3 palettes**: neutral (warm greys), brand (aubergine + champagne accent), data viz (8-color categorical, color-blind safe)
- **Dark mode**: full token re-binding with one class flip; pre-paint script in `index.html` prevents flash
- **Typography pair**: Fraunces (editorial serif) + Inter (UI sans) + JetBrains Mono (data)
- **Motion**: 4 named durations + 2 easings, plus `prefers-reduced-motion` honored

### 🧱 Base UI components (`src/ui/*.tsx`)
13 production-grade components, shadcn-style (owned, not a dep):

| Component | Built on | Status |
|---|---|---|
| `Button` (7 variants × 5 sizes + asChild + isLoading) | Radix Slot + CVA | ✅ tested (10 tests) |
| `Input` (slots, invalid state) | native | ✅ tested (3 tests) |
| `Label` | Radix Label | ✅ |
| `Card` + Header/Title/Description/Content/Footer | native | ✅ tested (2 tests) |
| `Badge` (8 variants) | CVA | ✅ tested (9 tests) |
| `Dialog` (modal with focus trap, ESC, swipe-close) | Radix Dialog | ✅ |
| `Tabs` | Radix Tabs | ✅ |
| `Toast` (5s autodismiss, a11y live region, success/destructive variants) | Radix Toast | ✅ tested (2 tests) |
| `Form` + FormField/Item/Label/Control/Description/Message | react-hook-form | ✅ |
| `DataTable` (typed columns, empty state, row click, density) | native | ✅ tested (3 tests) |
| `Skeleton` (a11y-aware loading) | native | ✅ |
| `EmptyState` (icon + title + desc + action) | native | ✅ tested (1 test) |
| `ThemeToggle` (light/dark/system) | native | ✅ tested (2 tests) |

### 📊 Intelligence primitives
The pieces that make this an *intelligence* platform:

- **`StatCard`** — the canonical dashboard tile. Big value + trend indicator + benchmark + optional sparkline. Used for booking conversion, RPE, RSVP velocity, vacancy, etc.
- **`Sparkline`** — tiny inline area chart for use inside StatCards (recharts under the hood).
- **8-color chart palette** — bound to `--color-chart-1..8` for consistent data viz across the platform.

### 🖼️ Live styleguide (`#/preview`)
A single page showing every component side-by-side. Visit:
```bash
cd wedding-app
npm run dev:server    # terminal 1
npm run dev:client    # terminal 2
# → http://localhost:5173/#/preview
```

You'll see:
- Hero (editorial aesthetic with brand gradient)
- All button variants × sizes
- Input states + slotted icons
- All badge colors
- Three card variations
- **4 intelligence widgets** with realistic data (booking conversion, RPE, RSVP velocity, vacancy with `down=good` trend)
- Tabs, Dialog, Toast, Table, Skeleton, EmptyState
- Type stack (Fraunces + Inter + JetBrains Mono)
- Dark mode toggle in the top-right

### 📦 Dependencies added (Day 1)
- **Tailwind 4 + `@tailwindcss/vite`** — atomic styling
- **8× Radix UI primitives** — a11y for Dialog, Toast, Tabs, Label, Slot, etc.
- **shadcn/ui helpers** — `class-variance-authority`, `clsx`, `tailwind-merge`
- **`lucide-react`** — icon set (~70KB tree-shaken)
- **`recharts`** — charts (Sparkline now, KPI charts in Day 5)
- **`react-hook-form` + `zod` + `@hookform/resolvers`** — form layer
- **`framer-motion`** — tasteful motion (used in subsequent days)
- **`@playwright/test` + `@axe-core/playwright`** — Day 10 E2E + a11y

## Stats

| Metric | Phase 2 | Day 1 | Δ |
|---|---|---|---|
| Client tests | 62 | **106** | +44 |
| Client coverage (lines) | 83% | **87%** | +4 |
| Bundle size (gzip) | 63 KB | **201 KB** | +138 KB (recharts + Radix + framer) |
| Server tests | 89 | 89 | 0 |
| End-to-end smoke | 11/11 | 11/11 | 0 |
| **Total automated checks** | 162 | **206** | +44 |

The bundle bump is the cost of the design system. We code-split recharts in Phase 8 to recover ~140 KB.

## What's NOT in Day 1

By design — these come in Days 2+:
- **Persistent app shell** (sidebar + topbar + command palette) — Day 2
- **Auth screens redesign** — Day 3
- **Events screens** (kanban, detail, intelligence widgets) — Days 5-6
- **Real intelligence widgets** wired to backend data — Days 5-7
- **Playwright E2E tests** — Day 10

## How to evaluate Day 1

1. **Visit `#/preview`** with the dev server running. Click around. Toggle dark mode (top right).
2. **Look at the StatCard widgets** — those four tiles are the "this isn't a CRUD app" moment. They're the building blocks for the venue dashboard.
3. **Check the editorial aesthetic** at the hero — that's the look the couple-facing portal will inherit (Days 5, 8).
4. **Try the Dialog and Toast** — they're a11y-correct (focus trap, ESC, ARIA live).
5. **Inspect the type stack section** — verify Fraunces loads (it's the serif). If not, you're offline and Google Fonts is unreachable; the fallback is Cambria/Georgia which still looks OK.

## Day 2 preview

Day 2 builds the **persistent app shell** that wraps every authenticated screen:
- Sidebar navigation (collapsible, mobile-friendly)
- Top bar with org/event switcher and user menu
- Command palette (⌘K) for quick navigation + actions
- Responsive layout that adapts mobile → desktop
- Skeleton states throughout

Estimated: 1 working day. By the end of Day 2 the app will *feel* like a real platform (not a single-page POC).
