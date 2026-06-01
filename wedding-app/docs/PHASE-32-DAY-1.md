# Phase 32 · Day 1 — README Rewrite, Accessibility, Code Splitting, Duplicate Events & Server Hardening

Five deliverables focused on production polish, documentation, and developer experience.

---

## 1. README Rewrite

The README was still referencing "POC" and describing 5 guests + 1 event. Now it accurately documents the complete platform:

- Full feature list (17 modules for venue owners, 4 for couples, 2 for vendors, 14 admin features)
- Architecture diagram (React + Fastify + SQLite stack)
- Database schema overview (44 tables by domain)
- Test suite summary (640 tests)
- Environment variable reference table
- Production deployment instructions (Docker + direct)
- Development quick start
- Phase history summary (31 phases)

---

## 2. Accessibility: Skip-to-Content

**Added:**
- Skip-to-content link at the top of the AppShell (visible only on keyboard focus)
- `id="main-content"` on the `<main>` element
- Styled with `sr-only focus:not-sr-only` pattern — invisible until Tab key press

This satisfies WCAG 2.1 SC 2.4.1 (Bypass Blocks) — screen reader and keyboard users can skip the navigation sidebar and jump directly to page content.

---

## 3. Code Splitting

**Before:** UiPreview (dev-only styleguide with all components) was bundled in the main chunk.

**After:** `React.lazy()` + `<Suspense>` for UiPreview. This creates a separate chunk that's only loaded when navigating to `#/preview`.

**Build result:** `precache 6 entries` (was 5) — the lazy chunk is automatically precached by the service worker for offline access.

---

## 4. Duplicate Event (Copy as Template)

Venue owners can now create a copy of any event as a starting point for a new one:

**Server:** `POST /api/events/:eventId/duplicate`
- Copies: title (with " (Copy)" suffix), dates, guest count, budget
- Sets status to "lead" (start of pipeline)
- RBAC-gated: requires `events.create` permission
- Audit logged with source event reference
- SSE broadcast: `event.created`

**Client SDK:** `sdk.events.duplicate(eventId)`

**Tests:** 2 integration tests (successful duplicate, 404 for non-existent)

---

## 5. Environment Documentation

New `.env.example` file documenting all environment variables:
- PORT, HOST, NODE_ENV
- JWT_SECRET (required in production)
- CORS_ORIGIN
- LOG_LEVEL
- VAPID keys (for WebPush)
- WEDDING_SECRETS_KEY (for integration credential encryption)

---

## 6. Server Hardening

- **bodyLimit: 2MB** — prevents oversized request payloads from crashing the server (added in Phase 31, now documented)

---

## Test Summary

| | Phase 31 | **Phase 32** | Δ |
|---|---|---|---|
| Server tests | 234 | **236** | **+2** |
| Client tests | 406 | **406** | 0 |
| **Total** | **640** | **642** | **+2** |
| Typecheck | clean | clean | — |
| Build | clean | clean | — |

---

## Files Added (3)

```
.env.example                                    # Environment variable reference
docs/PHASE-32-DAY-1.md                          # This file
```

## Files Modified (5)

```
README.md                                       # Complete rewrite
client/src/App.tsx                              # Code splitting (React.lazy for UiPreview)
client/src/ui/AppShell.tsx                      # Skip-to-content link + main id
server/src/routes/events.ts                     # POST /events/:id/duplicate endpoint
client/src/sdk/events.ts                        # sdk.events.duplicate() method
server/src/routes/domain-crud.integration.test.ts  # +2 duplicate tests
```

---

## Platform Statistics (32 Phases)

| Category | Count |
|---|---|
| Database tables | 44 |
| API endpoints | **73+** |
| RBAC permissions | 71 |
| **Total tests** | **642** |
| Test files | 108 |
| Phases | 32 |
| Documentation | 73 files |
| Code-split chunks | 6 (was 5) |
| WCAG compliance | Skip-to-content ✅ |
