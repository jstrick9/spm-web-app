# Deep Review — Wedding Venue Intelligence Platform (`spm-web-app`)

**Reviewer:** Full-stack expert (wedding venue operations + web application development)
**Date:** 2026-08-03
**Branches reviewed:** `main` (655 commits, HEAD `ff3f958`); `develop`/`staging`/`feature/fixes_web_app` compared for drift
**Method:** Full read of all 645 tracked files (~103k lines of TypeScript/SQL), plus independent verification: server typecheck, client typecheck, full test suites, and a production build, all executed from a clean clone.

---

## 0. Verified validation baseline (run on 2026-08-03, clean clone)

| Check | Command | Result |
|---|---|---|
| Server typecheck | `tsc --noEmit` (server) | ✅ 0 errors |
| Client typecheck | `tsc --noEmit` (client) | ✅ 0 errors |
| Server tests | `vitest run` (server) | ✅ 62 files, **433/433 passing** |
| Client tests | `vitest run` (client) | ✅ 118 files, **731/731 passing** |
| Production build | `vite build` | ✅ Built in ~15s, PWA service worker generated (79 precache entries, ~3.4 MB) |

**Total: 1,164 automated tests passing, both typechecks clean, production bundle builds.** The project's own docs understate this baseline: README claims 1,107 tests / 42 server files / 109 client files; ARCHITECTURE_CLOSEOUT claims 46/408 + 112/714. Actual is 62/433 + 118/731. (Docs drift — see Finding R-1.)

---

## 1. Executive summary

This is a genuinely impressive, unusually complete single-tenant/multi-tenant-capable wedding venue operating system. It is not a demo: it has a real event pipeline (lead → hold → booked → planning → final review → event week → completed), first-class venue-space scaffolding with CAD-lite underlays (PNG/JPEG/PDF/SVG/DXF), template galleries, inventory with event-scoped reservations, layout approval workflows with reopen requests, run-of-show/run sheets, staff shifts with clock-in, vendor portals with COI gate passes and QR check-in, a full couple workspace, a tokenized public guest portal with RSVP + dietary/allergy escalation, contracts + e-signature + real Stripe/Square hosted payments, revenue forecasting, event-health risk scoring, webhooks, SSE real-time, a PWA with offline write queue, a 110+-permission RBAC system, audit logging, and a documented ops runbook. All of it ships with 1,164 passing tests and a green build.

**Verdict: production-capable for a single venue with engineering supervision; product-wise it is ahead of its own navigation/information architecture.** The largest issues are not correctness — the code is unusually disciplined — they are (a) permission-catalog/enforcement drift, (b) giant monolith files, (c) documentation and branch-process drift, and (d) the known gap between the Seven Paths Manor blueprint (which is excellent) and the current all-modules-everywhere UX.

**No Critical findings.** This is rare and worth saying plainly: authentication, RBAC, public-portal abuse controls, upload handling, webhook SSRF guards, and destructive-action protections all held up under review, and the security-critical fixes recorded in `PLATFORM_ADMIN_PORTAL_REVIEW.md` are real (verified in code).

---

## 2. Product surface map (what is actually built)

