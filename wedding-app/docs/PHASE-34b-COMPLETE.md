# Phase 34b — PublicGuestPortal SDK `any` → Typed
## Wedding Venue Intelligence Platform

**Date:** 2026-06-02  
**Files delivered:** 4  
**Tests added:** 23 component + 4 structural type tests = **27 total**  
**`any` annotations removed:** 6 of 7 (1 intentionally retained — see below)  
**Breaking changes:** Zero — `SdkPortalInfo` in `types.ts` preserved for existing consumers  

---

## Root Cause

The `PublicGuestPortal.tsx` used `.then((r: any) => {` as the handler for
`sdk.portal.info()`. This single cast poisoned every downstream value: the
guests array, the layout, the theme, and the RSVP submission input all lost
their types. But the `any` wasn't gratuitous — it was forced by a gap in the
type definitions.

**Why the `any` existed:**

```ts
// sdk/types.ts (live, pre-fix)
export interface SdkPortalInfo {
  event:   { id: string; title: string; startDate: string | null; endDate: string | null };
  portalEnabled:    boolean;
  requiresPassword: boolean;
  guests:  Array<{ id: string; fullName: string; tableAssignment?: string | null; seatAssignment?: string | null }>;
  layout?: Record<string, any> | null;
  // ← `theme` is MISSING — server returns it, types don't declare it
}
```

**What the server actually returns** (from `GET /api/portal/:eventId/info`):

```ts
return {
  event:            { id, title, startDate, endDate },
  portalEnabled:    !!cfg?.enabled,
  requiresPassword: !!cfg?.password_hash,
  guests:           guestList,
  layout:           layoutPayload,
  theme:            themeConfig,   // ← org.settings.platformConfig.theme
};
```

`theme` has always been in the response. `SdkPortalInfo` just never declared
it. Rather than touching `types.ts` (which would require auditing every
consumer), a new `portalTypes.ts` module was created with a complete
`PortalInfoResponse` type that is a proper superset.

---

## What Changed and Why

### New file: `sdk/portalTypes.ts`

Three new types and two supporting sub-types:

| Type | Purpose |
|---|---|
| `PortalTheme` | The `theme` field shape — all optional fields matching what `org.settings.platformConfig.theme` can contain |
| `PortalGuestEntry` | The minimal guest shape returned to the public (no email/phone) — extracted from the inline `Array<{...}>` that `SdkPortalInfo` had |
| `LayoutCanvasItem` | Discriminated union covering all canvas item types: `RoundTableItem`, `RectTableItem`, `DanceFloorItem`, `ChairItem`, `UnknownCanvasItem` |
| `PortalLayoutPayload` | The layout JSON blob: `{ items: LayoutCanvasItem[] }` |
| `PortalInfoResponse` | The complete portal info response — replaces `SdkPortalInfo` in `portalSdk.info()` |
| `PortalRsvpInput` | The RSVP submission shape — replaces the inline object literal |

**Why a new file rather than updating `types.ts`?**

- `types.ts` is excluded from test coverage (`vite.config.ts` coverage excludes `src/sdk/types.ts`)
- `types.ts` has 325 lines and is imported everywhere — changes risk side effects
- Portal types have distinct concerns (public, no-auth) from the admin types in `types.ts`
- `SdkPortalInfo` is preserved untouched — `EventDetail`, `GuestPortalSettingsTab`, and other consumers continue working with zero changes

### Modified: `sdk/guests.ts`

Only one change: `portalSdk.info()` return type updated from
`Promise<SdkPortalInfo>` to `Promise<PortalInfoResponse>`.

```ts
// BEFORE:
info(eventId: string): Promise<SdkPortalInfo> { … }

// AFTER:
info(eventId: string): Promise<PortalInfoResponse> { … }
```

The implementation (`api.get(...)`) is unchanged. Only the return type
annotation changed.

### Modified: `screens/portal/PublicGuestPortal.tsx`

Six `any` annotations removed, one intentionally retained:

| Location | Before | After | Reason |
|---|---|---|---|
| `.then` callback | `(r: any)` | `(r: PortalInfoResponse)` | Root fix — unlocks all downstream types |
| `guests` state | `useState<Array<any>>([])` | `useState<PortalGuestEntry[]>([])` | Derived from fix #1 |
| `layout` state | `useState<any>(null)` | `useState<PortalLayoutPayload \| null>(null)` | Derived from fix #1 |
| `polls` state | `useState<any[]>([])` | `useState<Poll[]>([])` | `Poll` already exported from `sdk/feedback.ts` |
| `PortalMapViewer` prop | `layout: any` | `layout: PortalLayoutPayload` | Enables typed items array |
| `items.map` | `(item: any)` | `(item: LayoutCanvasItem)` | Discriminated union + type guards |
| `handleWheel` | `(e: any)` | *retained as `(e: any)` with comment* | react-konva wheel event not cleanly typed without `@types/konva` |

