# Wedding Venue Intelligence Platform

A complete, self-hosted operating system for modern wedding venues. Built with **Fastify + SQLite + React** — deployable on a single $5/mo VPS.

---

## Quick Start

```bash
cd wedding-app
npm run install:all     # install server + client deps
npm run migrate         # apply all database migrations
npm run seed            # create deterministic demo data

# In two terminals:
npm run dev:server      # Fastify on http://localhost:3000
npm run dev:client      # Vite dev server on http://localhost:5173
```

Login: `owner@demo.local` / `wedding123`

---

## What This Platform Does

### For Venue Owners
- **Event Pipeline** — Kanban + table views, 7 status stages (lead → completed), search + filters
- **Guest Management** — RSVP tracking, dietary/accessibility notes, table assignments, CSV import/export, cross-event browser
- **Vendor Directory** — Contract tracking, payment ledgers, preferred vendor badges, QR check-in
- **Budget Tracker** — Line items by category, planned vs actual vs paid, variance analysis
- **Contract Manager** — Draft → sent → signed lifecycle, e-signature capture, PDF print
- **Floor Plan Canvas** — Drag-and-drop tables/chairs/dance floors, guest seat assignment, venue boundary drawing
- **Timeline (Run of Show)** — Day-of schedule, vendor coordination, printable run sheets
- **Staff Operations** — Task management with phases (pre/during/post-event), Kanban drag-and-drop
- **Invitation Builder** — WYSIWYG email designer (3 themes), send tracking, HTML export
- **Analytics Dashboard** — Trailing revenue, 6-month seasonal demand forecast, proactive event health risk alerts, and lead-source ROI funnel charts
- **NPS & Feedback** — Automated post-event Net Promoter Score (NPS) surveys with public landing pages and secure org stats reporting
- **Photo Gallery** — Mood board with category filters, lightbox viewer
- **Feedback & Polls** — Guest voting from the public portal

### For Couples (Public Guest Portal)
- **Themed portal** — automatically styled with the venue's brand (6 presets)
- **Interactive venue map** — see your seat highlighted
- **RSVP form** — meal preference, dietary notes, plus-one
- **Live polls** — vote on centerpiece designs, song choices

### For Vendors
- **Vendor Portal** — see your event timeline, upload COI, answer logistics questionnaires
- **QR Check-In** — tablet-optimized check-in with offline sync via service worker

### Platform Administration
- **RBAC** — 71 permissions across 27 categories, 7 system roles (owner → guest)
- **Team Management** — invite planners/staff by email, assign roles
- **Theme Studio** — 6 curated presets, live preview, per-org branding
- **Audit Log** — chronological record of all actions with user attribution
- **Data Exports** — guests CSV, vendors CSV, financials JSON, full backup
- **Outbound Webhooks** — HMAC-signed HTTP POST to Zapier/Make/custom URLs
- **Push Notifications** — WebPush subscription management
- **Real-Time Updates** — Server-Sent Events with automatic React Query invalidation

---

## Architecture

```
┌────────────────────────────────────────────────────┐
│  React (Vite + TailwindCSS + Radix UI)             │
│  ├── 109 test files, 710 component/unit tests      │
│  ├── PWA with service worker (offline check-ins)   │
│  └── 6 configurable theme presets                  │
├────────────────────────────────────────────────────┤
│  Fastify (Node.js 20+)                             │
│  ├── 92+ RBAC-gated API endpoints                  │
│  ├── 42 test files, 397 integration/unit tests│
│  ├── SSE real-time event stream                    │
│  ├── Outbound webhook dispatcher (HMAC-SHA256)     │
│  └── Job queue + integration framework             │
├────────────────────────────────────────────────────┤
│  SQLite                                            │
│  ├── schema managed by 49 forward-only migrations│
│  ├── Single-file database (full control)           │
│  └── Encrypted integration credentials (AES-GCM)  │
└────────────────────────────────────────────────────┘
```

---

## Database Schema (49 tables)