| Surface | Where | Notable capabilities |
|---|---|---|
| Venue staff dashboard | `screens/dashboard/` | Today view, staffing calendar, venue-space month grid, capacity-overrun flags, readiness |
| Event pipeline | `routes/events.ts`, `screens/events/` | 8 statuses, Kanban/table, duplicate-as-template, final-review readiness gate |
| Event workspace | `EventDetail.tsx` + 20+ tabs | Overview, guests, invites, feedback, timeline, layout, vendors, budget, contracts, gallery, staff, chat, portal, settings, emergency |
| Venue Studio | `routes/venues.ts`, `catalog/`, `VenueBuilder`, `VenueSpaceScaffoldWizard` | Guided scaffolds, templates, units (imperial/metric), underlays, calibration, SVG/DXF import, revisions, approval, operational zones |
| Layouts | `routes/layouts.ts`, `CanvasPage.tsx`, `layoutOpsModel.ts` | Event layouts from approved scaffolds, object palette, setup groups, inventory reservations, review/approve, setup packets, collaboration |
| Inventory | `inventory.ts`, `InventoryManager` | Specs, condition, owner/vendor-rental, reservations with deletion protection |
| Guests | `routes/guests.ts`, `couple.ts` | Couple-owned CRUD, CSV import/export, dietary/accessibility, lodging, seating, guest identity dedupe/merge, venue read-only manifest |
| Public guest portal | `PublicGuestPortal`, `GuestRsvpWizard` | Tokenized links, honeypots, rate limits, password-verified portal, maps/wayfinding, itinerary, polls, help requests with SLA |
| Vendors | `VendorPortal`, `VendorCheckInApp` | COI upload w/ gate-pass, questionnaires, logistics, payments, QR check-in, offline sync |
| Couple hub | `CoupleEventHub` + advanced planning | Guest list, decisions, design preferences + venue review, documents, finance view (client-safe), timeline change requests, appointments, post-event closeout, NPS |
| Platform admin | `AdminPanel`, `PlatformStudio`, `AuditLog`, `TeamMembers` | Roles/permissions editor, theme studio (6+1 presets), config, change-request queue, diagnostics |
| Intelligence | `intelligence.ts`, `forecast.ts`, `risk.ts`, `recommendations.ts` | Explainable linear-trend + seasonal-index forecast, health scores, lead-source ROI |
| Integrations | `integrations/` registry + providers | SMTP, Twilio, Stripe, Square; AES-GCM secrets; job queue; lifecycle emails |
| Realtime/PWA | SSE + Workbox | 2s polling-based SSE w/ catch-up, background-sync offline queue, push subs |

---

## 3. Domain assessment — through a wedding-venue-operations lens

### 3.1 What is done right (genuinely, not flattery)

1. **The venue-space scaffold → event-layout boundary is the correct core model.** Venue-owned structure (walls, doors, exits, utilities, zones, underlays, capacity, approval status) is kept revisioned and separate from event-owned proposals. Instantiation from approved scaffolds only, with `venueRevision` recorded on every event layout, is exactly how a real venue protects its operational truth. Very few products get this right.

2. **Final-review readiness gate is real wedding ops.** Moving an event into final review requires: approved layout, confirmed guest count, reviewed timeline, vendor assignments, staffing readiness, setup packet, inventory readiness, accessibility checks, rain-plan checks. That mirrors the actual pre-wedding checklist a venue manager runs. The `finalReviewReadiness` function in `routes/events.ts` is domain-accurate.

3. **Dietary/allergy handling with escalation.** RSVP submissions auto-create a `guest_help_requests` row with a 1-day SLA when a guest reports a severe allergy or requests cross-contamination handling, and the catering/dietary CSV export joins the latest RSVP per guest. This is the kind of detail that wins venues over.

4. **Inventory reservations are event-scoped and release on layout change** (migration 0041), and recent commits (0fb8a74) correctly block deletion of inventory items with active reservations and venue spaces with linked layouts. Quantities-as-commitments is the right mental model for shared venue assets (200 Chiavari chairs across three Saturday weddings).

5. **Vendor lifecycle is venue-real**: preferred status, contract/COI tracking, load-in timing, QR check-in, vendor scoring/ratings, and a vendor portal with a guided tour and gate-pass workflow.

6. **Post-event closeout exists** (lost items, NPS, public testimonials, review-queue follow-up, anniversary opt-in). Most competitors stop at the wedding day.

7. **Client-safe couple finance view**: contracts/payments shown to couples with explicit "internal budgets, vendor margins, revenue forecasts are hidden" labeling. Deliberate and correct.

### 3.2 Gaps and risks vs. the blueprint and real venue practice

