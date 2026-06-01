# Phase 22 · Day 1 — Themed Guest Portal, Server-Synced Vendor Comms & Real Roles Matrix

Three deliverables focused on eliminating the last visual "mock data" patterns and integrating the theme system into the most customer-facing surface.

---

## 1. Public Guest Portal — Theme Integration

The guest portal (the page couples send to their wedding guests) was using 26 hardcoded hex color values (`#2c3e2e`, `#e1d5c9`, `#fdfbf7`). Now it reads the org's configured theme and applies it to every surface.

### How It Works
1. The `GET /api/portal/:eventId/info` endpoint now returns the org's `theme` config alongside event data (no auth needed — it's a public endpoint)
2. The portal reads `r.theme` from the response and builds a palette
3. All 26 hardcoded hex colors are replaced with palette variables
4. If no theme is configured, the elegant warm default (`#fdfbf7` bg, `#2c3e2e` text) is used

### What's Themed
- Background, surface, and border colors
- Primary action buttons (RSVP, View Map, Find Invitation)
- Poll option buttons and vote badges
- Form inputs (selects, textareas)
- Bottom navigation active/inactive states
- Hero banner background
- Card borders throughout

### Server Changes
- `GET /api/portal/:eventId/info` now includes:
  - `theme` — the org's platformConfig.theme object (or null)
  - `layout` — the event's floor plan layout (was already included but now explicit)

### Result
When a venue owner applies the "Coastal Navy" preset in Platform Studio, every guest portal across their events instantly reskins to the navy+sand palette — no per-event configuration needed.

---

## 2. Vendor Communications Hub — Server Messages

The Vendor Communications Hub was using hardcoded mock messages ("Hi, confirming load in times." / "Confirmed. Doors open at 10 AM."). Now it reads from and writes to the server's `direct_messages` table.

### Changes
- **Load**: `GET /api/messages/vendor:{eventId}:{vendorId}` on vendor selection
- **Send (direct)**: `POST /api/messages/vendor:{eventId}:{vendorId}` with body + senderRole
- **Send (broadcast)**: POSTs to every vendor thread simultaneously
- **Optimistic UI**: Messages appear instantly before server confirmation
- **Empty state**: "No messages yet. Start the conversation!" instead of fake messages
- **Template macros** still work (Request COI, Confirm Load-in, Arrival Instructions)

### Tests: 3 tests (vendor list render, broadcast mode switch, empty state)

---

## 3. Admin Panel Roles Matrix — Real Permission Data

The roles permission matrix in System → Admin was using `Math.random() > 0.5` to randomly decide which checkmarks to show. Now it reads the actual `role.permissions` array from the backend.

### Change
```diff
- const hasPerm = isOwner || isAdmin || Math.random() > 0.5; // Demo distribution
+ const hasPerm = r.permissions?.includes(p.id) ?? false;
```

The matrix now shows the **real** permission grants: Owner has everything, Admin has everything minus `org.manage`, Staff has only their specific subset, Guest has only `rsvp.submit` + `portal.guest.view`, etc.

---

## Test Summary

| | Phase 21 | **Phase 22** | Δ |
|---|---|---|---|
| Server tests | 189 | **189** | 0 |
| Client tests | 316 | **318** | **+2** |
| **Total** | **505** | **507** | **+2** |
| Typecheck | clean | clean | — |
| Build | clean | clean | — |

---

## Files Modified

```
server/src/routes/guests.ts                              # Portal info now includes theme + layout
client/src/screens/portal/PublicGuestPortal.tsx           # Rewritten: 26 hardcoded hex → themed palette
client/src/screens/events/vendors/hub/VendorCommunicationsHub.tsx  # Rewritten: server messages API
client/src/screens/events/vendors/hub/VendorCommunicationsHub.test.tsx  # Updated for server API mocks
client/src/screens/system/admin/AdminPanel.tsx            # Math.random() → real permissions check
```

---

## How to Evaluate

```bash
cd wedding-app
npm run dev:server   # terminal 1
npm run dev:client   # terminal 2
```

1. **Themed Portal**: Open Platform Studio → apply "Coastal Navy" preset → open any event's guest portal (View Guest Portal button). The entire portal — header, buttons, forms, bottom nav — renders in the navy+sand palette instead of the default green+cream.

2. **Vendor Comms**: Open event → Vendors tab → scroll to Communications Hub. Select a vendor. The message area shows "No messages yet" (not fake mock messages). Type a message, send it. It persists to the server. Refresh — the message is still there.

3. **Roles Matrix**: Go to System → Admin → Permissions tab. The checkmark matrix now shows **real** role grants. Owner row is all checked. Guest row has only 2 checkmarks (rsvp.submit + portal.guest.view). Staff has their specific subset. No more random distribution.