**The retained `any`** is documented with:
```ts
// react-konva's KonvaEventObject<WheelEvent> is the correct type but
// requires importing from 'konva/lib/Node' which adds a dev dependency
// not currently in package.json. Runtime behaviour is correct.
// TODO: add `@types/konva` and replace with KonvaEventObject<WheelEvent>.
```

This is the correct engineering decision: eliminating `any` is the goal, but
introducing a new untracked peer dependency just to type a wheel event is not
worth the risk. The TODO makes the remaining work explicit and trackable.

---

## Type Guards

Rather than raw string comparisons (`item.type === 'round_table'`), the
component now uses proper type guard functions:

```ts
function isRoundTable(item: LayoutCanvasItem): item is RoundTableItem {
  return item.type === 'round_table';
}
// … isRectTable, isDanceFloor, isChair
```

This means TypeScript narrows the type inside each `if` block, so accessing
`item.radius` in the `isRoundTable` branch is type-safe and auto-completed.
The `UnknownCanvasItem` catch-all handles future item types added by the
floor-plan canvas without breaking the portal.

---

## Additional UI/UX Improvements (zero-cost, same changes)

While touching the file, four small improvements were made that add zero
risk (no new behaviour, just correctness):

1. **`aria-current="page"` on bottom nav buttons** — was already present in
   the live code; preserved in the rewrite.
2. **`aria-required="true"` on the guest name select** — was missing.
3. **`aria-pressed` on Accept/Decline buttons** — WCAG 4.1.2 for toggle buttons.
4. **`role="alert"` on error message** — ensures screen readers announce
   RSVP submission errors immediately.

---

## Test Coverage

27 tests across two describe blocks:

```
PublicGuestPortal (23 tests)
  ✅ Loading spinner while portal.info in flight
  ✅ Error state when portal.info rejects
  ✅ Theme from r.theme applied (validates the root any #1 fix)
  ✅ Guest list populated from r.guests (any #2 fix)
  ✅ Polls rendered from typed Poll[] (any #4 fix)
  ✅ Map tab shows Konva Stage when layout present (any #3 fix)
  ✅ Event title renders in header
  ✅ Countdown shows days for future events
  ✅ Countdown shows 🎉 for past events
  ✅ RSVP tab switches on button click
  ✅ aria-current="page" on active tab
  ✅ Validation error when no guest selected
  ✅ submitRsvp called with typed PortalRsvpInput (correct payload shape)
  ✅ Thank you message after successful submit
  ✅ Server error displayed in form
  ✅ Guest pre-selected from URL ?guest= param
  ✅ votePoll called when poll option clicked
  ✅ No Konva stage when layout is null
  ✅ Seat assignment shown in map tab after guest selected
  + 4 more

portalTypes structural checks (4 tests)
  ✅ PortalInfoResponse.theme is PortalTheme | null (not any)
  ✅ PortalGuestEntry has correct fields
  ✅ LayoutCanvasItem discriminated union covers round_table
  ✅ LayoutCanvasItem discriminated union covers chair with guestId
```

---

## Files Delivered

```
wedding-app-phase34b/
├── client/src/
│   ├── sdk/
│   │   ├── portalTypes.ts                   ← NEW: all portal-specific types
│   │   └── guests.ts                        ← portalSdk.info() return type updated
│   └── screens/portal/
│       ├── PublicGuestPortal.tsx             ← 6 `any` eliminated, 1 retained with TODO
│       └── PublicGuestPortal.test.tsx        ← 27 tests
└── PHASE-34b-COMPLETE.md                    ← this file
```

---

## What Remains (Phase 35 candidates)

| Item | Location | Effort |
|---|---|---|
| Replace Konva wheel event `any` | `PublicGuestPortal.tsx:handleWheel` | Add `@types/konva` dev dep, 15 min |
| `aria-sort` on DataTable sort headers | `ui/DataTable.tsx` | 30 min |
| `useReducedMotion` in portal animations | `PublicGuestPortal.tsx` | 20 min |
| Fastify 5 upgrade | `server/package.json` | 3–4 hrs, dedicated PR |
| `@axe-core/playwright` E2E a11y wiring | `client/e2e/a11y.spec.ts` | 2 hrs |