1. **No hard space double-booking prevention.** Events carry a `venue_id`, and the space calendar flags capacity overruns, but nothing rejects or even warns (with override) when two *overlapping* events are assigned the *same approved space*. For a venue, "Grand Ballroom booked twice on 9/12" is the worst failure mode. Recommendation: conflict detection on event create/update/venue-assign; soft block with explicit override reason + audit; conflict visibility on the space calendar (not just capacity).
   *Severity: High (domain integrity).*

2. **Permission catalog contradicts enforcement on guest ownership.** The blueprint says couples own guest mutation; the code enforces that correctly in routes (`requireCoupleGuestManager` in `routes/guests.ts`), **but** the `manager` and `planner` system roles still carry `guests.manage`, `guests.assign`, `guests.import`, `guests.export` in `lib/permissions.ts`. Result: role editors see these grants, UI may render guest-edit affordances that 403 at runtime, and a future custom role built "by copying manager" silently gets a meaningless grant. Either strip those grants from venue roles or make the couple-only rule a documented permission (`guests.couple.manage`).
   *Severity: High (authorization-model drift).*

3. **Event tabs are permission-driven but not stage-driven.** The blueprint's core promise — tabs change by event stage (sales → planning → event week) — is only partially realized (final-review stage has some conditional UI). A lead and an event-week wedding currently present the same tab set to staff. This is the single biggest UX-vs-blueprint gap.
   *Severity: Medium (product).*

4. **Navigation still surfaces generic system modules to normal users** (Catalog Studio, Questions Studio, Platform Studio, Intelligence, Health Command Center, Integration Hub, Email Automation, cross-event guest browser). The blueprint explicitly recommends hiding/reframing these. They work and are owner-gated by permission, but the IA is "software catalog," not "venue operating system."
   *Severity: Medium (product).*

5. **Terminology drift:** "Catalog Studio," "Venue Builder," "Platform Studio," "objects," "catalog items" — the blueprint's terminology layer hasn't landed.
   *Severity: Low-Medium.*

6. **Weather/rain-plan handling is flag-based metadata** (`rainPlanRequired`/`rainPlanChecked`) without a linked alternate-space workflow (e.g., "Outdoor Lawn → Rain Plan Ballroom" mapping). Venues run this constantly; the blueprint lists it; it's currently a checkbox.
   *Severity: Medium (domain).*

7. **Event duplication copies metadata but not guests/vendors/layouts** — acceptable for a "copy as template" feature, but the UI should say so (it duplicates only the shell).

8. **Minor domain polish gaps:** no ceremony→cocktail→reception property-map yet; no deposit-reminder automation on payment links (lifecycle emails cover RSVP/thank-you only); guest seating has no auto-seat suggestions; `sub_events` exist but the property map would make them sing.

---

## 4. Architecture review

### Strengths
- **Clean layering**: routes (Fastify) → repos (better-sqlite3) → SDK (typed client) → screens. The "adding a feature" checklist in ARCHITECTURE.md is accurate and followed in practice.
- **RBAC design is right**: permission catalog in code (type-safe union, compile-time typo detection), grants in DB, system roles re-synced on boot (`ensureSystemRoles`), per-role cache with invalidation. Scope resolution handles org→event membership mapping correctly (org members acting on events, event members seeing org data via `eventOrgMap`).
- **SSE over WebSockets with a 5-minute dedicated SSE token** fetched separately — a genuinely good design decision: the main JWT never appears in a URL query string (which would leak into proxy/access logs).
- **Offline strategy is layered**: Workbox background sync for check-ins/task updates + a client-side persistent write queue with conflict classification (`conflict` → revert optimistic state; `unauthorized` → drop; `server` → retry with backoff). Serious engineering.
- **Code splitting works**: main bundle 195 KB (gzip 53.5 KB); konva, QR scanner, PDF, recharts split into lazy chunks (verified in build output).
- **Explainable intelligence**: least-squares trend × seasonal index with confidence labels, no fake ML, honest about thin history. Refreshing.

