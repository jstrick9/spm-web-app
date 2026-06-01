# Phase 44 · Day 1 — Code Review Issues Fixed (Round 2)

All remaining issues from the comprehensive code review have been addressed.

---

## Security Fixes

### S-1: Unhandled Promise Rejections (5 → 0)
| File | Fix |
|---|---|
| `PlatformStudio.tsx` | Added `.catch(() => {})` to config fetch |
| `EventContractsTab.tsx` (create) | Added `.catch(() => toast({...}))` |
| `EventContractsTab.tsx` (sign) | Added `.catch(() => toast({...}))` |
| `PublicGuestPortal.tsx` | Already had `.catch()` — confirmed safe |
| `React.lazy` import | Handled by Suspense error boundary — safe |

### S-4: SSE Token Exposure
**Before**: Full 12h JWT sent as query parameter in SSE URL, visible in server logs and browser history.

**After**: New `/api/orgs/:orgId/sse-token` endpoint issues a **5-minute** short-lived JWT specifically for SSE connections. The SSE client now:
1. Fetches a 5-min token via authenticated API call
2. Uses that short-lived token in the EventSource URL
3. If token fetch fails, degrades gracefully (no SSE, app still works)

---

## Performance Fixes

### P-1: N+1 Query in Backup Export
**Before**: For N events, ran 2*N queries (budget items + totals per event).

**After**: Added `budgetRepo.listForOrg(orgId)` — single query returning all budget items across the org. Backup export now uses 2 bulk queries instead of 200+ individual ones.

### P-2: Gallery File Storage
**Before**: Images stored as base64 data URIs in SQLite (`gallery_images.url` column). A 5MB image = 6.7MB of base64 text in the database.

**After**: 
- New `lib/fileStorage.ts` with `saveDataUri()` and `deleteFile()` utilities
- Gallery upload route now saves files to `uploads/` directory on disk
- Returns URL path (`/uploads/gallery_abc123.jpeg`) instead of data URI
- Server serves the uploads directory via `fastify-static`
- Delete handler cleans up the file from disk
- **Backward compatible**: existing data URIs still work (function returns them as-is if not a data URI)

---

## Code Quality Fixes

### C-1: App.tsx Split (588 → 377 lines, -36%)
| Extracted Component | New File | Lines |
|---|---|---|
| `DashboardScreen` + `EventPipelineSummary` | `screens/dashboard/DashboardScreen.tsx` | ~140 |
| `AuthScreen` | `screens/auth/AuthScreen.tsx` | ~80 |

App.tsx is now focused on routing, providers, and keyboard shortcuts.

### Keyboard Shortcuts Discovery UI
New `KeyboardShortcutsDialog` component showing all available shortcuts:
- ⌘K — Command palette
- ⌘N — Create event
- ⌘/ — Show keyboard shortcuts
- Esc — Close dialogs
- Tab — Navigate fields
- Enter — Submit/confirm

Accessible via:
- Keyboard: ⌘/ (Ctrl+/)
- User menu: "Keyboard Shortcuts" option

---

## Verification

```
Server:  258/258 tests passing
Client:  426/426 tests passing  
Total:   684/684 (0 regressions)
Typecheck: clean
Build: clean (11 chunks)
```

---

## Files Added (4)

```
server/src/lib/fileStorage.ts                        # File upload/delete utilities
client/src/ui/KeyboardShortcutsDialog.tsx             # Shortcuts help dialog
client/src/screens/dashboard/DashboardScreen.tsx       # Extracted from App.tsx
client/src/screens/auth/AuthScreen.tsx                 # Extracted from App.tsx
```

## Files Modified (9)

```
server/src/routes/sse.ts               # SSE short-lived token endpoint
server/src/routes/exports.ts           # N+1 fix — bulk queries
server/src/routes/gallery.ts           # File storage instead of data URI
server/src/routes/auth.ts              # (already had rate limits from Phase 43)
server/src/db/repos/budget.ts          # listForOrg() method
server/src/index.ts                    # Serve uploads directory
client/src/sdk/sse.ts                  # Fetch short-lived SSE token
client/src/App.tsx                     # Split + keyboard shortcuts
client/src/ui/AppShell.tsx             # Keyboard shortcuts in user menu
client/src/screens/events/contracts/EventContractsTab.tsx  # .catch() handlers
client/src/screens/PlatformStudio.tsx  # .catch() handler
client/src/styles/tokens.css           # (already fixed in Phase 43)
```
