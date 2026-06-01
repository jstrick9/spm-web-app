# Phase 43 · Day 1 — Code Review Issue Fixes

All 11 issues identified in the comprehensive code review (docs/CODE-REVIEW.md) have been addressed.

---

## Issues Fixed

### Security Fixes

| Issue | Severity | Fix Applied |
|---|---|---|
| **Portal Event Enumeration** | 🟡 Medium | Portal info endpoint now returns 404 if `portalEnabled` is false. Previously returned event data regardless. |
| **SSE Connection Unbounded** | 🟡 Medium | Added `MAX_SSE_CLIENTS = 1000` cap. When limit reached, oldest connection is evicted before new one is accepted. |
| **Auth Rate Limiting** | 🟡 Medium | Per-route rate limits: login 10/min, register 5/min, password-change 5/min (vs global 300/min). |
| **CORS Default** | 🟡 Low | Changed default from `true` (accept all) to `false` (reject all). Production must set `CORS_ORIGIN` env var. |
| **Event Listener Cleanup** | 🟡 Low | Audited all 12 `addEventListener` calls — all have matching `removeEventListener` in useEffect cleanup. The 2 "unmatched" are in `sw.ts` (service worker listeners are intentionally permanent). **No fix needed — false positive.** |

### Performance Fixes

| Issue | Severity | Fix Applied |
|---|---|---|
| **Webhook Concurrency** | 🟡 Medium | Added semaphore limiting concurrent outbound webhook deliveries to 5. Excess deliveries queued and processed in order. Prevents event loop exhaustion under load. |

### UX Fixes

| Issue | Severity | Fix Applied |
|---|---|---|
| **Color Contrast** | 🟡 Medium | Darkened `--color-fg-subtle` from `142 132 122` to `95 87 80` (5.2:1 ratio, passes WCAG AA). Dark mode adjusted to `155 147 155`. |
| **Destructive Actions** | 🟡 Medium | Added `window.confirm()` to 5 destructive actions: budget item delete, contract delete, gallery image delete, webhook delete, inventory item delete. |
| **Tab Overflow on Mobile** | 🟡 Medium | Added right-edge gradient fade indicator (`md:hidden`) on EventDetail tab strip to signal scrollable content. Added `scrollbar-none` for cleaner mobile UX. |
| **Complex Tables on Mobile** | 🟡 Low | Added `overflow-x-auto` wrapper to SeatingReport table for horizontal scrolling on small screens. |
| **Form Dialog Loading** | 🟡 Low | ContractFormDialog submit button now respects `formState.isSubmitting` disabled state. ESignatureDialog already had proper disabled state — no change needed. |

---

## What Was NOT Changed (By Design)

| Issue | Reason |
|---|---|
| `/api/auth/me` + `/api/auth/logout` no RBAC | Correct — every authenticated user should be able to check identity and log out |
| `sw.ts` event listeners without remove | Correct — service worker listeners are permanent by design |
| Gallery data URIs in SQLite | Infrastructure decision — requires S3/R2 provider account; noted for production |

---

## Verification

```
Server:  258 tests passing (0 failures)
Client:  426 tests passing (0 failures)
Total:   684 tests (0 regressions)
Typecheck: clean (server + client)
Build: clean (11 chunks, 2019 KiB precached)
```

---

## Files Modified

```
server/src/routes/guests.ts          # Portal 404 when disabled
server/src/routes/sse.ts             # SSE client cap at 1000
server/src/routes/auth.ts            # Per-route rate limits on login/register/password
server/src/index.ts                  # CORS default to false
server/src/webhooks/dispatcher.ts    # Webhook concurrency semaphore (max 5)
client/src/styles/tokens.css         # Color contrast fix (fg-subtle)
client/src/screens/events/EventDetail.tsx               # Tab scroll indicator
client/src/screens/events/budget/EventBudgetTab.tsx      # Delete confirmation
client/src/screens/events/contracts/EventContractsTab.tsx # Delete confirmation
client/src/screens/events/contracts/ContractFormDialog.tsx # Submit disabled state
client/src/screens/events/gallery/EventGalleryTab.tsx     # Delete confirmation
client/src/screens/events/guests/SeatingReport.tsx        # Table overflow wrapper
client/src/screens/system/IntegrationHub.tsx              # Delete confirmation
client/src/screens/system/inventory/InventoryManager.tsx  # Delete confirmation
```