### Concerns
- **Single-process fanout limits scale** (SSE in-memory registry, in-process worker). Documented and accepted in ARCHITECTURE_CLOSEOUT; SQLite WAL is fine for single-node. Correct boundary, but it must be respected: no multi-replica deployment without moving SSE/worker/DB.
- **`trustProxy: true` with no `app.proxy` ip-allowlist**: Fastify trusts all proxy headers. Behind Caddy this is fine; if the port is ever exposed directly, clients can spoof `X-Forwarded-For` into audit logs. Restrict to the proxy IP(s).
- **JWT in `localStorage`** (not httpOnly cookie): standard SPA tradeoff, mitigated by CSP `script-src 'self'`; worth documenting as accepted risk (XSS = token theft).
- **Two API clients exist** (`sdk/client.ts` — live; `lib/api.ts` — dead, different token key `wedding-poc-jwt`). Dead code should be deleted; a future refactor could accidentally use the wrong token key (finding C-1).

---

## 5. Data model review

- 48 forward-only migrations, ~96 `CREATE TABLE` statements in current schema; runner is transactional with `IF NOT EXISTS` discipline and an explicit FK-pause path for table rebuilds. Good.
- **`schema.sql` (967 lines) is a stale Phase-1 snapshot that contradicts migrations** — e.g., it defines `organization_memberships.role` with a `CHECK (role IN ('owner','admin','planner','staff'))` while migrations 0001+ define `role_id REFERENCES roles(id)` and 8 system roles. Only `migrations/` is actually executed (verified in `migrate.ts`), so this file is a trap for anyone reading the repo to understand the schema.
  *Severity: Medium (maintainability). Fix: delete or clearly mark as historical; make `migrate.ts`'s source the single truth.*
- **JSON-in-TEXT is used heavily** (event `metadata`, venue `master_layout`, `underlay`, `payload` on layouts, `config` on portal configs). Acceptable for a single-node SQLite app and consistent with the "flexibility first" convention, but it means: no SQL-level integrity on those fields, parse-on-every-read cost, and version-skew risk (old payloads may not parse with new code). Recommend: (a) zod-parse on repo read for the hot ones (layout payload, venue master_layout), (b) a payload `version` field on layouts now, before real venues accumulate data.
- IDs are UUIDs generated in Node — fine. Timestamps are TEXT ISO-8601 — fine for SQLite, but comparisons rely on consistent formatting; the code mixes `datetime('now')` (UTC, `YYYY-MM-DD HH:MM:SS`) and JS `new Date().toISOString()` (`YYYY-MM-DDTHH:MM:SS.sssZ`) — string comparisons between the two formats are incorrect (`'T' > ' '`). Mostly used in display/order contexts, but `WHERE created_at <= ?` filters mixing formats could silently misbehave. Standardize on one format.
  *Severity: Low-Medium (correctness trap).*
- Migrations 0045–0048 show continued additive growth; good discipline. `event_communication_audit_logs` + `event_broadcast_recipients` suggest a broadcast engine is mid-flight — fine.

---

## 6. Security review

**Overall: strong, defense-in-depth, with real domain-aware abuse controls. No critical findings.**

