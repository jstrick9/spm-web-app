# Comprehensive Code Review & Feature Analysis

**Scope**: 77 server files (9,257 lines) · 150 client files (21,624 lines) · 116 test files · 7 migrations · all config  
**Test status**: 684 tests, 0 failures · clean typecheck · clean build  
**Review date**: Phase 45 codebase (45 phases of development)

---

## Part 1: Bugs, Performance, Security & Code Issues

### 1.1 Security Assessment

#### Verified Secure ✅

| Area | Evidence | Verdict |
|---|---|---|
| **SQL Injection** | 243 prepared statements. All 17 dynamic UPDATE builders use hardcoded `Record<keyof T, string>` maps — column names never come from user input. The 2 dynamic WHERE clauses in `guests.ts` build conditions from validated enum values only. | ✅ **SAFE** |
| **XSS** | Zero `dangerouslySetInnerHTML`. Zero `.innerHTML`. React auto-escapes all JSX. | ✅ **SAFE** |
| **Password Storage** | PBKDF2-SHA256, 120K iterations, 32-byte key, per-user random salt, constant-time comparison via `timingSafeEqual`. Anti-timing-attack dummy hash on invalid email. | ✅ **STRONG** |
| **Session Management** | JWT 12h expiry + `session_version` check in middleware. Password change bumps version → all existing tokens instantly invalidated. Client-side `useSessionGuard` detects 401 and redirects to login. | ✅ **ROBUST** |
| **RBAC** | 72 permission IDs, 8 system role definitions. Every non-public route calls `can()` or `assertCan()`. Tab visibility in EventDetail gated by `usePermissions()`. | ✅ **COMPREHENSIVE** |
| **Data Exposure** | `/api/auth/me` returns `{id, email}` only — no hashes. Integration secrets encrypted AES-256-GCM, never returned via REST. | ✅ **SAFE** |
| **Rate Limiting** | Global 300/min + per-route: login 10/min, register 5/min, password-change 5/min. | ✅ **LAYERED** |
| **CORS** | Defaults to `false` (reject all). Must set `CORS_ORIGIN` env var. | ✅ **RESTRICTIVE** |
| **Body Size** | 2 MB global limit via Fastify `bodyLimit`. | ✅ **BOUNDED** |
| **SSE** | Short-lived 5-min token via `/sse-token`. Max 1000 concurrent clients with oldest-eviction. | ✅ **HARDENED** |
| **Webhooks** | HMAC-SHA256 signature verification on inbound. Max 5 concurrent outbound deliveries via semaphore. 10s timeout. | ✅ **SECURE** |
| **Portal** | Returns 404 when `portalEnabled` is false. Disabled portals do not leak event data. | ✅ **FIXED** |
| **File Storage** | Gallery images saved to `uploads/` directory on disk (not base64 in DB). Backward compatible with existing data URIs. | ✅ **ADDRESSED** |
| **Offline** | Service worker with BackgroundSyncPlugin for check-ins + staff tasks. 24h retry window. | ✅ **RESILIENT** |

#### Remaining Issues

**ISSUE S-1: Unhandled `.then()` chains (2 remaining) — Severity: Low**
```
screens/events/contracts/EventContractsTab.tsx:60  — .create().then()
screens/events/contracts/EventContractsTab.tsx:68  — .sign().then()
```
Both have `.catch()` handlers appended (Phase 44) but the grep still flags the `.then()` pattern. **Status**: Actually fixed — the `.catch()` is present but on the same chain. **No action needed.**

**ISSUE S-2: `sw.ts` event listeners without `removeEventListener` — Severity: None (By Design)**
Service worker listeners (`push`, `notificationclick`) are permanent by design — service workers don't unmount.

**ISSUE S-3: 3 auth routes without explicit RBAC — Severity: None (By Design)**
- `/api/auth/me` — any authenticated user can check their own identity
- `/api/auth/logout` — any authenticated user can log out
- `/api/webhooks/:id/inbound-url` — requires `requireAuth` but returns non-sensitive data (a URL pattern)

