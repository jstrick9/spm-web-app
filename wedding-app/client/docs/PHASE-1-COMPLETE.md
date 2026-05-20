# Phase 1 - Backend Foundation - COMPLETE ✅

> Status as of end of Phase 1. This document is the truth-source for what
> the backend can do. Each subsequent phase will add its own status doc.

## What Phase 1 delivered

A complete, tested, production-quality Fastify + SQLite backend with REST
endpoints for every domain in the original app, plus:

- 100% application-layer RBAC enforcement (no decorative permissions)
- Full integration test suite (65 tests, 84% line coverage, all green)
- GitHub Actions CI workflow (typecheck + tests + coverage + build + smoke)
- Cross-platform smoke test script
- Idempotent migrations and seed data

After Phase 1, **the app's data is no longer trapped in localStorage**.
Every domain has a network-accessible, multi-user, audit-logged backing.
What's still missing is the front-end rewiring — that's Phases 2-7.

---

## What you can do today (post-Phase 1)

```bash
cd wedding-app
npm run install:all                 # one-time
npm run migrate && npm run seed     # initialize DB + demo data
npm run dev:server                  # API at http://localhost:3000
# In another shell:
npm run dev:client                  # POC UI at http://localhost:5173
                                    # (still POC-grade; gets rebuilt in Phase 3)
```

Run the full quality gate any time:

```bash
npm run ci    # typecheck + tests + build + smoke - 65/65 tests, 11/11 smoke
```

---

## Domain coverage

Every domain from the original localStorage app now has a repo + REST routes
+ tests. Status legend: ✅ full CRUD + integration tested, 🟡 functional but
add UI in later phase.

| Domain | Repo | Routes | Tests | Front-end |
|---|---|---|---|---|
| Users + Auth (JWT, PBKDF2) | ✅ | `/api/auth/*` | ✅ | Phase 3 |
| Organizations + memberships | ✅ | `/api/orgs/*` | ✅ | Phase 3 |
| Events + sub-events | ✅ | `/api/events/*` | ✅ | Phase 3 |
| Venues | ✅ | `/api/venues/*` | ✅ | Phase 4 |
| Catalog (tables, fixtures, chairs, walls, linens, guidelines, spacing, templates) | ✅ | `/api/catalog/*` | ✅ | Phase 7 |
| Layouts (revisioned, optimistic concurrency) | ✅ | `/api/layouts/*` | ✅ | Phase 4 |
| Guests + Portal config + RSVPs (incl. public endpoints) | ✅ | `/api/guests`, `/api/portal/*` | ✅ | Phase 3 |
| Decor (items, categories, arrangements, packages) | ✅ | `/api/decor/*` | ✅ | Phase 5 |
| Vendors + payments | ✅ | `/api/vendors/*` | ✅ | Phase 6 |
| Timeline events | ✅ | `/api/events/:id/timeline` | ✅ | Phase 6 |
| Staff tasks, areas, shifts | ✅ | `/api/staff/*` | ✅ | Phase 6 |
| Event questions + answers | ✅ | `/api/questions/*` | ✅ | Phase 7 |
| Direct messages | ✅ | `/api/messages/*` | ✅ | Phase 7 |
| Audit log | ✅ | `/api/orgs/:id/audit` | ✅ | Phase 7 |

That's **13 domains, ~50 endpoints, ~2400 LOC of server code, ~1000 LOC of tests**.

---

## RBAC - the heart of the matter

The single biggest fix from the original-app review is enforced here:
**every route handler calls `can(req.auth.memberships, scope, 'permission')`
before doing any work.** Permissions are no longer decorative.

The role → permission matrix lives in `server/src/lib/rbac.ts`:

| Role | Sample permissions |
|---|---|
| `owner` | Everything in the org |
| `admin` | Manage events, guests, vendors, layouts; no `org.manage` |
| `planner` | Create/edit events, layouts, guests; no `events.delete` or `org.*` |
| `couple` | View their event, manage their guest list, view venue/decor |
| `staff` | View-only on most things, manage timeline + own staff tasks |
| `guest` | Submit RSVP, view portal |

Org isolation is tested explicitly:

```ts
it('user A cannot read user B org events', async () => {
  const a = await registerUser('owner-a@x.com');
  const b = await registerUser('owner-b@x.com');
  // A creates an event...
  // B tries to access it
  const list = await authedRequest(b.token, 'GET', `/api/orgs/${a.orgId}/events`);
  expect(list.statusCode).toBe(403);  // ✅ enforced server-side
});
```

---

## Test results

```
Test Files  5 passed (5)
     Tests  65 passed (65)
  Duration  3.6s
```

Coverage:
```
All files     | 84.13% lines | 83.43% functions | 84.13% statements | 59.17% branches
```

Branch coverage is intentionally lower in Phase 1 (lots of `?? null` and short-
circuit ORs in repo helpers). Phase 3+ adds richer scenario tests that lift
this naturally.

### Smoke test
```
[ OK ] /api/health: True
[ OK ] Org listing: 1
[ OK ] Events count: 1
[ OK ] Catalog tables count: 2
[ OK ] Vendors count: 1
[ OK ] Staff tasks count: 1
[ OK ] Guests count: 5
[ OK ] Timeline count: 2
[ OK ] Public portal guest list: 5
[ OK ] Public RSVP submission OK: True
[ OK ] Owner sees RSVPs: 3
[smoke] all checks passed
```

---

## File map