| # | Area | Finding | Severity |
|---|---|---|---|
| S-1 | Auth | Login: rate-limited (10/min), anti-timing dummy hash for unknown users, account lockout with `locked_until`, session_version invalidation in JWT, audit on success/failure. Registration: couple role requires invitation; invite email must match. Password reset/magic-link tokens are hashed with per-token salt (PBKDF2), expire, and are single-use. Excellent. | ✅ Pass |
| S-2 | RBAC | `requireAuth` reloads user + memberships from DB per request (no stale-token membership), checks `status='active'`, `session_version`. Role-assignment protections verified in `routes/roles.ts` (owner immutable, owner/admin grant restricted, reserved keys blocked). | ✅ Pass |
| S-3 | Public portal | Tokenized guest links (hashed at rest, per-guest), RSVP edits require portal token, honeypot fields, per-endpoint rate limits 5–120/min, device fingerprints, abuse audit trail, guest-help SLA tracking. Severe-allergy auto-escalation. | ✅ Pass |
| S-4 | Uploads | Public/private namespaces; **SVG explicitly excluded**; 8 MB decode limit; type allowlists; private asset serving through capability tokens (assets route + asset_access migration). | ✅ Pass |
| S-5 | Webhooks | Outbound: HMAC-SHA256, SSRF guard (DNS resolution checked against private/loopback/link-local ranges), concurrency cap (5), classified retries w/ backoff, durable delivery records, retention. Inbound: HMAC verify. | ✅ Pass (minor: S-9) |
| S-6 | Headers | CSP (`script-src 'self'`, no inline script), HSTS in production, nosniff, frame DENY, Referrer-Policy, `object-src 'none'`. Good hand-rolled baseline. | ✅ Pass |
| S-7 | Secrets | Integration credentials AES-256-GCM with `WEDDING_SECRETS_KEY`; `JWT_SECRET` startup guard in production; docker-compose fails hard if secrets missing. | ✅ Pass |
| S-8 | Rate limits | Global 300/min + route-level limits on every public surface. | ✅ Pass |
| S-9 | Inbound webhook signature compare | `signature !== expected` — plain string compare, not `timingSafeEqual`. On a local network this is not exploitable in practice, but it's a one-line hardening. | Low |
| S-10 | Password hashing | PBKDF2-SHA256 at 120k iterations — functional but below current OWASP guidance (~600k for PBKDF2). The comment explains it matches legacy interchange; recommend raising iterations on the next password-update event (or a gradual rehash-on-login) once legacy interop is no longer needed. | Low-Medium |
| S-11 | SSE token in query string | Deliberately mitigated with a 5-minute short-lived dedicated token. Residual: appears in server logs if `disableRequestLogging` is off. Acceptable; note it. | Low |
| S-12 | Audit log growth | Every action writes an audit row with no deletion workflow (report-only retention decision documented). At venue scale (hundreds of events, thousands of guest actions) this table grows fast; the Retention UI correctly discloses report-only mode. Schedule the retention job or archive. | Medium (ops) |

---

## 7. Backend code review

### Strengths
- Route handlers consistently: parse (zod) → scope-check (can/assertCan) → repo → audit → SSE → respond. The pattern is recognizable in every file.
- Repos encapsulate SQL well; parameterized queries everywhere (no string-concatenated SQL found; the one dynamic `IN (...)` builder is parameterized).
- Error handling is uniform (`HttpError`, decorated errors, zod → 400).
- `jobs/worker.ts` + `jobsRepo` provide a durable in-process queue with idempotency keys on scheduled emails.
- Domain safety guards added in recent commits are the right shape (venue-space deletion blocked while layouts exist; inventory deletion blocked while reserved).

### Concerns
- **Monolith route files**: `routes/couple.ts` is 2,190 lines with ~60 endpoints and 20+ repo imports; `routes/guests.ts` is 1,589. The ARCHITECTURE_CLOSEOUT backlog already names the client-side decomposition; the server needs the same. `couple.ts` alone is a merge-conflict magnet and a review bottleneck.
- **Two authorization styles coexist**: the permission catalog (`can(...)`) in most routes, but raw `roleKey` string checks in several (`/api/events/:eventId/stage` requires `owner|manager`; final-review change decision checks `owner|manager`; day-of-contact GET is couple-role-checked). Role-key checks silently bypass custom roles and make the permission model untrustworthy as the single source of truth. Convert to permissions (e.g., `events.stage.transition`, `events.final_review.decide`) or to explicit capability checks.
- **`finalReviewReadiness` and similar inline-SQL helper blocks** live inside route files rather than repos; fine now, but they're where business logic drifts.
- Route bodies use `any` in many places (`req.auth!.memberships` typed loosely, `(row as any)`), which erodes the typecheck's value at the exact boundary that matters. The codebase is 95% typed; tightening these is cheap.
- No request-level JSON schema (Fastify `schema`) for most routes — zod-parsing manually is fine and consistent, but fastify-native schemas would add serialization-speed and OpenAPI generation for free later.

