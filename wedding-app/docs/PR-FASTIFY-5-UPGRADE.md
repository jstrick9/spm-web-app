# PR: Upgrade Fastify 4 → 5 (clear `fast-uri` chain CVEs)

**Date:** 2026-06-01
**Type:** Dependency upgrade (breaking major) + minimal code adaptation
**Risk:** Low — full suite re-run + live runtime smoke test, zero regressions

---

## Why

`npm audit` flagged a high-severity transitive chain that could only be fixed by moving off Fastify 4:

```
fast-uri ≤3.1.1  (path traversal via percent-encoded dot segments; host confusion)
  └─ @fastify/ajv-compiler 3.x
  └─ fast-json-stringify 3–6
       └─ fastify ≤5.8.2
```

Fastify 4's pinned dependency tree held `fast-uri` back at a vulnerable version. The clean fix is Fastify 5, which pulls `fast-uri@3.1.2` (patched).

---

## What changed

### Dependencies (`server/package.json`)
| Package | Before | After |
|---|---|---|
| `fastify` | ^4.28.1 | **^5.8.5** |
| `@fastify/cors` | ^9.0.1 | **^10.1.0** |
| `@fastify/jwt` | ^8.0.1 | **^10.1.0** |
| `@fastify/rate-limit` | ^9.1.0 | **^10.3.0** |
| `@fastify/static` | ^7.0.4 | **^9.1.3** |

> `@fastify/static` was bumped to **v9** (not just the v8 that Fastify 5 requires) because v8 carried its own moderate CVEs (path traversal in directory listing; route-guard bypass via encoded separators). v9 is Fastify-5 compatible and clears them.

### Code (1 file — the only breaking change that affected this app)
- **`server/src/routes/sse.ts`** — added `reply.hijack()` before writing to `reply.raw` in the SSE stream handler.
  **Why:** In Fastify 5, a route handler that takes over the underlying socket via `reply.raw` must call `reply.hijack()`; otherwise Fastify assumes it still owns the response lifecycle (warns and may interfere with the open stream). This is the documented Fastify 4→5 migration step for raw-stream/SSE handlers. All other handlers use the standard return-value / `reply.send()` API and needed no change.

No changes were required for:
- JWT (`req.jwtVerify()`, `req.user`, `app.jwt.sign/verify`) — stable across `@fastify/jwt` v8→v10.
- CORS / rate-limit registration options — compatible.
- The global `setErrorHandler`, `bodyLimit`, validation, and route schemas — compatible.
- The security-headers `onSend` hook added in the previous review — compatible.

---

## Verification

### Security (the point of the PR)
```
fast-uri:               3.1.1 (vuln)  →  3.1.2 (patched)   ✅
npm audit --omit=dev (production/runtime):  found 0 vulnerabilities   ✅
Server vuln count (all):  13 (3 critical, 6 high)  →  6 (dev-only: vitest/vite/esbuild)
```
The remaining 6 are **dev-tooling only** (test runner + bundler, never shipped). They are tracked separately and do not affect the deployed artifact.

### Quality gates (all re-run after upgrade)
| Gate | Result |
|---|---|
| `server typecheck` | ✅ clean |
| `client typecheck` | ✅ clean |
| `server build` (tsc) | ✅ clean |
| `client build` (vite) | ✅ clean |
| `server test` | ✅ **264/264, exit 0** |
| `client test` | ✅ **426/426** |
| **Total** | ✅ **690/690** |

### Live runtime smoke test (Fastify 5 actually booted, not just `inject()`)
- ✅ Server boots with **zero warnings/deprecations** in the log.
- ✅ `/api/health` → `{ ok: true, schemaVersion: 8 }`
- ✅ Login → JWT issued; `/api/auth/me`, `/api/orgs` authorized correctly.
- ✅ Security headers present on responses (CSP, `nosniff`, `X-Frame-Options: DENY`).
- ✅ **SSE end-to-end:** opened `/api/orgs/:id/events/stream`, fired `/events/broadcast`, and the event was received live over the hijacked stream — confirming the `reply.hijack()` fix. The SSE request correctly produced **no** "request completed" log line (hijacked), with no errors.

---

## Follow-ups (out of scope for this PR)
1. **Dev-tooling CVEs:** upgrade `vitest` / `vite` to clear the remaining dev-only advisories.
2. **CI guard:** add `npm audit --omit=dev --audit-level=high` so new *runtime* CVEs fail the build.
3. Consider nonce-based CSP (drop `'unsafe-inline'` for styles) once Tailwind v4 styling injection is finalized.
