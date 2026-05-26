# Phase 1.1 — Dynamic RBAC + Vendor Role + Multi-Role Clarification

> Upgrade on top of Phase 1 to add: a `vendor` system role, owner/admin
> ability to create custom roles at runtime, and clarification of "can a
> user have multiple roles."

## Your three questions, answered

### Q1: Can a new user get assigned multiple roles?

**Yes, in two ways:**

1. **Across different scopes** — a user can have one membership per scope:
   - One row in `organization_memberships` per (user, org) pair
   - One row in `event_memberships` per (user, event) pair
   - Permissions are the *union* across all matching memberships

   So Mary can be an `admin` in your org AND a `couple` in her own event AND
   a `vendor` user for her catering business — all at once. The permission
   resolver sees all three memberships and grants the union.

2. **Within the same org via custom roles** — only ONE role per (user, org)
   pair. To stack permissions (e.g. "planner + finance viewer"), the admin
   creates a custom role like "Senior Planner" that grants both planner's
   permissions + the extra finance ones, then assigns Mary that custom
   role. This is the same pattern Slack, Notion, and Linear use, and it
   keeps the "what can Mary do?" question answerable with one row.

### Q2: Vendor role

Added as a new system role with these baseline permissions:
- `vendor.portal.view` — log into the vendor portal at all
- `vendor.bookings.view` — see events the vendor is booked for
- `vendor.invoices.manage` — submit/edit invoices
- `messages.send` — direct-message the venue

Vendors do NOT get `guests.view`, `layouts.view`, or any venue internals.
The integration test in `routes/roles.integration.test.ts` proves this:

```ts
it('a vendor user cannot see venue internals', async () => {
  // ...invite a user with sys_vendor role...
  expect((await authed(vendorToken, 'GET', `/api/orgs/${ownerOrg}/events`))
    .statusCode).toBe(403);
  expect((await authed(vendorToken, 'GET', `/api/orgs/${ownerOrg}/venues`))
    .statusCode).toBe(403);
});
```

Vendor users can also be linked to specific vendor records via the new
`vendors.owner_user_id` column, so when the DJ logs in we can show them
exactly the events they're booked for. The `vendor.portal.view` route +
UI come in Phase 6 (Vendor Portal).

### Q3: Owner/admin can create custom roles + assign permissions

Done. New endpoints under `/api/orgs/:orgId/roles/*`:

| Endpoint | Purpose |
|---|---|
| `GET /api/orgs/:orgId/roles/permissions` | The permission catalog (all 49 permissions, 16 categories) - feeds the role-editor UI |
| `GET /api/orgs/:orgId/roles` | List system + org-custom roles available |
| `POST /api/orgs/:orgId/roles` | Create a custom role. Supports `copyFrom` to seed from another role |
| `PATCH /api/roles/:id` | Update a custom role (system roles are immutable) |
| `DELETE /api/roles/:id` | Delete a custom role (refuses if any membership uses it) |
| `GET /api/orgs/:orgId/members` | List members with their role |
| `POST /api/orgs/:orgId/members` | Invite a user with a role |
| `PATCH /api/orgs/:orgId/members/:userId` | Change a member's role |
| `DELETE /api/orgs/:orgId/members/:userId` | Remove a member (cannot remove owner) |

All gated on `roles.view` / `roles.manage` / `org.members.invite` /
`org.members.remove` permissions, which by default are granted to:

| Permission | owner | admin | planner | couple | staff | vendor | guest |
|---|---|---|---|---|---|---|---|
| roles.view | ✅ | ✅ | ✅ | | | | |
| roles.manage | ✅ | ✅ | | | | | |
| org.members.invite | ✅ | ✅ | | | | | |
| org.members.remove | ✅ | | | | | | |

## Design decisions

| Question | Decision |
|---|---|
| Custom role scope | **Org-scoped only.** Each org defines its own custom roles, separately. |
| System role editability | **Immutable.** Admins create new roles on top, optionally copying from a system role. |
| Vendor scope | **Both org-level and event-level.** Preferred vendors get an org membership; one-offs get an event membership. |
| Multiple roles in same scope | **No** — stack via custom roles instead. Cleaner UI, single answer to "what can Mary do?" |

## Schema (v3) — what changed

```sql
CREATE TABLE roles (
  id              TEXT PRIMARY KEY,                 -- 'sys_owner' or uuid
  organization_id TEXT REFERENCES organizations(id), -- NULL for system roles
  key             TEXT NOT NULL,                    -- 'owner', 'catering-lead'
  name            TEXT NOT NULL,                    -- 'Owner', 'Catering Lead'
  description     TEXT,
  is_system       INTEGER NOT NULL DEFAULT 0,        -- 1 = cannot edit/delete
  system_kind     TEXT,                              -- 'owner', 'admin', ... or NULL
  hierarchy       INTEGER NOT NULL DEFAULT 50,
  created_by      TEXT REFERENCES users(id),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE (organization_id, key)
);

CREATE TABLE role_permissions (
  role_id       TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL,                       -- validated against PERMISSION_CATALOG
  granted_at    TEXT NOT NULL,
  PRIMARY KEY (role_id, permission_id)
);

-- Memberships now reference roles.id (not a role-string column)
organization_memberships.role_id  → roles.id   (ON DELETE RESTRICT)
event_memberships.role_id         → roles.id   (ON DELETE RESTRICT)

-- Vendor record can optionally be linked to a user account
vendors.owner_user_id  → users.id  (ON DELETE SET NULL)
```

## Test coverage

The upgrade added **17 new tests** (`src/routes/roles.integration.test.ts`)
and **8 new tests** in the rbac unit tests:

```
Test Files  6 passed
     Tests  89 passed (was 65)
  Coverage  91% lines, 62% branches
```

New tests prove:
- ✅ Catalog returns >40 permissions across all categories
- ✅ All 7 system roles seed correctly (incl. new `vendor`)
- ✅ Custom role with explicit permissions
- ✅ `copyFrom` unions copied permissions with explicit ones
- ✅ Unknown permission ids rejected with 400
- ✅ Invalid keys rejected (`Bad Key!` → 400)
- ✅ Duplicate keys in same org rejected with 409
- ✅ System roles cannot be edited (400 + `system-role-immutable`)
- ✅ System roles cannot be deleted (400)
- ✅ Custom role in use cannot be deleted (409 + `role-in-use`)
- ✅ Updating a custom role takes effect immediately (verified by re-checking
  whether a user with that role can hit a previously-403 endpoint)
- ✅ Members list returns role keys + names
- ✅ Cannot remove the org owner
- ✅ Promoting staff → planner works end-to-end
- ✅ Vendor users cannot see events or venues

## What changed at the route level

**Existing callers should NOT need changes.** The `Membership` type now
has a `roleId` field instead of `role`, but `can()`, `assertCan()`, and
`resolvePermissions()` have the same signatures.

The only client-visible change is `/api/auth/me`, where each membership
object now includes `roleKey` and `roleName` alongside `roleId`. The old
`role` field was removed (the client code in this repo wasn't using it
yet, but if you had external clients they'd need updating).

## What's coming in Phase 2

Phase 2 (front-end SDK + dual-write) will:
1. Add typed SDK methods for the new role endpoints
2. Add a "Roles & Permissions" admin tab to the UI
3. Wire the existing `useRBAC` hook in the original app (from the original
   review) to actually call these endpoints instead of localStorage

That's where the role-creation UI from the original `AccessControlPanel`
stub (the one the Phase 0 review flagged as not actually doing anything)
finally becomes real.