---

## 8. Frontend code review

### Strengths
- Typed SDK surface (`sdk/`, 30 modules) with a single transport (`client.ts`) that classifies errors and emits lifecycle events — the kind of foundation that keeps 731 tests stable.
- Hash router is pragmatic and well-tested; lazy-loading of every screen keeps the shell lean.
- Theme system: CSS custom properties + 4-layer cascade + 7 presets incl. "Seven Paths Manor" — the config schema + resolver have their own tests.
- Accessibility care: axe-core gates on public surfaces, `useReducedMotion`, focus-visible styling, Radix primitives, mobile visual snapshot tests with real device viewports.
- `ReloadPrompt` + service-worker version management for PWA updates is handled.

### Concerns
- **Monolith screens**: `CatalogScreen.tsx` (2,962 lines), `CanvasPage.tsx` (2,872), `DashboardScreen.tsx` (2,510), `EventDetail.tsx` (1,966), `GuestPortalSettingsTab.tsx` (1,695), `EventStaffTab.tsx` (1,387), `EventVendorsTab.tsx` (1,346), `AdminPanel.tsx` (1,121). The repo's own closeout doc names the first few; this review confirms the pattern is broader. Decomposition priority: CatalogScreen → CanvasPage → DashboardScreen.
- **CoupleEventHub fires ~20 queries on mount** and renders a very long single scroll. It works and is tested, but it is the exact "catalog of features" the blueprint warns against; a task-first "next decision" layout would serve couples better. Also uses `window.prompt` for decision creation (functional but jarring).
- **Dead code**: `lib/api.ts` (legacy client, unused, different token key), `.gitconfig` at repo root, `manual.yml` hello-world workflow, `deploy-ui/` (a static UI served by `server.py` — is this used in production? It appears orphaned from the main app), and `test.sh` hard-codes `$HOME/ai-workspace`.
- Bundle watch: `radix-vendor` (161 KB) and `react-vendor` (142 KB) could be trimmed with per-package imports (some Radix packages are already imported selectively — verify tree-shaking config). The `pdf` chunk is 470 KB and only needed for underlay parsing; consider keeping it lazy (it is).

---

## 9. Testing & CI/CD review

- **1,164 tests green** across 180 test files — including a large set of integration tests that boot Fastify against in-memory SQLite and exercise real RBAC flows, the public portal, guest identity, webhooks, payments reconciliation, and a full e2e journey test. This is well above industry average for a product this size.
- Coverage of the *security-critical* paths is unusually good: `rbac-coverage.integration.test.ts`, `public-abuse.integration.test.ts`, `guest-identity`, `webhookReceiver`, `venue-deletion`, `final-review-change-requests`.
- **Gaps**:
  1. Playwright is used for a11y (public surfaces) and mobile visual snapshots (29 PNGs for key screens — excellent artifacts), but **no full user-journey e2e runs in CI** (e.g., owner creates space → approves → instantiate → couple proposes → venue approves → run sheet). The server-side `e2e-journey.integration.test.ts` covers API; a browser-level happy path would catch layout/rendering regressions the component tests can't.
  2. Mobile visual snapshots are not wired into CI (`test:mobile-visual` is manual-only) — they'll rot.
  3. No bundle-size budget in CI (named in closeout backlog as P2 — agree).
  4. `npm run ci` at the repo root runs `test:coverage` then `test:client` — fine, but the root `package.json` `ci` script duplicates what the GitHub Action does; keep one source of truth.
- CI itself is solid: audit (prod deps, high+), typecheck, tests, build, smoke, a11y with artifact upload on failure, path-filtered triggers, concurrency cancel.

---

## 10. Deployment & operations review

