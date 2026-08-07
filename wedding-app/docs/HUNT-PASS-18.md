# HUNT-PASS-18 — Role-matrix RBAC sweep: staff/planner were locked out of the whole app

**Cycle:** Clean Cycle #2 · **Date:** 2026-08-07 · **Status:** verified, pushed to all 4 branches

---

## Finding & fix (one root class, three layers)

### Symptom
The role matrix had NO e2e coverage for planner/staff (only owner/manager/couple were
exercised). Adding it immediately exposed a show-stopper: **staff and planner accounts
were locked out of the entire authenticated app** — even the dashboard rendered
"Dashboard — Access Restricted".

### Root cause (3 layers of the same bug class)
1. **Client permission resolution depended on a query the role couldn't make.**
   `usePermission()`/`usePermissionGate()`/`usePermissions()` resolved role grants by
   fetching `GET /api/orgs/:orgId/roles` — which requires `roles.view`. Staff does not
   hold `roles.view`, so the query 403'd and the role map stayed EMPTY → every gate
   denied → every surface AccessRestricted.
2. **Stale-memo bug**: the hooks' `useMemo` deps only included `roleMap`/`permissionId`,
   never `_ctx.memberships`, so a fallback path could not recompute when the context
   changed.
3. **Event page fired a query the caller can't make**: `EventDetail`'s OverviewTab fired
   `GET /api/events/:id/couple-invitations` whenever the user had the
   `events.members.invite` permission — but the server additionally requires an
   **owner/admin/manager** org membership (`isVenueOwnerOrManager`), so planners got a
   403 console error on every event page. (And `isVenueOwnerOrManager` excluded `admin`,
   so even admins — who hold every permission except `org.manage` — were blocked from
   couple invites, an RBAC inconsistency.)

### Fixes
**Server**
- `middleware/auth.ts`: every membership in `/api/auth/me` (and the JWT-session auth
  payload) now embeds its **effective permission ids** (`permissions: string[]`).
- `routes/roles.ts`: `isVenueOwnerOrManager` now includes `admin` (owner/admin/manager
  = the venue-management tier). Team-invitation POST returns the invite `token` in E2E
  mode so specs register through the REAL invite flow (joining the venue org without
  self-creating an org — the previous spec pattern gave every member their own org and
  made the app pick the wrong context).

**Client**
- `lib/usePermission.ts`: permission checks resolve from the embedded membership
  permissions first; the roles query is skipped entirely when every membership carries
  its permissions (no more 403 noise / empty-map lockdown for staff). Fixed the stale
  memo by including `memberships` in the memo deps.
- `screens/events/EventDetail.tsx` + `eventDetailPanels.tsx`: split the overview gates to
  mirror the server exactly —
  - `canInviteCouple` (permission `events.members.invite`; planner included): final-review
    readiness card, publish couple update, day-of contact, acknowledgments, live ops,
    change-requests card.
  - `canManageCoupleInvites` (permission **and** owner/admin/manager org membership):
    the invite card + `couple-invitations` query only.
  - `canStageTransition` (`events.stage.transition`): stage selector + final-review
    Confirm/Reopen buttons.
  - `canDecideFinalReview` (`events.final_review.decide`): Accept/Decline buttons.
  Planners keep the view/planning cards (server allows: `events.edit`/`events.view`)
  and lose only the owner-tier controls they would 403 on.

**Tests**
- `usePermission.test.ts` +2: embedded-membership resolution (staff-like membership
  without roles.view gets correct true/false per permission; gate allows).
- `auth.integration.test.ts` +1: admin can list + send couple invitations (was 403);
  planner still 403s on both.
- New `role-matrix.e2e.spec.ts` (+2): planner + staff register via the real team-invite
  flow; wire-level 403 probes (planner venue create, staff event/question create); UI
  asserts allowed surfaces render and owner-only surfaces show AccessDenied; zero
  console/network errors throughout (this is what caught the couple-invitations 403).

## Verification
- Server vitest: **710 passed** (95 files)
- Client vitest: **1010 passed** (145 files)
- e2e: **60 passed** (58 prior + 2 role-matrix)
- tsc clean; server restarted on :3000; tree clean after push; 4 branches pinned