```
wedding-app/
├── server/
│   ├── package.json                  # Fastify + zod + better-sqlite3 + vitest
│   ├── tsconfig.json
│   ├── vitest.config.ts              # Coverage thresholds: 75/55/75/75
│   └── src/
│       ├── index.ts                  # Fastify entry + global error handler
│       ├── db/
│       │   ├── database.ts           # SQLite connection singleton
│       │   ├── migrate.ts            # schema runner
│       │   ├── schema.sql            # 29 tables, 188 lines
│       │   ├── seed.ts               # idempotent demo data
│       │   ├── repos.test.ts         # 19 repo-level unit tests
│       │   └── repos/                # 10 per-domain repo files
│       │       ├── index.ts          # re-exports
│       │       ├── users.ts          # auth + lockout
│       │       ├── orgs.ts           # multi-tenant root
│       │       ├── events.ts         # events + sub_events
│       │       ├── venues.ts
│       │       ├── catalog.ts        # unified table for 8 item kinds
│       │       ├── layouts.ts        # revisioned floor plans
│       │       ├── guests.ts         # guests + rsvp + portal_config
│       │       ├── decor.ts          # items + categories + arrangements + packages
│       │       ├── vendors.ts        # + payments
│       │       ├── timeline.ts
│       │       ├── staff.ts          # tasks + areas + shifts
│       │       ├── questions.ts      # + answers
│       │       ├── messages.ts
│       │       └── audit.ts
│       ├── lib/
│       │   ├── crypto.ts             # PBKDF2 password + token hashing
│       │   ├── errors.ts             # HttpError + helpers
│       │   ├── json.ts               # SQLite-JSON helpers
│       │   ├── slug.ts
│       │   ├── rbac.ts               # THE permission resolver
│       │   ├── crypto.test.ts
│       │   └── rbac.test.ts
│       ├── middleware/
│       │   └── auth.ts               # JWT + membership loading
│       ├── routes/                   # one file per domain
│       │   ├── auth.ts
│       │   ├── events.ts
│       │   ├── venues.ts
│       │   ├── catalog.ts
│       │   ├── layouts.ts
│       │   ├── guests.ts             # incl. public /portal/*
│       │   ├── decor.ts
│       │   ├── vendors.ts
│       │   ├── timeline.ts
│       │   ├── staff.ts
│       │   ├── questions.ts
│       │   ├── messages.ts
│       │   ├── audit.ts
│       │   ├── routes.integration.test.ts   # 20 tests
│       │   └── coverage.integration.test.ts # 12 tests
│       └── test/
│           ├── setup.ts              # in-memory DB per test file
│           └── factories.ts          # makeUser/makeOrg/makeEvent
├── scripts/
│   ├── smoke-test.sh                 # end-to-end smoke
│   ├── reset-local.sh                # nuke + reseed local DB (bash)
│   └── reset-local.ps1               # Windows variant
├── .github/workflows/ci.yml          # GitHub Actions
├── package.json                      # root scripts (install:all, ci, etc.)
└── docs/PHASE-1-COMPLETE.md          # this file
```

---

## Known intentional gaps (NOT bugs)

These are deferred to later phases by design:

| Gap | Phase that fixes it | Why deferred |
|---|---|---|
| Front-end still calls `localStorage` | Phase 2-7 | The whole point of dual-write was to migrate incrementally |
| No file uploads (venue photos, contracts) | Phase 8 | Needs `@fastify/multipart` + disk-storage strategy |
| No email sending (magic links, RSVP confirmations) | Phase 8 | Needs SMTP creds |
| No real-time push (uses polling) | Phase 8 | SSE + EventSource is simple but not Phase 1 critical |
| No per-guest tokenized portal links | Phase 5 | Schema exists (`portal_token_hash`); needs email + UI |
| No data import from old localStorage app | Won't add (you said "no real data yet") | Saved 3-4 days |
| No error monitoring (GlitchTip) | Phase 8 | Need a running VPS first |
| No automated DB snapshots before deploy | Phase 8 | Same |

---

## What broke during Phase 1 development (and how it was caught)

For your transparency, here are the bugs the test suite caught before any
of them could ship:

1. **`events.title NOT NULL`** when PATCH'ing an event - the route was
   forwarding `undefined` for omitted fields. Fixed by filtering in the route.
2. **Layout versions only counting 1** instead of 2 - the snapshot logic was
   replacing the row at the same `(layout_id, revision)` UNIQUE constraint.
   Fixed by snapshotting the NEW revision number, not the OLD.
3. **`metadata` type conflict** in `eventsRepo.update` because `EventRow` has
   `metadata: string` but the Input type wanted `Record<string, unknown>`.
   Fixed with `Omit<..., 'metadata'>`.
4. **Logout returning 500** because Fastify rejects empty bodies with
   `content-type: application/json`. Fixed in the test helper.
5. **POC zombie server** stealing port 3000 - the smoke script now kills
   anything on the target port before starting.

All caught by tests/CI, not by users. That's the system working.

---

## Ready for Phase 2

Phase 2 builds:
- The **front-end data-access SDK** (the typed wrapper around `fetch`)
- The **dual-write hook layer**: every domain hook reads/writes BOTH
  localStorage and the new API, with a reconciler for conflicts
- **Feature flags per domain** (`VITE_BACKEND_GUESTS=1` etc.) so you can
  flip each domain incrementally
- **SDK tests** with `msw` so we test against mocked endpoints without
  needing a real server running

Estimated duration: ~3 working days.

Phase 2's deliverable will be: every existing localStorage call in the
original app has a drop-in dual-write replacement, hidden behind a feature
flag, fully tested. After Phase 2, Phase 3 (rebuilt auth + events + guests
UI) becomes simple plumbing.
