# Hotfix — Sign-in 500 (`internal-error`) on legacy databases

**Date:** 2026-08-04 · **Severity:** Critical (blocks all sign-in) · **Status:** Fixed, tested, deployed

## Symptom

Any existing user (e.g. the seeded `owner@demo.local` / `wedding123`) receives
`Sign-in failed 500 internal-error` when attempting to log in. The failure
happens only on databases that were created/migrated **before** migration
0049 (`password_iterations`) was introduced.

## Root cause

```
SqliteError: no such column: password_iterations
    at Object.upgradePasswordHash (server/src/db/repos/users.ts:99:8)
    at Object.<anonymous> (server/src/routes/auth.ts:181:17)   ← rehash-on-login
```

The hardened login flow (F-11) verifies the user's legacy 120k-work-factor
hash successfully, then runs the **rehash-on-login** upgrade:
`UPDATE users SET password_iterations = ?`. On a pre-0049 database that
column does not exist, so the UPDATE throws and Fastify returns a generic
500 `internal-error`.

Contributing factors:

1. The server **never auto-migrated on boot** — `npm run migrate` was a
   manual step that deployments routinely forgot after pulling updates, so
   schema drift persisted silently.
2. The rehash upgrade sat on the login **critical path** unguarded — an
   opportunistic, non-security-critical optimization was able to turn a
   valid credential into a 500.
3. `npm run seed` had the same fragility: `usersRepo.create` also references
   `password_iterations` and would crash on a pre-0049 database.

## Fixes

| # | Change | File(s) |
|---|--------|---------|
| 1 | **Auto-migrate on boot.** `buildApp()` now applies pending migrations (idempotent via `schema_version`) before registering routes; system-role sync moved after it. A failed migration is fatal (never serve on stale schema). Existing deployments self-heal on the next restart — no manual SQL. | `server/src/index.ts` |
| 2 | **Non-fatal rehash.** The rehash-on-login upgrade is wrapped: on failure the login still succeeds, the error is logged, and an audit event `user.password.rehash.failed` is recorded for ops. | `server/src/routes/auth.ts` |
| 3 | **Seed self-healing.** `npm run seed` applies pending migrations first. | `server/src/db/seed.ts` |
| 4 | **Clearer client error.** A server-side failure during sign-in now shows "The server hit an internal error. Try again in a moment — if it persists, restart the server so pending updates finish applying." instead of the raw `internal-error` code. | `client/src/screens/auth/AuthScreen.tsx` |

## Verification

Reproduction (before): a database created with migrations 0001–0048 plus a
legacy 120k PBKDF2 user → `POST /api/auth/login` → **HTTP 500**
`{"error":"internal-error"}` with the stack above.

After the fix, same legacy database:

- Server boot logs `[migrate] applying 49 password_iterations...` and heals
  the schema automatically.
- Login returns **HTTP 200** with a valid JWT; `GET /api/auth/me` works.
- The user's password is transparently upgraded (recorded
  `password_iterations = 600000`) and audit events
  `user.login` / `user.password.rehashed` are written.
- `npm run seed` on a legacy database applies migrations and seeds cleanly.

## Regression tests

Server — `server/src/routes/auth-recovery.integration.test.ts` (3 tests):

1. Boot-time migration heals a pre-0049 schema; login succeeds and rehashes
   the password to 600k.
2. A failed rehash upgrade never blocks a valid login (fail open); the
   failure is audited as `user.password.rehash.failed`; wrong passwords
   still return 401.
3. Legacy-work-factor hashes verify at the route level until upgraded.

Client — `client/src/screens/auth/AuthScreen.test.tsx` (+1 test): a 500
during sign-in surfaces the helpful message, not the raw `internal-error`
code, and no session is established.

Full validation: server `tsc --noEmit` ✅, server vitest **490/490** ✅,
client `tsc --noEmit` ✅, client vitest **807/807** ✅, `npm run build` ✅,
bundle budgets ✅.

## Deployment note

Deploying this fix is a plain **pull + restart**: the server migrates the
database itself on boot, then rehashes every legacy password on that user's
next successful login (transparent, no session invalidation). No manual
database surgery is required. The manual `npm run migrate` step remains
available for operators who prefer to apply migrations ahead of a restart.
