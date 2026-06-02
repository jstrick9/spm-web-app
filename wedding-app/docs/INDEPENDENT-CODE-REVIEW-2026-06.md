# Independent Code Review & Feature Analysis — Wedding Venue Intelligence Platform

**Reviewer:** External senior review (independent verification)
**Date:** 2026-06-01
**Scope:** Full repo — `wedding-app/` (client + server + config + docs + deploy)
**Method:** Repo cloned and built locally. Every quality gate was *run*, not assumed:
`npm install` (server + client) → `typecheck` → server tests → client tests → production build → `npm audit`.
Security-critical code paths were read line-by-line (auth, crypto, file storage, RBAC, webhooks, SSE, static serving).

> **Headline:** This is a genuinely strong, mature codebase (~43k LOC, 47 phases, 684 → **690 tests after this review**). The previous in-repo `FINAL-CODE-REVIEW.md` rates it "★★★★★, zero issues." That conclusion is **overstated**. By actually running the suite and reading the security paths I found **one latent process-crash bug, one horizontal-privilege-escalation (IDOR), one stored-XSS/unrestricted-upload vector, high/critical dependency CVEs, an accessibility defect that the test runner was already warning about, a dev-only 385 KB chunk shipping to production, and a missing documented file.** All of these have been **fixed in this pass** (see "Fixes Applied"). None required architectural change.

---

## 0. Verification Results (what actually happened when I ran it)

| Gate | Before review | After fixes |
|---|---|---|
| `server typecheck` | ✅ clean | ✅ clean |
| `client typecheck` | ✅ clean | ✅ clean |
| `server test` | ⚠️ **258 pass but exit code 1** (unhandled rejection) | ✅ **264 pass, exit 0** |
| `client test` | ✅ 426 pass (with a11y console warnings) | ✅ 426 pass (warnings gone) |
| `client build` | ✅ but ships dev-only `UiPreview` chunk (385 KB / 107 KB gz) | ✅ chunk removed |
| `npm audit` (server) | 🔴 14 vulns (3 critical, 6 high) incl. nodemailer SMTP injection | 🟡 nodemailer fixed; fastify chain remains (needs v5) |

The README/ARCHITECTURE claims "0 failures" — technically true at the *assertion* level, but the server test process **exited non-zero** because of an unhandled promise rejection that CI (`npm run ci`) would have caught as a failure. That is the kind of thing a "★★★★★ zero issues" review should never miss.

---

## Part 1 — Bugs, Security & Performance

### 🔴 1.1 Latent process crash: unhandled rejection in the webhook dispatcher — **FIXED**

**Where:** `server/src/webhooks/dispatcher.ts` → `server/src/db/repos/webhooks.ts:recordDelivery`

**Symptom (reproduced):**
```
Unhandled Rejection: TypeError: The database connection is not open
 ❯ Object.recordDelivery src/db/repos/webhooks.ts:107
 ❯ deliverWebhook src/webhooks/dispatcher.ts:111
```

**Root cause:** `broadcastWebhook` is fire-and-forget (`setImmediate` + async). The `fetch` is wrapped in `try/catch`, but the **`recordDelivery()` DB write inside the `catch` block is not**. Because delivery can finish *after* the originating request — during graceful shutdown, or in tests after the SQLite handle closes — `db.prepare()` throws on a closed connection. That throw escapes as an unhandled rejection. Under Node's default unhandled-rejection policy this can **terminate the process**. In production this is a real availability risk during any deploy/restart window.

**Fix applied:** wrapped both `recordDelivery` call sites in a `safeRecordDelivery()` helper that swallows DB-unavailable errors. A failed *delivery log* must never be able to crash the server.

```ts
function safeRecordDelivery(args: Parameters<typeof webhooksRepo.recordDelivery>[0]): void {
  try { webhooksRepo.recordDelivery(args); }
  catch { /* DB closed during shutdown — drop the log, never crash */ }
}
```

**Result:** server test process now exits `0`.

