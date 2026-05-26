# Phase 2 — Front-end Data Access SDK + Dual-Write Hooks — COMPLETE ✅

> Phase 2 delivers the bridge between the Phase 1 backend and the UI we'll
> build in Phases 3-7. Every Phase 1 endpoint is now reachable from React
> via a typed SDK, with a dual-write infrastructure that lets us migrate
> domain by domain without breaking the existing localStorage code paths.

## What Phase 2 delivered

| Deliverable | Status | Notes |
|---|---|---|
| Typed SDK over every Phase 1 endpoint | ✅ | 11 domain modules + 1 transport client |
| TanStack Query wired with sensible defaults | ✅ | Retry, refetch-on-focus, devtools in dev |
| Per-domain feature flag context | ✅ | `local` / `dual` / `server` modes |
| Offline write queue with retry | ✅ | Persists to localStorage; replays on reconnect |
| Dual-write hook factory | ✅ | `makeResourceHooks` for per-domain wiring |
| Sync monitor | ✅ | Live status feed of requests, conflicts, queue |
| Admin Control Panel UI | ✅ | New "System" tab in the dashboard |
| MSW-based SDK tests | ✅ | 62 tests, 83% line coverage |
| CI updated for both server + client | ✅ | GitHub Actions runs both |

**Test totals after Phase 2:**
- Server: **89 tests passing** (from Phase 1.1)
- Client: **62 tests passing** (new in Phase 2)
- Smoke: **11 assertions** end-to-end
- **Total: 162 automated checks** running on every CI build

## File map (new in Phase 2)

```
client/src/
├── sdk/                           # The typed front-end SDK
│   ├── client.ts                  # Low-level fetch + lifecycle events
│   ├── types.ts                   # All API response/request types
│   ├── auth.ts                    # /api/auth/*
│   ├── orgs.ts                    # /api/orgs/*
│   ├── roles.ts                   # /api/orgs/:id/roles/*
│   ├── events.ts                  # /api/events/*
│   ├── venues.ts                  # /api/venues/*
│   ├── catalog.ts                 # /api/orgs/:id/catalog/:kind
│   ├── layouts.ts                 # /api/layouts/*
│   ├── guests.ts                  # /api/guests + /api/portal/*
│   ├── vendors.ts                 # /api/vendors/* + payments
│   ├── timeline.ts                # /api/events/:id/timeline
│   ├── index.ts                   # one-stop import { sdk }
│   ├── sdk.test.ts                # 15 end-to-end tests via MSW
│   └── coverage.test.ts           # 12 per-module sanity tests
├── dual-write/                    # The dual-write infrastructure
│   ├── featureFlags.ts            # per-domain mode storage
│   ├── FeatureFlagsContext.tsx    # React context + hook
│   ├── writeQueue.ts              # offline write queue + executor registry
│   ├── useDualResource.ts         # generic hook factory (3 modes)
│   ├── QueryProvider.tsx          # TanStack Query setup
│   ├── syncMonitor.ts             # aggregates lifecycle events
│   ├── useSyncStatus.ts           # React hook for the monitor
│   ├── featureFlags.test.ts       # 5 tests
│   ├── writeQueue.test.ts         # 9 tests
│   ├── syncMonitor.test.ts        # 4 tests
│   └── useDualResource.test.tsx   # 12 tests (queues + modes)
├── components/
│   ├── ControlPanel.tsx           # NEW - the admin "System" tab
│   └── ControlPanel.test.tsx      # 5 tests
├── test/
│   ├── setup.ts                   # MSW lifecycle, act env flag
│   ├── server.ts                  # MSW server instance
│   └── handlers.ts                # in-memory backend mock (~300 lines)
├── App.tsx                        # Refactored to use SDK + Control Panel tab
├── main.tsx                       # Wires QueryProvider + FlagsProvider + sync
└── vite-env.d.ts                  # Vite type reference
```

## Key design decisions

### Why TanStack Query?
You picked it after considering SWR and plain useState. The decision pays off here because Phase 3+ will need:
- Optimistic updates (showing the new event before the server confirms)
- Background refetch (RSVP list updates when another tab submits one)
- Query invalidation (creating an event invalidates the list cache)
- Stale-while-revalidate (cached read returns instantly, then refreshes)

All of which TQ does in 30 lines per hook vs. ~150 per hook with useState.

### Dual-write modes
Every domain hook reads a feature flag and chooses behavior:
- **`local`** — original POC behavior; localStorage only; no network at all
- **`server`** — server only; localStorage untouched; errors surface immediately
- **`dual`** — server-first read with localStorage fallback on offline; writes go to server with optimistic local mirror; failed writes queue for retry

This lets you migrate one domain at a time:
1. Start with `local` everywhere (existing behavior, no change)
2. Flip a domain to `dual` (start mirroring; existing data still works)
3. Verify the server has the data; flip to `server` (drop localStorage dependency)

Each transition is a feature-flag flip in the Control Panel — no redeploy needed.

### Server-wins conflict resolution (your choice)
When an offline write replays and the server has newer data:
- The write is dropped from the queue
- A `replay-conflict` event fires
- The Control Panel shows it under "Recent Sync Conflicts"
- The user sees the server's data (TQ auto-invalidates)

No silent overwrites either direction. The user is always notified.

### Full offline support (your choice)
Implemented via:
1. **Read fallback**: in `dual` mode, network errors fall back to the cached localStorage copy
2. **Write queue**: in `dual` mode, network errors queue the write for replay
3. **Auto-replay**: when the SDK detects the server is reachable again, the queue drains in order
4. **Conflict handling**: per above

You can disable a guest's laptop wifi mid-edit, keep adding guests, and they'll all sync when you reconnect.

## Try it locally

```bash
cd wedding-app
npm run install:all
npm run migrate && npm run seed
npm run dev:server      # terminal 1
npm run dev:client      # terminal 2
# Open http://localhost:5173/
```

Then:

1. **Log in** as `owner@demo.local` / `wedding123`
2. Click the **"System"** tab at the top
3. **See live status** as you interact with the app:
   - Server reachability dot (green/red)
   - 15 domain rows with their current mode (all `local` by default)
   - Empty write queue
   - Recent requests (every API call appears here)
4. **Toggle a domain** to `dual` — the row updates instantly
5. **Click "All server"** to flip everything (Phase 3+ wires the hooks that actually consume these flags)
6. **Test offline behavior**: open DevTools → Network → Offline. Try to add a guest. See the queue grow. Toggle back online — watch the queue drain in real-time.

## What hasn't moved yet

Phase 2 is the bridge. The bridge is built, but no UI hooks are crossing it yet — that's Phase 3+. Specifically:

- The existing `App.tsx` still uses **direct SDK calls** (not `useDualResource`) because the POC UI is simple enough that going through React Query would be overkill. Phases 3-7 build the production UIs that DO use the dual-write hooks.
- All feature flags default to `local`. Nothing breaks if you leave them there.
- The Control Panel exists but only displays data; the toggle clicks update flag state but the hooks-that-consume-flags arrive in Phase 3.

## Phase 3 preview

Phase 3 rebuilds the **core wedding flow** UIs (auth, events, guests, RSVP) using:
- The Phase 2 SDK as the data layer
- `useDualResource` hooks for each domain
- A real component library (Tailwind 4 already in the POC build)
- The Roles admin tab from the Phase 1.1 RBAC upgrade
- E2E tests with Playwright (one happy-path test per major user flow)

By the end of Phase 3 you'll have a fully usable replacement for the wedding-critical parts of the original app — running on the new backend, with proper RBAC, with sync status visible at all times.

Estimated: 5 working days.
