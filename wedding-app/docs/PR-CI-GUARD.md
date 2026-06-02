# PR: CI guard — `npm audit` + axe-core accessibility gate

**Date:** 2026-06-01
**Type:** CI / tooling + a11y bug fix
**Risk:** Low — additive gates; one real color-contrast fix verified by the new gate

---

## What this adds

Two new automated gates, wired into both the local `npm run ci` chain and a new GitHub Actions workflow.

### 1. Security gate — `npm audit`
- **`npm run audit`** — fails on any **high/critical** advisory in *either* workspace (`--audit-level=high`).
- **`npm run audit:prod`** — runtime-only variant (`--omit=dev`) for deploy gating.
- Current status: **0 vulnerabilities** in both server and client, so the gate passes and will catch any future regression (e.g. a newly disclosed CVE in a dependency).

### 2. Accessibility gate — axe-core via Playwright
The repo already depended on `@axe-core/playwright` + `@playwright/test` but **never used them**. They're now wired up:

- **`client/playwright.config.ts`** — a11y-scoped Playwright config (single worker, points at the running server origin).
- **`client/e2e/a11y.a11y.spec.ts`** — scans the two public, no-auth surfaces against **WCAG 2.0/2.1 A & AA** and fails on any violation:
  1. **Login screen** (every venue user)
  2. **Public guest portal** (every wedding guest — the couple-facing surface)
- **`scripts/a11y-test.sh`** — harness: builds client+server, seeds a demo DB, boots the single Fastify server (which serves the built client at one origin), resolves a seeded event id for the portal scan, runs the specs, tears down. `npm run a11y`.

### 3. GitHub Actions — `.github/workflows/ci.yml`
Four parallel jobs on push/PR touching `wedding-app/**`:
| Job | Runs |
|---|---|
| **audit** | `npm run audit` |
| **test** | typecheck · server coverage · client tests · build |
| **smoke** | `npm run smoke` |
| **a11y** | `playwright install --with-deps chromium` → `npm run a11y` (uploads the Playwright report as an artifact on failure) |

### 4. Local `ci` chain updated
```
npm run ci = audit → typecheck → test:coverage (server) → test:client → build → smoke → a11y
```
(Also added `test:client` and a `.gitignore` for Playwright/build/DB artifacts.)

---

## Real accessibility bug found & fixed by the new gate

The first run of the a11y gate immediately caught **2 serious `color-contrast` (WCAG AA) violations** on the public guest portal — the couple-facing surface:

| Element | Before | Issue | Fix |
|---|---|---|---|
| Hero `<h2>` ("We can't wait to celebrate with you") | white text over `bg-black/20` on a pale accent → **2.28:1** (needs 3:1) | overlay too light over light theme accents | Darkened scrim to `bg-black/45` + added `text-shadow` so white text clears 3:1 over **any** theme accent |
| Bottom-nav inactive labels (`Map`, `RSVP`) | `fgSubtle` `#9ca3af` on white → **2.53:1** (needs 4.5:1) | gray-400 too light for small text | Switched inactive labels to `fgMuted` `#6b7280` (~4.8:1); also added `aria-current="page"` to the active tab |

Both fixes are in `client/src/screens/portal/PublicGuestPortal.tsx`. After the fix the portal scans clean. The gate was also **negative-tested**: temporarily reverting the nav color made the harness exit non-zero with a precise, actionable report — confirming the gate has teeth.

---

## Verification

```
npm run ci  →  exit 0

audit:      0 vulnerabilities (server) · 0 vulnerabilities (client)
typecheck:  clean (server + client)
server:     275/275 tests, coverage 76.78% stmts (≥75% gate)
client:     426/426 tests
build:      clean (client + server)
smoke:      all endpoint checks passed
a11y:       2 passed (login + guest portal, WCAG A/AA), 0 violations
```

Negative test: introducing a contrast regression → `a11y` job fails (exit 1) with a node-level violation report. ✅

---

## Notes / gotchas captured for maintainers
- **Run Playwright from the client dir**, not `npm --prefix client exec` from repo root: the root module context can shadow Playwright's `expect` with Vitest's (both are in the tree), corrupting worker state. The harness and `client` script both invoke `./node_modules/.bin/playwright` / run inside `client/`.
- **Single Playwright worker** (`workers: 1`, `fullyParallel: false`) — the suite shares one backend and this also avoids the expect-global collision under parallelism.
- CI must run `playwright install --with-deps chromium` (browsers + OS libs aren't in `node_modules`); the workflow does this. Locally, `playwright install chromium` once is enough (the harness attempts it automatically).
- The portal scan **excludes `<canvas>`** (the konva venue map) since axe can't introspect canvas internals.
- Coverage threshold (75%) is met legitimately — no thresholds were lowered.