---

### 🔴 1.2 Horizontal privilege escalation (IDOR) on vendor ratings — **FIXED**

**Where:** `server/src/routes/intelligence.ts` (`POST`/`GET /api/vendors/:vendorId/ratings`)

**Root cause:** the permission check used an **empty scope**:
```ts
if (!can(req.auth!.memberships, {}, 'vendors.manage')) throw Forbidden();   // ← scope is {}
const rating = vendorRatingsRepo.create({
  organizationId: req.auth!.memberships[0]?.organizationId ?? '',           // ← "first" org, not the vendor's
  vendorId, ...
});
```
`{}` means "do you have `vendors.manage` *anywhere*?" — it never checks that `:vendorId` belongs to the caller's org. A user who is a manager in **Org A** could `POST` a rating against a vendor in **Org B**, and the row would even be mis-stamped with Org A's id. The `GET` had the same flaw: any authenticated user with `vendors.view` in any org could read any vendor's ratings.

**Fix applied:** resolve the vendor's real org and scope the check to it (and stamp the correct org id):
```ts
const vendor = vendorsRepo.findById(vendorId);
if (!vendor) throw NotFound();
if (!can(req.auth!.memberships, { organizationId: vendor.organization_id }, 'vendors.manage')) throw Forbidden();
```

**Lesson for the codebase:** grep for `can(..., {}, ...)` — empty-scope checks are a smell. Every resource-by-id route must resolve the resource and scope RBAC to *its* org, exactly as `gallery.ts` and `contracts.ts` already do correctly.

---

### 🟠 1.3 Stored-XSS / unrestricted file upload via gallery data URIs — **FIXED**

**Where:** `server/src/lib/fileStorage.ts:saveDataUri`, used by `routes/gallery.ts`

**Root cause:** the file extension was taken straight from the user-supplied MIME type with no allowlist:
```ts
const ext = mimeType.split('/')[1] ?? 'bin';      // attacker controls this
writeFileSync(join(UPLOAD_DIR, `${prefix}_${uuid()}.${ext}`), ...);
```
The gallery zod schema only validates `url: z.string().max(500000)`. An authenticated user with `gallery.manage` could POST `data:image/svg+xml;base64,...` (SVG can embed `<script>`) or `data:text/html;base64,...`. The file lands in `/uploads/`, which is served by `@fastify/static` **from the same origin** → **stored XSS**. `deleteFile` also did `urlPath.replace('/uploads/','')` with no `..` normalization (path-traversal on delete).

**Fix applied:**
- Strict MIME allowlist → canonical extension map (`jpeg/png/webp/gif/avif`). **SVG deliberately excluded.**
- Reject non-image / malformed data URIs with `BadRequest`.
- 8 MB decoded-size cap.
- `deleteFile` now uses `path.basename()` so traversal segments can't escape `UPLOAD_DIR`.
- Added `server/src/lib/fileStorage.test.ts` (6 tests) locking in the behavior (SVG rejected, HTML rejected, no non-image extension ever written, happy-path PNG works).

> Hardening note (follow-up, not blocking): also send `Content-Disposition: attachment` or serve uploads from a separate cookieless domain for defense-in-depth. The CSP added in 1.5 already blocks inline `<script>` execution as a second layer.

---

### 🔴 1.4 Dependency vulnerabilities (high/critical) — **PARTIALLY FIXED**

`npm audit` reported **14 server vulns (3 critical, 6 high)**. The notable one:

- **`nodemailer ≤ 8.0.4`** — *SMTP command injection*, *email-to-unintended-domain*, *addressparser DoS* (high). The platform uses nodemailer for the SMTP integration provider. **FIXED:** bumped to `^8.0.10`; API surface used (`createTransport`/`sendMail`/`verify`) is unchanged; typecheck + tests pass; nodemailer no longer appears in `npm audit`.
- **`fast-uri` / `fast-json-stringify` / `@fastify/ajv-compiler`** (path traversal, host confusion) — these are transitive under **Fastify 4**. The only clean fix is **Fastify 5** (a deliberate, tested upgrade). **Documented, not auto-applied** here because it's a breaking major and warrants its own PR + regression pass. Recommended next sprint.

