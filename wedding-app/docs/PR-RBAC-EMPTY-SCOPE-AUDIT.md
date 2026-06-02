# PR: Audit & fix empty-scope RBAC checks (cross-org IDOR)

**Date:** 2026-06-01
**Type:** Security fix (horizontal privilege escalation / IDOR)
**Risk:** Low — scoped checks + regression tests; full suite green

---

## Background

The earlier independent review found a cross-org IDOR in the vendor-ratings endpoints caused by an **empty RBAC scope** — `can(memberships, {}, 'perm')`. Per `lib/rbac.ts`, an empty scope `{}` matches over **all** of a user's memberships, so the check only answers *"does this user have the permission anywhere?"* — never *"...for this resource's org?"*. That review recommended auditing the whole codebase for the same class. This PR does that.

## Audit method

```
grep -rnP "(can|assertCan)\([^)]*?,\s*\{\s*\}\s*," server/src --include=*.ts   # empty-scope calls
grep -rn  "memberships\[0\]" server/src --include=*.ts                          # "first membership" org-id anti-pattern
```

**Results:**
- Vendor-ratings (2) and email-template preview — already fixed in the prior review pass.
- **`server/src/routes/messages.ts` (3 occurrences) — NEW finding, fixed here.**
- `memberships[0]` org-id stamping anti-pattern — none remaining.
- Post-fix re-scan: **zero** empty-scope `can()`/`assertCan()` calls remain in `server/src`.

---

## The vulnerability (messages.ts)

All three chat endpoints used an empty scope:

```ts
app.get ('/api/messages/:threadId',      ...) // can(memberships, {}, 'messages.view')
app.post('/api/messages/:threadId',      ...) // can(memberships, {}, 'messages.send')
app.post('/api/messages/:threadId/read', ...) // can(memberships, {}, 'messages.view')
```

Chat thread ids are formatted **`${eventId}:${category}`** (see `ChatSystem.tsx`). Because the scope was empty, **any authenticated user who has `messages.view`/`messages.send` in their own Org A could read or post to the event chat of any event in Org B** simply by targeting `GET/POST /api/messages/<otherOrgsEventId>:general`. That is a cross-tenant data leak (read) and data-integrity break (inject messages), i.e. a horizontal-privilege-escalation IDOR.

## The fix

`messages.ts` now resolves the event from the thread id and scopes the permission check to that event's org (mirroring every other event-scoped route, using `eventsRepo.orgMapForUser`):

```ts
function authorizeThread(req, threadId, permission): string {
  const eventId = threadId.split(':')[0];
  if (!eventId) throw NotFound();
  const event = eventsRepo.findById(eventId);
  if (!event) throw NotFound();
  const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
  if (!can(req.auth!.memberships, { eventId }, permission, orgMap)) throw Forbidden();
  return eventId;
}
```

- Unknown/garbage thread → **404** (was: leaked an empty list / accepted a write).
- Thread for an event in another org → **403**.
- Same-org event chat → unchanged behavior (org-level `messages.*` covers the org's events via `eventOrgMap`).

## Tests

- **New regression test** (`domain-crud.integration.test.ts`): *"blocks cross-org chat access (IDOR regression)"* — User A gets **403** reading and posting to Org B's event thread.
- **Updated existing message tests** in `coverage.integration.test.ts`, `domain-crud.integration.test.ts`, `rbac-coverage.integration.test.ts` to use real event-scoped thread ids (`${eventId}:general`) instead of synthetic ids (`thread-xyz`). These previously "passed" only because the empty-scope check let any string through — they were inadvertently asserting the buggy behavior.

## Verification

```
server typecheck: clean
server tests:     285 passed (29 files), exit 0
empty-scope re-scan: 0 remaining
```

## Note for maintainers

Add a lint guard (or a tiny test) to prevent regressions: the pattern `can(<memberships>, {}, ...)` should never appear in route handlers — every resource-by-id route must resolve the resource and scope the check to its org/event.
