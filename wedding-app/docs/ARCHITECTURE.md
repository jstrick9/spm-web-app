# Architecture Guide

A technical reference for developers working on the Wedding Venue Intelligence Platform.

---

## Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite | SPA with hash-based routing |
| **Styling** | Tailwind CSS 4 + Radix UI | Design tokens + accessible primitives |
| **State** | TanStack React Query | Server-state cache with real-time invalidation |
| **Backend** | Fastify + TypeScript | REST API with JWT auth |
| **Database** | SQLite (better-sqlite3) | Single-file, zero-config, full SQL |
| **Realtime** | Server-Sent Events (SSE) | Push updates to connected clients |
| **PWA** | Workbox (vite-plugin-pwa) | Offline sync, push notifications, installable |

---

## Directory Structure

```
wedding-app/
├── client/
│   ├── src/
│   │   ├── App.tsx                 # Root component + route table
│   │   ├── main.tsx                # Entry point (providers)
│   │   ├── sw.ts                   # Service worker (background sync)
│   │   ├── config/                 # Theme system + widget registry
│   │   ├── dual-write/             # React Query provider + feature flags
│   │   ├── lib/                    # Hooks (useSSE, usePermission, etc.)
│   │   ├── sdk/                    # Typed API client (26 modules)
│   │   ├── screens/                # Page components (58 screens)
│   │   │   ├── dashboard/          # TodayView
│   │   │   ├── events/             # EventDetail, EventsList, all tabs
│   │   │   ├── guests/             # CrossEventGuestBrowser
│   │   │   ├── vendors/            # VendorDirectory
│   │   │   ├── portal/             # PublicGuestPortal (public, themed)
│   │   │   ├── checkin/            # VendorCheckInApp (tablet QR)
│   │   │   ├── calendar/           # GlobalCalendar
│   │   │   ├── catalog/            # CatalogScreen, VenueBuilder
│   │   │   └── system/             # AdminPanel, AuditLog, Analytics, etc.
│   │   └── ui/                     # 24 base components (Button, Card, etc.)
│   └── vite.config.ts
├── server/
│   ├── src/
│   │   ├── index.ts                # App entry (Fastify setup, 32 route registrations)
│   │   ├── db/
│   │   │   ├── database.ts         # SQLite connection
│   │   │   ├── migrate.ts          # Migration runner
│   │   │   ├── seed.ts             # Demo data (4 events, 28 guests, etc.)
│   │   │   ├── migrations/         # 49 forward-only SQL migration files
│   │   │   └── repos/              # Data access layer (26 repos)
│   │   ├── routes/                 # 33 route files + test files; couple.ts and
│   │   │                         #   guests.ts decomposed into routes/couple/*
│   │   │                         #   and routes/guests/* domain modules
│   │   ├── lib/                    # RBAC, crypto, errors, permissions
│   │   ├── integrations/           # Provider framework (SMTP, registry)
│   │   ├── jobs/                   # Background job worker
│   │   └── webhooks/               # Outbound webhook dispatcher
│   └── tsconfig.json
├── deploy/                          # Caddy config for production
├── docs/                            # 82 phase documentation files
├── Dockerfile                       # Multi-stage Docker build
├── docker-compose.yml
├── .env.example                     # Environment variable reference
└── README.md                        # Platform overview
```

---

## Key Design Decisions

### 1. RBAC: DB-backed, code-defined catalog
- 75 permission IDs defined as a TypeScript union in `lib/permissions.ts`
- 7 system roles with pre-defined grants (owner → guest)
- Custom roles created at runtime via the admin API
- Permission check: `can(memberships, scope, permissionId)`
- Every route handler calls `can()` or `assertCan()` before any data access

### 2. Real-time: SSE over WebSockets
- Simpler than WebSockets (no library needed, built into browsers)
- `broadcastSSE()` called from mutation route handlers
- `useRealtimeInvalidation` hook auto-invalidates React Query caches
- Custom DOM event bridge feeds the NotificationCenter

### 3. Offline: Service Worker with Background Sync
- `sw.ts` uses Workbox's `BackgroundSyncPlugin`
- Vendor check-ins and staff task updates queued when offline
- Auto-replayed when connectivity returns (up to 24 hours)

### 4. Theming: CSS custom properties + config cascade
- 6 curated presets (Aubergine, Coastal Navy, Garden Sage, Modern Onyx, Blush Rose, Industrial Slate)
- 4-layer cascade: system defaults → org config → event config → user preferences
- Public guest portal reads theme from portal info endpoint (no auth needed)

### 5. Bundle: Code-split heavy dependencies
- react-konva (floor plans): lazy-loaded on Layout tab
- html5-qrcode (QR scanner): lazy-loaded on check-in page
- recharts (charts): lazy-loaded on Analytics page
- 11 code-split chunks, 336 KB main bundle (gzipped)

---

## Data Flow

```
User Action → React Component → SDK method → HTTP fetch
                                                  ↓
                                            Fastify Route
                                                  ↓
                                    requireAuth → can() RBAC check
                                                  ↓
                                            Repo (SQLite)
                                                  ↓
                                          broadcastSSE()
                                          broadcastWebhook()
                                          auditRepo.log()
                                                  ↓
                                     Response → React Query cache
                                                  ↓
                                          SSE → useRealtimeInvalidation
                                                  ↓
                                          Auto-refetch → UI updates
```

---

## Testing Strategy

| Type | Count | Tool | Coverage |
|---|---|---|---|
| Server integration | 450+ | Vitest + Fastify inject | Every CRUD lifecycle, auth, RBAC, portal flow, E2E journey, space-conflict guard, rain-plan, retention |
| Client component | 740+ | Vitest + Testing Library | Every screen, dialog, form, toolbar, widget |
| Browser (Playwright) | 3+ | axe-core + happy-path e2e | Public-surface WCAG A/AA + owner login → create-event journey |
| **Total** | **1,200+** | | 0 failures, 0 untested components |

---

## Adding a New Feature (checklist)

1. **Migration**: `server/src/db/migrations/NNNN_name.sql`
2. **Repo**: `server/src/db/repos/feature.ts` → export from `index.ts`
3. **Routes**: `server/src/routes/feature.ts` → register in `index.ts`
4. **RBAC**: Add permission IDs to `lib/permissions.ts` → add to role grants
5. **SDK**: `client/src/sdk/feature.ts` → export from `index.ts`
6. **Screen**: `client/src/screens/feature/FeatureScreen.tsx`
7. **Route**: Add to `App.tsx` route table + command palette
8. **Tests**: Server integration + client component tests
9. **Docs**: `docs/PHASE-XX-DAY-Y.md`


### 6. Timestamps

Application code writes ISO-8601 UTC (`YYYY-MM-DDTHH:MM:SS.sssZ` via `lib/time.ts`'s `nowIso()`). SQLite `datetime('now')` is reserved for column defaults inside migrations. Never compare the two formats as strings.
