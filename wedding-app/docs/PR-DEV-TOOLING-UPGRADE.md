# PR: Dev-tooling upgrade (Vite 5→7, Vitest 2→4) — clear remaining dev-only CVEs

**Date:** 2026-06-01
**Type:** Dev-dependency upgrade (breaking majors) + test-hygiene fixes + dead-dependency removal
**Risk:** Low–Medium — full suite re-run, both packages now report **0 vulnerabilities** (all + runtime)

---

## Why

After the Fastify 5 upgrade cleared all *runtime* CVEs, `npm audit` still flagged dev-tooling chains:

- **esbuild ≤0.24.2 → vite ≤6.4.1 → @vitest/mocker → vitest → @vitest/coverage-v8** (the dev-server SSRF advisory, GHSA-67mh-4wv8-2f99) — across **both** server and client.
- **A new critical** surfaced mid-upgrade: `vitest <4.1.0` Vitest-UI arbitrary file read/exec (GHSA-5xrq-8626-4rwp). Only exploitable with `vitest --ui` (this repo runs headless `vitest run`), but cleared anyway.
- **Client only:** `tar` (high, multiple path-traversal advisories) pulled in transitively through **`canvas` → @mapbox/node-pre-gyp → tar**.

---

## What changed

### Server (`server/package.json`)
| Package | Before | After |
|---|---|---|
| `vitest` | ^2.1.1 | **^4.1.8** |
| `@vitest/coverage-v8` | ^2.1.1 | **^4.1.8** |

### Client (`client/package.json`)
| Package | Before | After |
|---|---|---|
| `vite` | ^5.4.6 | **^7.3.5** |
| `vitest` | ^2.1.1 | **^4.1.8** |
| `@vitest/coverage-v8` | ^2.1.1 | **^4.1.8** |
| `@vitejs/plugin-react` | ^4.3.1 | **^5.2.0** |
| `jsdom` | ^25.0.0 | **^26.1.0** |
| `canvas` | ^2.11.2 (runtime dep) | **REMOVED** |

`vite-plugin-pwa@1.3.0` and `@tailwindcss/vite@4` already declare Vite 7 support — left unchanged.

### Code / config fixes required by the upgrade (4 files)

1. **`server/vitest.config.ts`** & **`client/vite.config.ts`** — added explicit `include: ['src/**/*.test.{ts,tsx}']` + `exclude: ['dist/**','node_modules/**']`.
   **Why:** Vitest 4 widened its default test glob to also match compiled `.js`. With a stale `server/dist/` present, the suite was being **double-collected** (27 → 54 files) and the duplicate copies fought over the same in-memory SQLite transaction (`cannot rollback - no transaction is active`). Pinning the glob makes the run deterministic regardless of build state.

2. **`client/src/screens/events/chat/ChatSystem.tsx`** — added an `isMounted()` guard to the async `loadMessages` flow.
   **Why:** `loadMessages` does async IndexedDB/network work and then calls `setMessages`/`setServerOnline`. If the component unmounts first (which the tests do), the state update fires after jsdom tears down `window` → `ReferenceError: window is not defined`. Vitest 2 silently swallowed this post-teardown rejection; **Vitest 4 correctly reports it as an error and fails the run.** This was a genuine latent "setState-after-unmount" bug (React leak warning in production) — now fixed with a mounted flag managed by the effect's cleanup.

3. **Removed `canvas`** — it was declared as a **runtime dependency** but is **not imported anywhere in `client/src`** (the app uses `konva`/`react-konva` for floor plans). It was only present as jsdom's *optional* peer, and the 3 canvas-touching tests already stub `HTMLCanvasElement.prototype.getContext` / mock `react-konva` themselves. Removing it eliminated the entire `tar`/`@mapbox/node-pre-gyp` high-severity chain and a heavy native build dependency. Bumping `jsdom` to 26 dropped the last transitive reference.

### Coverage adjustment (server) — new tests, not lowered thresholds

Vitest 4's v8 coverage uses more accurate AST-based statement remapping, which reported the existing suite at **73.19% statements** vs the **75%** threshold (Vitest 2 over-counted). Rather than lower the bar, I **added the missing integration tests** for `intelligence.ts`, which previously had **~12% coverage** (no tests at all):

- **`server/src/routes/intelligence.integration.test.ts`** (11 tests) covering vendor ratings, email templates, payment links, and recommendations — including **regression tests for the cross-org IDOR fix** (vendor ratings) and the **template-preview RBAC fix** from the earlier review.

`intelligence.ts` coverage: **12% → 85%**. Overall statements: **73.19% → 76.78%** (threshold met, coverage gate exits 0).

---

## Verification

### Security (the point of the PR)
```
SERVER  npm audit:            0 vulnerabilities  (was 13: 3 critical, 6 high pre-Fastify-5)
CLIENT  npm audit:            0 vulnerabilities  (was 10: 2 critical, 4 high)
SERVER  npm audit --omit=dev: 0 vulnerabilities
CLIENT  npm audit --omit=dev: 0 vulnerabilities
esbuild: 0.24.2 (vuln) → 0.27.7 (client) / 0.28.0 (server, via tsx) — patched
vite:    5.4.6 → 7.3.5 — patched
vitest:  2.1.1 → 4.1.8 — patched (UI advisory cleared)
tar/canvas chain: removed entirely
```

### Quality gates (all re-run)
| Gate | Result |
|---|---|
| `server typecheck` | ✅ clean |
| `client typecheck` | ✅ clean |
| `server build` (tsc) | ✅ clean |
| `client build` (vite 7 + PWA injectManifest) | ✅ clean (SW generated; no UiPreview chunk; main bundle 1138 KB / 334 KB gz) |
| `server test` | ✅ **275/275, exit 0** (28 files; +11 intelligence tests) |
| `server test --coverage` | ✅ 76.78% stmts ≥ 75% threshold, exit 0 |
| `client test` | ✅ **426/426, exit 0** (90 files; 0 unhandled-rejection errors) |
| **Total** | ✅ **701 tests passing** |

---

## Notes / follow-ups
- The Vitest UI advisory (GHSA-5xrq-8626-4rwp) only affected `vitest --ui`; this repo runs headless, so exposure was already minimal — cleared regardless.
- Recommended CI guard (carried over from the Fastify PR): add `npm audit --audit-level=high` (or `--omit=dev` for runtime-only) to the `ci` script so new CVEs fail the build.
- `canvas` removal also speeds up `npm install` (no native node-canvas compile).