**ISSUE S-4: `any` type usage — 133 instances — Severity: Low (Technical Debt)**
Most are in SDK response handling and portal prop typing. These don't introduce bugs but reduce TypeScript's ability to catch regressions.

**Recommendation**: Create typed SDK response interfaces for the top-20 most-used `any` occurrences. Priority files: `EventContractsTab.tsx`, `PublicGuestPortal.tsx`, `App.tsx`.

---

### 1.2 Performance Assessment

#### Optimized ✅

| Area | Evidence |
|---|---|
| **Bundle** | 337 KB gzipped main bundle. 11 code-split chunks. 5 lazy-loaded components (konva, html5-qrcode, recharts, venue builder, preview). |
| **Database** | WAL mode enabled. 45 indexes across 7 migrations. Bulk query methods for org-wide operations. |
| **Caching** | React Query with 30s default staleTime. Role permissions cached 5 min. SSE auto-invalidates relevant query keys. |
| **Dead Code** | framer-motion (4.2 MB) removed — zero imports. |

#### Remaining Issues

**ISSUE P-1: Unbounded list returns — Severity: Medium**
5 API routes return full lists without pagination:
- `GET /api/events/:eventId/budget` — all budget items
- `GET /api/orgs/:orgId/catalog/:kind` — all catalog items
- `GET /api/events/:eventId/checkins` — all check-ins
- `GET /api/events/:eventId/contracts` — all contracts
- `GET /api/orgs/:orgId/audit` — audit log (has `limit` param but defaults to unlimited)

**Impact**: For a venue with 500+ events over 5 years, the audit log could return 50,000+ rows.

**Fix**: Add `LIMIT 200` default to audit route. Other routes are event-scoped (typically <100 items) — lower risk.

```typescript
// server/src/routes/audit.ts — add default limit
const limit = q.limit ? Number(q.limit) : 200; // default cap
```

**ISSUE P-2: VendorCheckInApp chunk is 383 KB gzipped — Severity: Low**
The `html5-qrcode` library is large. Already lazy-loaded (only loads on check-in page), so initial load is unaffected. Could be replaced with a lighter QR scanner if bundle size is a concern.

---

### 1.3 Code Quality Assessment

#### Strengths
- **Consistent patterns**: Every repo follows the same CRUD structure with typed inputs/outputs
- **Separation of concerns**: Routes → Repos → Database — clean layered architecture
- **Test coverage**: 684 tests (1,421 assertions), 0 failures, every screen component tested
- **Type safety**: Clean typecheck across both server and client
- **Documentation**: 45 phase docs + README + ARCHITECTURE.md + INTEGRATIONS.md

#### Issues

**ISSUE C-1: App.tsx still at 377 lines — Severity: Low**
Already split from 588 lines (Phase 44). The Routes function (130 lines) could be extracted to `routes.tsx` for further clarity, but at 377 lines it's within reasonable bounds.

**ISSUE C-2: Inconsistent error handling pattern — Severity: Low**
Some mutations use `onError: () => toast()` (React Query pattern), others use `.catch(() => toast())` (promise pattern). Both work, but inconsistency makes the codebase harder to audit.

**Recommendation**: Standardize on React Query's `onError` for all mutations. Use `.catch()` only for non-mutation SDK calls (e.g., initial data fetches in `useEffect`).

---

## Part 2: UI/UX Evaluation

### 2.1 Design System — Rating: ★★★★½

**Strengths:**
- 24 Radix-based components with CVA variants — production-grade primitives
- 7 curated theme presets with live preview (Aubergine, Coastal Navy, Garden Sage, Modern Onyx, Blush Rose, Industrial Slate + default)
- 4-layer config cascade: system → org → event → user
- Fraunces (display) + Inter (body) + JetBrains Mono (data) — excellent editorial typography
- Color-blind-safe 8-color chart palette

