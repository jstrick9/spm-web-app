# Gap-Hunting Process & Runbook — "Don't stop until nothing is left"

**Owner:** Expert Developer (agent) · **Applies to:** `wedding-app/` (server + client)
**Latest baseline:** 53 e2e · 995 client unit · 702 server tests · 4 branches pinned

This runbook defines the *repeatable* process for autonomously finding and
fixing every bug, gap, and UX defect in the platform. Each numbered pass is
a closed loop: **mine → verify in a browser → fix → regression-test →
commit → push → re-run everything**. The loop ends only when a full cycle
produces zero new findings and two consecutive full-suite runs are green.

---

## Phase 0 — Establish invariants (every session start)

1. Restore environment: install deps, build server+client, migrate+seed,
   start server with `E2E_RATE_LIMIT_BYPASS=1`, install Playwright chromium.
2. Re-add the tokenized `origin`; verify all 4 branches (`main`, `develop`,
   `staging`, `feature/fixes_web_app`) share one SHA; `git status` clean.
3. Run the **entire** baseline: server vitest, client vitest, all e2e,
   a11y scans, mobile-visual. Any failure must be triaged (bug vs flake vs
   environment) before hunting begins.

## Phase 1 — Static mining (batch, greppable)

1. **Unwired-feature scan** (highest yield historically):
   - Every `sdk/*.ts` method with **zero callers** outside `sdk/` →
     investigate; a backend route with no UI is usually a user-facing gap
     (found: `createSubEvent`, `uploadDocumentVersion`, `updateShift`,
     `verifyPassword`, `templateGallery`).
   - Every server route without a matching SDK call, and every SDK call
     without a component caller.
   - Export-and-import scan: components exported but never imported.
2. **API contract mismatch sweep** (found: shift scheduling +
   access-control breakage):
   - Client reads `m.userId`/`m.roleId`/`m.fullName` where the API returns
     snake_case (`user_id`, `role_id`, `full_name`, `role_name`) — grep for
     `.userId`, `.roleId`, `.fullName`, `.roleName`, `.eventId` etc. against
     the actual repo/serializer shapes.
   - Zod schemas vs client input objects (field names, required-ness,
     enums, min/max).
   - Empty-state / helper copy promising a feature that doesn't exist
     ("Add from the timeline tools", "request a secure link"…).
3. **Date/time hazards**: `new Date('YYYY-MM-DD')` on date-only columns,
   `toISOString().slice(0,10)` for "today", raw `86400000` day math, UTC
   getters on local wall-clock data. (Mostly fixed; re-audit on every new
   feature.)
4. **Security posture** (server): unauthenticated routes missing
   rate-limit/honeypot/audit, missing RBAC checks, token expiry/rotation,
   file-upload type/size/path checks, XSS sinks (URLs, filenames, HTML
   email), cross-org data leakage (query without org scoping), guest PII
   exposure in public payloads.
5. **String/copy audit**: TODO/FIXME/HACK, dead `href="#"`, `window.alert/
   confirm/prompt` (must use `usePrompt`), grammar ("1 votes"), placeholder
   leaks, `console.*` in prod code.
6. **i18n**: dictionary parity (already test-enforced), keys used but never
   defined, venue-authored content accidentally passed through `t()`.
7. **A11y static**: icon-only buttons without labels, click-only divs,
   `<select>` without aria-labels, contrast-token violations (axe in e2e).

## Phase 2 — Browser behavior mining (the layer that finds real bugs)

1. **Clean-sweep gates** (extend the existing `surfaces-clean` /
   `event-tabs-clean` family to every surface + every role):
   console errors, page errors, HTTP ≥400, with route-abort workaround for
   offline cases.
2. **Interaction fuzzing per surface**: click every button, submit every
   form, then repeat with empty/invalid input, cancel, Escape, double-click,
   rapid tab switches. Watch for silent failures (no toast/status) — the
   rate-limit silent-failure bug was found this way.
3. **Navigation fuzzing**: back/forward, deep links, manual hash edits,
   reload mid-flow, shared `?tab=` links (found the event-detail tab bug).
4. **Role matrix**: run every flow as owner / admin / manager / planner /
   staff / vendor / couple / guest; assert what each role CANNOT see/do
   (RBAC gaps + AccessDenied correctness).
5. **Ordering/concurrency**: run the full suite twice back-to-back; hunt
   shared-state pollution between specs (found the tour-reappear flake).
6. **Mobile + visual**: mobile viewports for overflow/overlap; refresh
   visual baselines only after reviewed UI changes.
7. **PWA/offline**: offline queue replay, SW update, stale-cache behavior,
   `page.reload()` vs `goto` semantics.

## Phase 3 — Data/state fuzzing

- Odd inputs: empty, whitespace, 1000-char, unicode/emoji, XSS strings in
  names/notes/messages, negative/zero counts, far-future/past dates, nulls.
- Duplicate submissions, idempotency (double-tap submit), concurrent
  edits (last-write-wins sanity), deleted/archived entity access.
- Cross-org isolation probes (A's token can't read B's data) on every new
  endpoint.

## Phase 4 — Fix discipline (every fix, no exceptions)

1. Minimal, targeted fix at the root cause (fix the *class*, then sweep the
   class — e.g. one snake/camel bug → grep the whole codebase).
2. **Regression test before commit**: unit and/or integration for logic,
   e2e for user-visible behavior (the spec must fail on the old code).
3. Pass doc per batch (`docs/HUNT-PASS-N.md`): symptom, root cause, fix,
   tests, verification numbers.
4. Commit with the established identity; **push all 4 branches**;
   `git status --porcelain | wc -l` must be 0; re-run full suites before
   pushing.

## Phase 5 — Stopping criteria (the honest definition of "done")

A full cycle is "clean" when ALL of:
1. Phase 1 static sweeps return zero actionable findings.
2. Phase 2 browser fuzzing (all surfaces × roles × navigation) returns zero
   console/network/behavioral defects, and the new-interaction walk of
   every button/form finds no silent failures.
3. Phase 3 data-fuzzing returns zero crashes/500s/leaks.
4. **Two consecutive full-suite runs** (unit + e2e + a11y + visual) are
   100% green with zero flakes.
5. An **adversarial fresh-eyes pass** (a new hunt from the top of this
   runbook with no assumptions) adds zero findings.

Then, and only then, declare the state **"no known fixable issues"** and
write the closing doc enumerating:

- every issue found & fixed (with test references),
- every **known limitation that is intentionally out of scope** (external
  integrations without test credentials, SMTP/SMS provider-dependent
  delivery, third-party map/AR preview services, venue-authored content in
  other languages, Konva canvas screen-reader limits, browser-API
  differences), so "done" is honest and auditable.

If a pass yields only 1–2 trivial items, still fix them, then run one more
full clean cycle before stopping.

---

## Session operating rules

- **Ask before diverging**: if a finding implies a *net-new product
  feature* (not a gap the UI already promises) or a breaking contract
  change, present the finding + recommendation via the question tool and
  wait.
- **Keep the tree green**: never leave the workspace dirty between turns;
  every batch ends pushed to all 4 branches.
- **Bias to the user's experience**: when choosing between two fixes,
  prefer the one a real wedding venue employee, couple, or guest would
  notice.
- **Log everything**: every pass's findings (even non-fixes) go into the
  pass doc so nothing is re-hunted twice.