| Domain | Tables |
|---|---|
| Identity | users, organizations, organization_memberships, event_memberships |
| RBAC | roles, role_permissions |
| Events | events, sub_events |
| Guests | guests, rsvp_submissions, guest_portal_configs, guest_sub_event_invitations |
| Vendors | vendors, vendor_payments, vendor_checkins, vendor_ratings, vendor_scoring |
| Layouts | layouts, layout_versions, venues, catalog_items |
| Decor | decor_items, decor_categories, decor_arrangements, decor_packages |
| Operations | timeline_events, staff_tasks, staff_areas, staff_shifts |
| Finance | budget_items, contracts, payment_links |
| Content | gallery_images, event_questions, event_answers, invite_tracking, email_templates, email_automations, scheduled_emails |
| Messaging | direct_messages |
| Integrations | integrations, integration_events, oauth_states, job_queue |
| Webhooks | webhooks, webhook_deliveries |
| Real-time | push_subscriptions, sse_events |
| Inventory | inventory_items |
| Audit | audit_logs, schema_version |

---

## Test Suite

```
Total: 1,191 automated tests (latest validated suite)

Server:  453 tests across 65 test files (incl. space-conflict, rain-plan,
         retention, and auth-hardening regression suites)
Client:  738 tests across 120 test files (incl. stage-aware tab and space
         conflict utilities), plus Playwright browser gates (axe-core a11y +
         a full owner happy-path e2e) and a bundle-size budget gate

Every screen component has test coverage.
Every API endpoint is RBAC-gated and integration-tested.
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server bind address |
| `JWT_SECRET` | dev default | **Must set in production** |
| `LOG_LEVEL` | `info` | Fastify log level |
| `CORS_ORIGIN` | disabled | Optional allowed CORS origin; same-origin production needs no setting |
| `NODE_ENV` | — | Set to `production` for prod mode |
| `VAPID_PUBLIC_KEY` | — | WebPush VAPID public key |
| `WEDDING_SECRETS_KEY` | — | AES-256-GCM key for integration credentials (required in Docker production) |
| `WEDDING_UPLOADS_PATH` | `server/uploads` | Persistent directory for uploaded images and documents |
| `WEBHOOK_DELIVERY_RETENTION_DAYS` | `90` | Days to retain outbound webhook delivery history |
| `AUDIT_RETENTION_DAYS` | unset | Audit-log retention window; **report-only by default** — set explicitly to enable the daily purge |
| `TRUSTED_PROXIES` | unset | Comma-separated proxy IPs to trust for `X-Forwarded-For` when the app port is directly reachable |

---

## Production Deployment

```bash
# Option A: Docker
docker compose build
docker compose up -d

# Option B: Direct (any VPS with Node 20+)
npm run build
NODE_ENV=production JWT_SECRET=your-secret node server/dist/index.js
```

See [TRIAL.md](./TRIAL.md) for a detailed 20-minute deployment walkthrough.

---

## Development

```bash
npm run dev:server      # Fastify with hot reload
npm run dev:client      # Vite with HMR
npm run test            # Run all tests
npm run typecheck       # TypeScript check (server + client)
npm run build           # Production build
```

---

## 52 Phases of Development

See the `docs/` directory for detailed documentation of every phase:
- Phases 1–3: Foundation (RBAC, SDK, design system)
- Phases 4–8: Core features (layouts, vendors, timeline, chat, budget, calendar)
- Phases 9–13: Advanced features (portal, PWA, contracts, gallery, integrations)
- Phases 14–17: Polish (decor, vendor timeline, notifications, service worker)
- Phases 18–22: Production (real-time SSE, webhooks, themed portal, RBAC UI)
- Phases 23–27: Completeness (check-ins, invites, exports, profile, tests)
- Phases 28–31: Quality (navigation, AppShell, backup, command palette, 640 tests)
- Phases 48–52: Intelligence & Advanced Payments (real payment capture, linear-regression revenue forecasting, weighted vendor reliability scoring, guest identity resolution de-duplication, and proactive event-health risk alerts)
