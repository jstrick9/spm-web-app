# Systematic Hunt Pass 14 — Same snake/camel Bug Class in Access Control + Admin Contacts

**Date:** 2026-08-07

## Bugs found & fixed

The members API returns raw `organization_memberships` rows (`user_id`,
`role_id`, `full_name`, `role_name`, `role_key`), but two more screens read
camelCase — the same class of bug that had broken staff shift scheduling
(HUNT-PASS-13):

### 1. Access Control Manager (`screens/catalog/managers/AccessControlManager.tsx`)
- `m.userId` → undefined for every member: **role changes and removals
  sent `userId: undefined`** → the server's `/members/:userId` route
  404'd. (The `user_id || userId` fix landed mid-pass; the e2e proves the
  mutation now succeeds.)
- `m.fullName` → undefined: rows rendered the member's email TWICE
  ("email email") instead of their name.
- `value={m.roleId}` → undefined: **every member's role dropdown displayed
  "Owner"** (the first option) regardless of their actual role — the
  matrix lied about the team's access.
- `askConfirm` message used the camelCase name too.

### 2. Manager admin escalation contacts (`screens/system/admin/adminPanels.tsx`)
- `roleName`/`roleKey` filter + `m.fullName`/`m.roleName` reads → the
  "Owner/admin escalation contacts" card filtered against undefined values;
  names fell back to emails. Now reads `role_name || roleKey` etc. — the
  card shows the real owner name and role (browser-verified).

## Tests
- `e2e/access-control.e2e.spec.ts` — invite a manager → the matrix shows
  the real name (not doubled email) → the role select displays the ACTUAL
  role (`sys_manager`) → change to Planner → server `role_id` updated.
- Browser probes verified the admin-contacts card renders the owner's real
  name.