- Multi-stage Docker build (~120 MB, tini init, migrations run on container start before boot), docker-compose with mandatory secrets, Caddy with automatic HTTPS + HSTS, healthchecks, persistent volume, offline backup/verify/restore scripts with an honest runbook and quarterly restore-drill guidance. This is production-grade for the documented single-VPS topology.
- **Concerns**:
  - `deploy.sh` hard-codes macOS paths (`/opt/homebrew/...`, `$HOME/ai-workspace/spm-web-app`) and an interactive git-flow; it is a personal tool, not a repeatable deploy pipeline. Fine as an internal script; label it as such.
  - No monitoring/alerting wired (runbook says "add metrics" in P3) — for a production venue system, at minimum wire the health endpoint to UptimeRobot/Healthchecks and log-rotate container stdout.
  - Backup scripts are bash + home-directory targets; verify they handle the Docker volume case (scripts reference `wedding-backups`; the runbook documents both).
  - `.env.example` is referenced in ARCHITECTURE.md but I did not find it in the repo — document env vars in a committed `.env.example` to prevent drift (the README table helps, but an example file is standard).

---

## 11. Git & process review

- **Branch reality**: `main` is the only actively developed branch (655 commits, latest 2026-08-02). `develop` (last commit 2026-06-29) is 265 commits behind main; `staging` (2026-07-08) is 262 behind; `feature/fixes_web_app` is stale. The `deploy.sh` git-flow (feature → develop → staging → main) is not being executed. Either (a) formally adopt trunk-based development on `main` (delete stale branches, update deploy.sh), or (b) revive the flow. Current state is a trap: someone may merge stale `develop` into `main` someday and regress 265 commits of work. **This is the highest-process risk in the repo.**
- Commit messages are excellent (conventional, scoped, e.g., `fix: protect reserved inventory from deletion`, `docs: start venue portal review`). History reads like a well-kept changelog.
- `.gitconfig` with a synthetic identity ("Expert Developer") is committed at the repo root — inert locally but should be removed from the repository (it's environment config, and it carries a fake persona).
- `.github/workflows/manual.yml` is the GitHub "Hello World" template — remove or repurpose.
- **Docs drift is real and should be fixed in one pass** (README test counts, migration counts "34", endpoint counts "92+", permission counts "71" vs. actual 48 migrations / ~389 route handlers / 72 cataloged permission ids / 1,164 tests; ARCHITECTURE.md's "10 SQL migration files (49 tables)" etc.).

---

## 12. Findings register (priority order)

| ID | Sev | Area | Finding | Suggested fix |
|---|---|---|---|---|
| F-1 | **High** | Domain | No double-booking/space-conflict guard; overlapping events can share an approved space with only a capacity flag | Conflict detection on event write; hard block w/ override reason + audit; conflict badges on space calendar |
| F-2 | **High** | RBAC | `manager`/`planner` roles grant guest-mutation permissions the routes refuse (couple-only enforcement); misleading grants & UI affordances | Remove guest-mutation grants from venue roles or introduce `guests.couple.manage`; align role editor |
| F-3 | **High** | Process | `develop`/`staging` stale 265/262 commits behind `main`; stale-branch merge hazard | Delete or fast-forward stale branches; declare trunk-based or revive flow; update deploy.sh |
| F-4 | **Medium** | RBAC | Raw `roleKey` checks in several event routes bypass the permission catalog (stage transition, final-review decision, day-of-contact) | Convert to cataloged permissions; keep roleKey only as UI hint |
| F-5 | **Medium** | Data | `schema.sql` contradicts migrations (old `role` CHECK column, 7-role world) | Mark historical or delete; migrations are the single source of truth |
| F-6 | **Medium** | Code | Monolith files: couple.ts 2,190L, CatalogScreen 2,962L, CanvasPage 2,872L, DashboardScreen 2,510L, EventDetail 1,966L, GuestPortalSettingsTab 1,695L, guests.ts 1,589L | Decompose with the repo's own extract-test-validate pattern; server first |
| F-7 | **Medium** | Product | Event tabs permission-driven but not stage-driven; blueprint's sales/planning/event-week IA unrealized | Stage-aware tab sets + stage-aware dashboard cards |
| F-8 | **Medium** | Product | Normal navigation still exposes generic system modules (Catalog/Questions/Platform Studio, Intelligence, Integration Hub, Health Center, Email Automation) | Reframe/hide per blueprint §6; owner-only progressive disclosure |
| F-9 | **Medium** | Product | Rain-plan is flag-only; no linked alternate-space workflow | Alternate-space mapping on venue scaffolds + event switch action |
| F-10 | **Medium** | Ops | Audit log unbounded (report-only retention); SSE clients max 1,000 per process | Schedule retention job or archive; document SSE cap |
| F-11 | **Low-Med** | Security | PBKDF2 120k iterations below current guidance; inbound webhook compare not timing-safe; `trustProxy: true` without proxy allowlist | Rehash-on-login migration path; timingSafeEqual; restrict proxy trust |
| F-12 | **Low-Med** | Data | Mixed timestamp formats (`datetime('now')` vs `toISOString()`) make string comparisons unreliable | Single canonical UTC format; index on it |
| F-13 | **Low** | Code | Dead code: `lib/api.ts` (legacy token key), `.gitconfig`, `manual.yml` hello-world, `deploy-ui/` unclear ownership, `test.sh` machine paths | Delete or label; sweep with a dead-code pass |
| F-14 | **Low** | Tests | No browser e2e in CI; mobile visual snapshots not in CI; no bundle budget | Add Playwright happy-path job; wire snapshot job; add size budget |
| F-15 | **Low** | Docs | README/ARCHITECTURE numbers stale (tests, migrations, endpoints, permissions); `.env.example` missing | One docs pass + commit gate that re-checks counts |

---

## 13. Recommended roadmap

**Immediate (this sprint)**
1. F-1 space-conflict guard (highest venue-integrity value).
2. F-2 permission/enforcement alignment (one-line grant changes + tests; `rbac-coverage` already exists to extend).
3. F-3 branch cleanup + process decision.
4. F-4 roleKey → permission conversion for the handful of routes.

**Next (1–2 sprints)**
5. F-6 decomposition: `routes/couple.ts` → couple/planning, couple/guests, couple/finance, couple/portal, couple/post-event; then CatalogScreen/CanvasPage/DashboardScreen.
6. F-7 stage-aware event tabs (design pass exists in blueprint §4.4).
7. F-9 rain-plan/alternate-space workflow.
8. F-5 schema.sql cleanup + F-12 timestamp canonicalization + layout payload `version` field.

**Following**
9. F-8 navigation reframe ("Today / Events / Venue Studio / Operations / Reports" + role-split IA).
10. F-10 audit retention + ops metrics (runbook P3).
11. F-14 CI e2e + snapshot + bundle budget.
12. F-15 docs sync pass; add `.env.example`.

---

## 14. Closing verdict

| Dimension | Rating (1–5) |
|---|---|
| Domain correctness (wedding venue ops) | 4.5 |
| Architecture & layering | 4.5 |
| Security posture | 4.5 |
| Data model | 4.0 |
| Test discipline | 4.5 |
| CI/CD & ops | 4.0 |
| Code maintainability | 3.0 (monoliths, dead code, drift) |
| Product IA vs. blueprint | 2.5 |
| Documentation accuracy | 2.5 |

This is a serious, unusually well-tested product that genuinely understands how wedding venues operate — the scaffold/layout boundary, inventory reservations, final-review gates, allergy escalations, and vendor gate-passes are proof of deep domain thinking. The engineering risk is not "does it work" (it demonstrably does: 1,164 tests green, clean build) but **maintainability and drift**: monolith files, permission-catalog/enforcement mismatch, stale branches, and documentation that no longer describes reality. Fix those, then execute the already-excellent Seven Paths Manor blueprint to turn a feature-complete platform into a venue-shaped product.