**Recommendation:** add `npm audit --omit=dev --audit-level=high` to the `ci` script so new high/critical CVEs fail the build.

---

### 🟠 1.5 No HTTP security headers on responses (incl. SPA & uploads) — **FIXED**

**Where:** `server/src/index.ts`. The app served the SPA, API, and `/uploads/` with **no** `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, or HSTS. There's no `@fastify/helmet`.

**Fix applied:** a dependency-free `onSend` hook adds baseline headers to every response:
```
Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline';
                         script-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=31536000; includeSubDomains   (production only)
```
This blocks clickjacking, MIME-sniffing, and — crucially — gives a second line of defense against the upload issue in 1.3 (inline/injected scripts won't execute). `'unsafe-inline'` is needed for Tailwind's injected styles; `script-src 'self'` keeps JS locked down. Tighten per deployment (nonce-based CSP) as a future improvement.

---

### 🟡 1.6 Dev-only `UiPreview` (385 KB) shipped to production — **FIXED**

**Where:** `client/src/App.tsx`. The `/preview` component gallery was reachable in production (before the auth gate) and its lazy `import()` always emitted a **385 KB / 107 KB-gzip chunk**.

**Fix applied:** guarded the lazy declaration with `import.meta.env.DEV` (a compile-time constant) so Rollup tree-shakes the import and chunk out of prod. Verified: the `UiPreview-*.js` chunk **no longer appears** in `dist/`. Net shipped-asset reduction ≈ 385 KB raw.

---

### 🟡 1.7 Main bundle exceeds the 500 KB warning threshold

`dist/assets/index-*.js` is **1.17 MB raw / 338 KB gzip** and triggers Vite's chunk-size warning. The README's "336 KB main bundle" quietly refers only to the gzip figure. Heavy libs (konva, recharts, html5-qrcode) are already lazy-loaded, which is good. **Recommendation (not auto-applied — needs measurement):** add `build.rollupOptions.output.manualChunks` to split the React/Radix vendor bundle from app code so the initial parse cost drops and caching improves. Low risk, measurable win.

---

### ℹ️ 1.8 Smaller items (verified, lower priority)

| Item | Where | Note |
|---|---|---|
| `hashToken` uses 10k PBKDF2 iterations vs 120k for passwords | `lib/crypto.ts` | Acceptable for high-entropy random tokens, but document the rationale. |
| `req.auth!.memberships[0]?.organizationId` "first membership" pattern | several routes | Works for single-org users; revisit for multi-org users (same class as 1.2). |
| 122 `any` instances in client | screens/SDK | Tech debt, not bugs. The portal SDK `.then((r: any))` bypasses typing — worth a typed response. |
| 3 `console.*` calls in client prod code | misc | Strip via Vite `esbuild.drop` in prod. |
| `JWT_SECRET` dev default | `index.ts` | Correctly fatal in production — good. |

**Security posture overall:** genuinely strong foundations (PBKDF2 + timing-safe compare, login lockout, AES-GCM secrets, HMAC webhooks, parameterized SQL, restrictive CORS default, layered rate-limiting). The gaps above were the exceptions, now closed. Revised rating: **★★★★ (was overstated at ★★★★★).**

---

## Part 2 — UI/UX Audit (component-by-component, against best practices)

| Component / Surface | Assessment | Actionable improvement |
|---|---|---|
| **Design system (`ui/`)** | Excellent — 24 Radix-based components, CVA variants, 7 themes, 4-layer config cascade, dark mode with anti-flash. | Keep. Add a Storybook/`/preview` *dev* gate (done in 1.6) so it isn't public. |
| **`WelcomeModal` (onboarding)** | ❌ **A11y defect (FIXED).** Rendered the title as a bare `<h2>` and had no description, so Radix logged *"DialogContent requires a DialogTitle"* and *"Missing Description"* — screen readers got no dialog name. Pagination dots and the prev button were icon-only with no labels; "don't show again" used a raw `<input>` not the design-system `Checkbox`. | **Applied:** title → `DialogTitle`, copy → `DialogDescription`, `aria-label`/`aria-current` on dots, `aria-label` on prev button, `aria-label` on the dialog. Console warnings gone. Follow-up: swap the raw checkbox for `<Checkbox>`. |
| **AppShell / sidebar** | Strong — 8 items, mobile drawer + hamburger, skip-to-content. | Add `aria-current="page"` to the active nav item; ensure the drawer traps focus when open. |
| **Command palette (⌘K), ⌘N, ⌘/** | Best-in-class for the segment. | Surface the shortcut hints in a first-run tooltip; many venue staff won't discover them. |
| **EventDetail tabs** | Good — `aria-label`s present, scroll indicator on mobile. | Persist the active tab in the URL hash so refresh/back works and tabs are deep-linkable. |
| **GuestsTable / large tables** | Good — `overflow-x-auto`, column-hiding on mobile, bulk actions. | Sort headers are icon-only → add `aria-sort` + labels. Consider virtualization for 500+ guest lists. |
| **Floor-plan Canvas (react-konva)** | Powerful but desktop-only (konva ignores CSS breakpoints). | Acceptable for the workflow; add an explicit "best viewed on desktop/tablet" hint on small screens instead of a broken layout. |
| **Public Guest Portal** | Themed, no-auth, interactive map — great couple-facing experience. | The SDK call uses `.then((r:any))`; type it. Add a `prefers-reduced-motion` guard on the animated entrances. |
| **Forms (react-hook-form + zod)** | Field-level errors, 87 toasts, 28 destructive confirmations. | Ensure every error message is wired via `aria-describedby` to its input (Radix Label helps but verify). |
| **Loading / error states** | 42 skeleton screens, global ErrorBoundary, 404 page, session-expiry guard. | Strong. Add a retry affordance on query-error states (React Query `refetch`). |
| **StatCards / KPIs** | Clean. | Add `role="status"`/`aria-live="polite"` so SR users hear KPI updates (already noted in prior review, still open). |

**General UI/UX verdict:** ★★★★½. The system is consistent and thoughtfully themed. The biggest *practical* a11y win was the WelcomeModal fix (it was the literal first thing a screen reader hits for new users). The remaining items are small, well-scoped, and align with the existing Radix-based structure — no redesign needed. **Recommend wiring `@axe-core/playwright` (already a dependency!) into CI** — it's installed but there are no e2e a11y tests using it.

---

## Part 3 — Feature Expansion: from "listing platform" to "intelligence platform"

The platform already ships a strong analytics layer (lead-source ROI, seasonal heatmap, percentile budget/guest benchmarks, vendor insights, meal trends, pipeline forecast, recommendations). To make it *best-in-class intelligence*, the next features should turn that descriptive analytics into **prescriptive, automated action**. Each below is grounded in code that already exists.

### 3.1 Automated lifecycle email engine (highest ROI, lowest new surface)
- **Value:** Closes the loop between data and action — RSVP-reminder lift, no-show reduction, post-event reviews. This is the #1 thing venues pay competitors for.
- **It's 80% built already:** `email_templates` (with merge fields + `/preview`), the `job_queue` + `jobs/worker.ts` handler registry, and the SMTP integration provider all exist. The `events.rsvp_deadline` column exists.
- **Technical approach:** add a `scheduled_emails` table + a worker handler `kind: "send_template_email"`. A nightly job (already have the worker) scans events where `rsvp_deadline` is within N days and enqueues a reminder using the existing template render + SMTP provider. Trigger thank-you/NPS on `status → completed` (hook the existing event-status mutation).
- **Integration points:** `routes/events.ts` (status change hook), `repos/emailTemplates.ts` (render), `jobs/worker.ts` (`registerHandler`), `integrations/providers/email_smtp.ts` (send). **No new infra.**
- **Security/scale:** rate-limit sends per org; store only template IDs + merge context, never rendered PII; idempotency key per (event, template, guest) to avoid double-sends.

### 3.2 Predictive booking & revenue forecasting
- **Value:** "You'll likely book 6 events in Q3 worth ~$X; September is your peak — raise rates." Turns the existing pipeline + seasonal data into forward guidance.
- **Approach:** extend `recommendationsRepo` (already does P25/median/P75 in pure SQL) with a simple time-series projection (trailing-12-month moving average + seasonal index from the existing heatmap). No ML dependency needed — keep the "pure SQL aggregation" philosophy from Phase 47.
- **Integration points:** new method on `recommendationsRepo`, new field in the `/api/orgs/:id/recommendations` response, new card in `IntelligenceDashboard.tsx` (recharts already lazy-loaded).
- **Scale:** results are cheap to compute and cacheable (React Query 30s staleTime already in place).

### 3.3 Vendor reliability scoring + smart matching
- **Value:** Now that `vendor_ratings` (quality/timeliness/communication sub-scores) exists, surface a composite **reliability score** and recommend vendors per event type/budget band — a defensible "intelligence" differentiator.
- **Approach:** aggregate sub-scores (`vendorRatingsRepo.aggregate` already exists) into a weighted index; join with `vendor` category + historical event budget to rank "best fit for a 120-guest, $40k garden wedding."
- **Integration points:** `VendorDirectory.tsx` (badge + sort), `recommendationsRepo` (matching query), the event-creation flow (suggested vendors).
- **Security:** the IDOR fix in 1.2 is a prerequisite — scoring must never leak cross-org ratings.

### 3.4 Guest identity resolution (cross-event dedup)
- **Value:** Repeat-guest insight ("this couple attended 3 weddings here") and cleaner data; powers loyalty/marketing.
- **Approach:** fuzzy match on (email, normalized name, phone) across `guests`; surface a "merge suggestions" queue in the existing `CrossEventGuestBrowser.tsx`. Keep it human-confirmed (no silent auto-merge) for data safety.
- **Integration points:** `repos/guests.ts` (matching query), `CrossEventGuestBrowser.tsx` (UI), audit log every merge.

### 3.5 Anomaly & risk alerts on the dashboard
- **Value:** Proactive "intelligence": flag events that are *behind* (low RSVP velocity vs benchmark, unsigned contract near event date, budget variance > P75, missing COI from a vendor).
- **Approach:** a derived "event health" computation combining existing signals (RSVP velocity, contract status, budget variance — all already tracked) into a single risk badge on `EventsList`/`TodayView`.
- **Integration points:** reuse `EventProgressCard`/`EventReadiness` logic; emit an SSE + push notification (both already built) when an event crosses a risk threshold.

### 3.6 Real payment capture (finish the Stripe/Square infra)
- **Value:** Deposits/final payments in-app — direct revenue feature.
- **Status:** `payment_links` table, multi-provider enum, and status state-machine already exist; only the provider SDK wiring + webhook receiver mapping remain (the webhook receiver framework is built). This is a deployment/credentials task, not a green-field feature.
- **Security:** store only provider IDs + status; verify inbound payment webhooks via the existing HMAC verifier; never store PAN data.

**Prioritization (effort vs. value, given the existing architecture):**
1. **3.1 Lifecycle emails** — highest value, mostly assembly of existing parts.
2. **3.5 Risk alerts** — high perceived "intelligence," reuses existing signals + SSE/push.
3. **3.2 Forecasting** — extends `recommendationsRepo`, small + cacheable.
4. **3.3 Vendor scoring** — depends on 1.2 fix; strong differentiator.
5. **3.4 Guest dedup** — data-quality foundation.
6. **3.6 Payments** — revenue, but gated on provider accounts.

---

## Part 4 — Repository Completeness & Hygiene

- ✅ All major directories reviewed: `client/`, `server/`, `deploy/` (Caddy config — fine), `scripts/` (reset/smoke — fine), `docs/` (82 phase files — thorough), root config (`Dockerfile`, `docker-compose.yml`, `package.json`).
- ❌ **`.env.example` was referenced by both `README.md` and `ARCHITECTURE.md` but did not exist.** **FIXED:** created `wedding-app/.env.example` documenting every env var (JWT_SECRET, CORS_ORIGIN, WEDDING_SECRETS_KEY, VAPID, SMTP).
- ⚠️ `docs/FINAL-CODE-REVIEW.md` and the README overstate quality ("zero issues / ★★★★★"). Recommend updating them to reflect the findings here so the docs stay trustworthy.
- ⚠️ The `wedding-poc/` directory is the older proof-of-concept and is **superseded** by `wedding-app/`. It's fine to keep for history but should be clearly marked deprecated to avoid confusion.
- ✅ `npm run ci` exists (typecheck + coverage + build + smoke) — good. **Add:** `npm audit --audit-level=high` and an axe-core a11y e2e step.

---

## Part 5 — Summary of Fixes Applied in This Review

| # | Severity | File(s) | Fix | Verified by |
|---|---|---|---|---|
| 1.1 | 🔴 Crash | `server/src/webhooks/dispatcher.ts` | `safeRecordDelivery()` guards DB writes in fire-and-forget delivery | server test exit 0 (was 1) |
| 1.2 | 🔴 IDOR | `server/src/routes/intelligence.ts` | Scope vendor-rating RBAC to the vendor's real org; stamp correct org id | typecheck + 264 tests |
| 1.3 | 🟠 XSS/upload | `server/src/lib/fileStorage.ts` (+ new `fileStorage.test.ts`) | MIME allowlist, SVG/HTML rejected, size cap, traversal-safe delete | 6 new tests pass |
| 1.4 | 🔴 CVE | `server/package.json` | nodemailer → ^8.0.10 (SMTP injection fixed) | `npm audit` clean for nodemailer |
| 1.5 | 🟠 Hardening | `server/src/index.ts` | CSP + nosniff + frame-deny + referrer + HSTS via `onSend` | build + tests |
| 1.6 | 🟡 Perf | `client/src/App.tsx` | Dev-gate `UiPreview` so its 385 KB chunk leaves prod | chunk absent from `dist/` |
| 2 (a11y) | 🟠 A11y | `client/src/components/onboarding/WelcomeModal.tsx` | `DialogTitle`/`DialogDescription`, aria-labels on controls | Radix warnings gone, tests pass |
| 4 | 🟡 Docs | `wedding-app/.env.example` (new) | Create the documented-but-missing env reference | file present |

**Post-fix gate status:** `server typecheck` ✅ · `client typecheck` ✅ · `server test` **264/264, exit 0** ✅ · `client test` **426/426** ✅ · `client build` ✅ (UiPreview removed) · nodemailer CVE cleared.

**Net test delta:** 684 → **690** (added 6 security regression tests).

---

## Recommended Next Steps (in order)

1. **Upgrade Fastify 4 → 5** in a dedicated PR to clear the remaining `fast-uri` chain CVEs; re-run full suite.
2. **Wire CI guards:** `npm audit --audit-level=high` + an `@axe-core/playwright` a11y smoke test (dependency already installed).
3. **Bundle split:** add `manualChunks` for the React/Radix vendor bundle (measure before/after).
4. **Ship Feature 3.1 (lifecycle email engine)** — highest value, reuses existing job queue + templates + SMTP.
5. **Audit for other empty-scope RBAC checks** (`can(..., {}, ...)`) — same class as the 1.2 IDOR.
6. **Refresh `FINAL-CODE-REVIEW.md` / README** to reflect real status so the docs remain trustworthy.
