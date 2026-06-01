# Phase 21 · Day 1 — Contracts, Inventory & Gallery Backends (Zero Mock Data Remaining)

Phase 21 eliminates the last three modules using hardcoded `useState` mock data by building complete server backends (schemas, repos, RBAC-gated routes, SDKs, rewritten UIs, and tests).

---

## 1. Contracts Backend + UI

### Before
```typescript
// EventContractsTab.tsx — BEFORE
const [contracts, setContracts] = useState<MockContract[]>([
  { id: 'c1', title: 'Master Venue Agreement', status: 'signed', ... },
  { id: 'c2', title: 'Catering Addendum', status: 'sent', ... },
]);
```

### After
Full server lifecycle: Draft → Sent → Signed (with e-signature)

**Database**: `contracts` table with id, event_id, title, status, recipient, amount, content, sent_at, signed_at, signature, signer_ip

**API** (6 endpoints, all RBAC-gated):
| Method | URL | Permission |
|---|---|---|
| GET | `/api/events/:eventId/contracts` | `contracts.view` |
| POST | `/api/events/:eventId/contracts` | `contracts.manage` |
| PATCH | `/api/contracts/:id` | `contracts.manage` |
| POST | `/api/contracts/:id/send` | `contracts.manage` |
| POST | `/api/contracts/:id/sign` | `contracts.sign` |
| DELETE | `/api/contracts/:id` | `contracts.manage` |

**UI Features**: KPI tiles (Active/Pending/Executed/Total Value), status badges, Send/Sign/Print/Delete actions, RBAC-gated buttons

---

## 2. Inventory Backend + UI

### Before
```typescript
// InventoryManager.tsx — BEFORE
const [items, setItems] = useState<InventoryItem[]>([
  { id: 'inv1', sku: 'CHR-CHIAVARI-GLD', name: 'Gold Chiavari Chair', ... },
  // 3 more hardcoded items
]);
```

### After
**Database**: `inventory_items` table with sku, name, category (7 types), total_count, available_count, condition, owner_type

**API** (4 endpoints):
| Method | URL | Permission |
|---|---|---|
| GET | `/api/orgs/:orgId/inventory` | `inventory.view` |
| POST | `/api/orgs/:orgId/inventory` | `inventory.manage` |
| PATCH | `/api/inventory/:id` | `inventory.manage` |
| DELETE | `/api/inventory/:id` | `inventory.manage` |

**Features**: KPI tiles (Total/Low Stock/Maintenance), low-stock alert banner, search by name/SKU, Add Item dialog with category dropdown, condition badges, delete

---

## 3. Gallery Backend + UI

### Before
```typescript
// EventGalleryTab.tsx — BEFORE
// Local state mocking the DB for now (since we don't have a real file backend yet)
const [images, setImages] = useState<GalleryImage[]>([]);
```

### After
**Database**: `gallery_images` table with filename, url (data URI), category (7 types), caption, sort_order

**API** (4 endpoints):
| Method | URL | Permission |
|---|---|---|
| GET | `/api/events/:eventId/gallery` | `gallery.view` |
| POST | `/api/events/:eventId/gallery` | `gallery.manage` |
| PATCH | `/api/gallery/:id` | `gallery.manage` |
| DELETE | `/api/gallery/:id` | `gallery.manage` |

**Features**: Category filter chips with counts, image grid with hover actions (expand, delete, recategorize), full-screen lightbox, file upload via HTML5 FileReader → data URI, RBAC-gated upload/delete

**Note**: Images are stored as base64 data URIs in SQLite. For production scale, swap the `url` field for S3/blob storage paths — the API shape stays identical.

---

## Mock Data Elimination Summary

| Module | Phase 17 (mock) | Phase 21 (real) |
|---|---|---|
| **Contracts** | `useState<MockContract[]>` with 2 hardcoded contracts | Full DB lifecycle: draft→sent→signed with e-signatures |
| **Inventory** | `useState` with 4 hardcoded items | Real DB with CRUD, stats, low-stock alerts |
| **Gallery** | `useState` with local blob handling | Real DB with category filters, server persistence |
| **Budget** | `useState` with 4 hardcoded line items | *(Fixed in Phase 20)* |
| **Notifications** | 3 hardcoded mock notifications | *(Fixed in Phase 20 — SSE-driven)* |
| **Integration Hub** | Mock "active connections" | *(Fixed in Phase 20 — real webhook management)* |

**Result: Zero mock/simulated data remains in any production module.**

---

## Test Summary

| | Phase 20 | **Phase 21** | Δ |
|---|---|---|---|
| Server tests | 183 | **189** | **+6** |
| Client tests | 308 | **316** | **+8** |
| **Total** | **491** | **505** | **+14** |
| Typecheck | clean | clean | — |
| Build | clean | clean | — |

---

## Files Added (12)

```
server/src/db/migrations/0006_contracts_inventory_gallery.sql
server/src/db/repos/contracts.ts
server/src/db/repos/inventory.ts
server/src/db/repos/gallery.ts
server/src/routes/contracts.ts          # 6 RBAC-gated endpoints
server/src/routes/inventory.ts          # 4 RBAC-gated endpoints
server/src/routes/gallery.ts            # 4 RBAC-gated endpoints
server/src/routes/contracts-inventory-gallery.integration.test.ts  # 6 integration tests
client/src/sdk/contracts.ts
client/src/sdk/inventory.ts
client/src/sdk/gallery.ts
docs/PHASE-21-DAY-1.md
```

## Files Modified (6)

```
server/src/db/repos/index.ts     # +3 repo exports
server/src/index.ts              # +3 route registrations
client/src/sdk/index.ts          # +3 SDK exports (cleaned up duplicates)
client/src/screens/events/contracts/EventContractsTab.tsx   # Rewritten: real server data
client/src/screens/system/inventory/InventoryManager.tsx     # Rewritten: real server data
client/src/screens/events/gallery/EventGalleryTab.tsx        # Rewritten: real server data
```