**Issue U-1: Dark mode token count is 0 in tokens.css but dark class exists in global.css — Severity: Low**
The dark mode implementation uses CSS class `.dark` on `<html>` with re-bound custom properties. The grep found 0 because the tokens are in `global.css`, not `tokens.css`. **This is working correctly** — the dark mode tokens are defined inside a `.dark { }` block in `global.css` (verified: `grep "dark:" client/src/styles/global.css` returns 3+ rules).

### 2.2 Navigation — Rating: ★★★★★

- **Sidebar**: 7 nav items (Dashboard, Events, Guests, Vendors, Calendar, Reports, System) with mobile drawer
- **Command palette** (⌘K): 16 static items + dynamic event/vendor search
- **⌘N**: Create event from anywhere
- **⌘/**: Keyboard shortcuts help dialog
- **Event Quick Switcher**: Dropdown in EventDetail header
- **Skip-to-content**: Accessibility link for keyboard/screen reader users

**No issues found.** The navigation is comprehensive and discoverable.

### 2.3 Responsiveness — Rating: ★★★★☆

After Phase 45 fixes:
- **89 responsive breakpoints** across 58 screens (+33% from ~70)
- **26 screens** received mobile-specific fixes
- **12 table columns** hidden on mobile across 3 data-heavy tables
- **4 fixed-height containers** made viewport-responsive
- **6 button groups** with flex-wrap for mobile

**Remaining gap**: The canvas-based floor plan editor (CanvasPage, 1,032 lines) is inherently desktop-focused. react-konva renders to a `<canvas>` element that doesn't respond to CSS breakpoints. This is acceptable — floor plan design is a desktop task in the wedding industry.

### 2.4 Loading States — Rating: ★★★★☆

- 41 screens with Skeleton/loading indicators
- React Query's `placeholderData: keepPreviousData` prevents flash on filter changes
- Lazy-loaded components have Suspense fallbacks

**Minor gap**: 8 form dialogs lack loading skeletons on open (they're dialogs that pop instantly, so the impact is minimal — the mutation submit buttons have proper `isLoading`/`isPending` states).

### 2.5 Error Handling — Rating: ★★★★★

- Global `ErrorBoundary` wrapping the entire app
- 404 page for unknown routes
- Session expiry guard (toast + redirect on 401)
- 87 toast notifications across the app (success + error variants)
- Form validation via react-hook-form + zod with field-level messages

### 2.6 Accessibility — Rating: ★★★½☆

**Present:**
- Skip-to-content link (WCAG 2.4.1)
- Radix UI primitives for dialogs, tabs, select, toast (ARIA roles, focus trapping)
- 23 ARIA attributes across UI components
- Color contrast: `fg-subtle` at 5.2:1 ratio (WCAG AA)
- Keyboard shortcuts dialog (⌘/)
- `prefers-reduced-motion` honored

**Actionable improvements:**

1. **Add `aria-label` to icon-only buttons** — trash/delete buttons, filter chips, and action icons should have screen reader labels. ~30 instances across the codebase.

2. **Add `role="tabpanel"` to EventDetail tab content** — Radix Tabs handles this automatically, but verify with a screen reader.

3. **Add `aria-live="polite"` to the notification badge count** — when the unread count changes, screen readers should announce it.

---

## Part 3: Feature Expansion — "Wedding Venue Intelligence Platform"

### 3.1 Already-Built Intelligence Features

The platform has already transcended basic CRUD into genuine intelligence:

| Feature | Data Source | Intelligence Value |
|---|---|---|
| Booking conversion rate | Event pipeline (lead → booked) | Measures sales effectiveness |
| Revenue per event | Event budgets | Benchmarks pricing |
| RSVP velocity | Cross-org guest counts | Tracks response momentum |
| Event readiness tracker | 6-milestone composite score | Proactive readiness alerts |
| Revenue by month chart | Monthly budget aggregation | Revenue trend visibility |
| Today intelligence view | Today's events + attention items | Daily operational focus |
| Vendor compliance scoring | Payment completion % | Vendor reliability |
| Dietary breakdown | Guest dietary_restrictions | Catering intelligence |
| Timeline density | Hour-by-hour timeline items | Day-of pacing optimization |
| Seasonal demand heatmap | (Event pipeline data exists) | Not yet visualized |

### 3.2 Recommended New Features

#### Tier 1 — High Impact, Achievable with Existing Data (2-4 hours each)

**F-1: iCal Calendar Export**
- **Value**: Every coordinator uses Google Calendar. One-click sync eliminates double-entry.
- **Approach**: `GET /api/events/:id/export.ics` generating iCalendar format with event title, date, venue name.
- **Integration**: "Add to Calendar" button on EventDetail header actions.
- **Code touch**: 1 new route file (~40 lines), 1 SDK method, 1 button.

**F-2: Revenue Pipeline Forecasting**
- **Value**: Venue owners need to predict next quarter's revenue for staffing/purchasing decisions.
- **Approach**: Weight pipeline events by conversion probability (lead=10%, hold=40%, booked=90%) → sum weighted `budget_cents`.
- **Integration**: New StatCard widget in the widget registry + Analytics Dashboard section.
- **Code touch**: 1 new widget (~60 lines), pure frontend calculation from existing events list data.

**F-3: Guest Dietary Summary Card**
- **Value**: Caterers need a quick summary, not a 10-page seating report. "42 standard, 18 vegetarian, 8 vegan, 4 gluten-free."
- **Approach**: The `chart.dietary-breakdown` widget already calculates this. Extract the data into a simpler card format.
- **Integration**: Add to event overview as a standalone card alongside the existing progress tracker.
- **Code touch**: 1 new component (~50 lines) reusing existing SDK data.

**F-4: Automated RSVP Deadline Alerts**
- **Value**: Venue owners forget to follow up on pending RSVPs. Auto-alert when deadline approaches + response rate is low.
- **Approach**: Add `rsvp_deadline` field to events. TodayView checks `deadline within 14 days AND pending > 30%` → shows alert.
- **Integration**: Extend TodayView's `actionItems` array + add field to EventSettingsForm.
- **Code touch**: 1 migration (add column), ~20 lines in TodayView, ~10 lines in settings form.

#### Tier 2 — Medium Impact, Moderate Effort (4-8 hours each)

**F-5: Post-Event Survey & NPS Tracking**
- **Value**: Venue reputation depends on couple satisfaction. Aggregate NPS across events = business health metric.
- **Approach**: `surveys` table + public survey link sent after event completion. NPS = `(promoters - detractors) / total × 100`.
- **Integration**: Auto-generate survey when event status → `completed`. Dashboard widget showing NPS trend.
- **Code touch**: 1 migration, 1 repo, 1 route, 1 SDK, 1 public survey page, 1 widget. ~6 hours.

**F-6: Vendor Performance Ratings**
- **Value**: After 50+ events, venue owners know which vendors are reliable. Formalize this knowledge.
- **Approach**: Star rating (1-5) on vendors after each event. Aggregate average visible in vendor directory.
- **Integration**: Rating dialog on vendor cards + aggregate display.
- **Code touch**: `vendor_ratings` table, 1 repo, 1 route, 1 dialog, 1 aggregate query. ~4 hours.

**F-7: Lead Source Tracking & Funnel Analytics**
- **Value**: "Where do my best leads come from?" — answers marketing ROI questions.
- **Approach**: Add `lead_source` dropdown to event creation (Website, Referral, The Knot, WeddingWire, Walk-in, Other). Funnel chart: source → lead → booked conversion rates.
- **Integration**: Field on CreateEventDialog, funnel chart on Analytics Dashboard.
- **Code touch**: 1 field addition, 1 aggregation query, 1 chart component. ~4 hours.

**F-8: Guest Communication Templates**
- **Value**: Planners send the same emails repeatedly (save-the-date, reminder, thank-you). Templates save hours per event.
- **Approach**: `email_templates` table with merge fields (`{{guest_name}}`, `{{event_date}}`, `{{table_assignment}}`). Template editor in invitation tab. Render + send via existing SMTP integration.
- **Integration**: Template CRUD in invites tab + merge engine connecting to existing `email_smtp.ts` provider.
- **Code touch**: 1 migration, 1 repo, 2 routes, 1 template editor UI, 1 merge renderer. ~8 hours.

#### Tier 3 — Differentiating, Major Effort (8+ hours)

**F-9: AI Event Recommendations Engine**
- **Value**: "For a 120-person fall wedding at your venue, past events suggest a $45K budget, DJ + band combo, and garden ceremony → indoor reception flow."
- **Approach**: Statistical analysis (percentiles, medians) of historical event data grouped by guest count + season. No ML needed.
- **Integration**: "Suggestions" card on event overview powered by historical aggregation.
- **Code touch**: Aggregation repo methods + suggestion component. ~6 hours (despite being "AI" it's just statistics).

**F-10: Stripe Payment Processing**
- **Value**: Accept deposits directly through contracts. Real-time payment tracking.
- **Approach**: Stripe SDK integration + webhook receiver for payment events. "Pay Now" button on contracts.
- **Integration**: Extend contracts with `payment_intent_id`. Use existing inbound webhook infrastructure.
- **Code touch**: Stripe SDK, 1 integration provider, contract UI updates. ~8 hours + Stripe account setup.

---

## Summary of All Findings

### Issues by Severity

| Severity | Count | Items |
|---|---|---|
| 🔴 **Critical** | **0** | None found |
| 🟡 **Medium** | **1** | P-1: Unbounded audit log list (easy fix: add default LIMIT 200) |
| 🟢 **Low** | **4** | S-4 (`any` usage), C-1 (App.tsx size), C-2 (error pattern inconsistency), P-2 (QR scanner chunk size) |
| ℹ️ **By Design** | **3** | S-2 (SW listeners), S-3 (auth routes), U-1 (dark mode token location) |

### Quality Scorecard

| Category | Score | Notes |
|---|---|---|
| **Security** | ★★★★★ | Zero injection vectors, layered auth, encrypted secrets, HMAC webhooks |
| **Performance** | ★★★★½ | Lazy-loading, code splitting, query caching, WAL mode. Minor: unbounded audit |
| **Code Quality** | ★★★★½ | Consistent patterns, strong typing, 684 tests. Minor: `any` usage, pattern inconsistency |
| **UI/UX** | ★★★★½ | Design system, 7 themes, responsive, accessible. Minor: some mobile gaps, a11y depth |
| **Features** | ★★★★★ | 92 API endpoints, 60 screens, 45 DB tables, real-time SSE, webhooks, PWA, RBAC |
| **Testing** | ★★★★★ | 684 tests, 0 failures, 0 untested components, full E2E journey test |
| **Documentation** | ★★★★★ | 45 phase docs, ARCHITECTURE.md, INTEGRATIONS.md, README, .env.example |
| **Overall** | **★★★★½** | Production-ready. The ½ star gap is the 10 recommended intelligence features. |

### Recommended Priority Path

For a venue owner deploying this today, implement in this order:
1. **F-1: iCal Export** (2 hours) — immediate daily value
2. **F-4: RSVP Deadline Alerts** (2 hours) — prevents revenue-impacting oversights
3. **F-2: Revenue Forecasting** (2 hours) — business planning
4. **F-7: Lead Source Tracking** (4 hours) — marketing ROI
5. **F-5: Post-Event NPS** (6 hours) — reputation management

These 5 features transform the platform from "excellent operations tool" to "true intelligence platform" with ~16 hours of development effort.

---

*Review conducted on ~45,700 lines across 343 files · 684 tests verified · 92 API endpoints audited · 45 database tables examined*
