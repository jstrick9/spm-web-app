# Module 04 — Venue Studio & Layouts (Spaces, Scaffolds, Templates, Inventory Reservations, Layout Approval)

**Reviewed:** 2026-08-04
**Surface:** `routes/{venues,layouts,catalog,inventory}.ts`, `db/repos/{venues,layouts,layoutOps,layoutCollaboration,inventory,catalog}.ts`, `sdk/{venues,layouts,catalog,inventory}.ts`, `VenueBuilder`, `VenueSpaceScaffoldWizard`, `CanvasPage` + `canvasSections`, `layoutOpsModel`, `InventoryManager`, `SpaceCalendarGrid`, `eventsListPanels` (space calendar), `useRealtimeInvalidation`
**Affected modules:** couple hub (layout review), SSE/realtime, inventory availability, audit log, event readiness

---

## 1. Bugs (fixed in this pass)

| ID | Sev | Finding | Fix |
|---|---|---|---|
| VS-01 | High | **Couples/planners (event-only members) get 403 on layout endpoints.** `GET /api/orgs/:orgId/layouts`, `/versions`, `/collaboration`, `/revision-comparison`, `/ops`, and the `requireLayoutAccess` helper all check org-scope permissions WITHOUT the `eventOrgMap` — so event memberships never match (verified: LIST/VERSIONS/COLLAB all 403 for a couple). The CoupleEventHub's layout review silently breaks. | Every layout endpoint now passes `eventsRepo.orgMapForUser(...)` so event-scoped members with layouts.view can access their event's layouts. |
| VS-02 | High | **Deleting a layout leaks reserved inventory forever.** `DELETE /api/layouts/:id` hard-deletes; the cascade removes `layout_inventory_reservations` rows but never restores `available_count` on the inventory items — reserved stock is permanently lost from availability. Also completely unaudited. | Delete now releases reservations (restores availability) inside a transaction, audits the delete, and guards the audit trail. |
| VS-03 | Med | **Approved layouts aren't locked server-side.** Anyone with `layouts.edit` can `POST /api/layouts/:id/save` on an approved layout, silently mutating the operational plan while `approval_status` stays `approved` — bypassing the reopen flow (blueprint: approved layouts lock; changes go through reopen). | Save on an approved layout is rejected with `403 layout-approved-locked` for non-publishers; venue staff with `layouts.publish` may still edit (matches the client's edit gating). |
| VS-04 | Med | **No realtime on layout save/create.** Canvas saves don't broadcast SSE, so a second venue device/venue-couple review sees stale layouts until manual refresh. | `POST /api/layouts` + `/save` now broadcast `layout.updated`; `useRealtimeInvalidation` maps it to invalidating `['layouts']`. |
| VS-05 | Med | **Venue space lifecycle is unaudited.** `PATCH /api/venues/:id` (including approval — a major operational decision), scaffold save, underlay upload, event-layout instantiation, and venue delete all write no audit entries. | Audit entries added for each. |
| VS-06 | Low-Med | **Public layout-packet endpoint has no rate limit** (every other public endpoint is limited). | Added `rateLimit: max 30/min`. |
| VS-07 | Low | **Approval queue duplicates rows** when a layout has multiple pending review requests (LEFT JOIN multiplier). | Replaced the join with a correlated subquery for the requester email. |

## 2. Verified-working (no change needed)

- Scaffold → event-layout instantiation (approved scaffolds only, revision stamped on the payload), draft → approved lifecycle with zone-readiness gate + override reason, revision snapshots (`venue_space_versions`), underlay lock/opacity/rotation + PDF source retention.
- Inventory reservation math (delta vs `available_count`, release-on-change, manager override with reason + audit + revision note), shared-inventory same-day conflict review, deletion protection while reservations exist.
- Layout revisioning with optimistic concurrency (`revision-conflict` 409), versions, revision-comparison against the last approved review.
- Reopen flow: reopen-request → venue accept → new draft revision; review requests/decisions with SSE + recipient targeting; floor-walk checks, variance evidence (private photo storage + capability assets), rain-plan activations, setup packets (hashed tokens, expiry, revocation, public fetch).
- Venue space-conflict guard + capacity-overrun flags in the space calendar; rain-plan alternate-space workflow.

## 3. Improvements & notes (documented)

1. **Hard layout delete is intentional** (draft junk cleanup), but approved layouts are now protected by the save lock — consider soft-delete + archive for approved layouts in a future pass.
2. **Inventory `available_count` is a denormalized ledger** — the release-on-delete fix keeps it consistent; a future reconciliation job (`available = total - Σ reservations`) would self-heal any drift.
3. **Template catalog integrity** (templates referencing venue scaffolds via `spec.venueId`) is validated at apply-time — the admin bulk replace (`PUT catalog/:kind`) can orphan a template's venue reference; apply already returns a clean 404, so no action taken.

## 4. Regression coverage added

- `server/src/routes/layouts-module.integration.test.ts` — 6 tests: couple event-scoped access to layouts list/versions/collaboration; layout delete releases inventory availability + audits; save on approved layout blocked for editor / allowed for publisher; approval queue dedupes with multiple pending reviews; layout save broadcasts `layout.updated` SSE; venue scaffold save + approval audit.
- `lib/permissions.ts` — planner role no longer grants `layouts.publish` (final layout approval is venue-owned); `rbac-coverage` + `roles` copyFrom tests updated to assert the new contract.
- Client: `useRealtimeInvalidation` `layout.updated` mapping verified via existing SSE suite.
- Full suites re-run green (see §5).

## 5. Post-fix validation

- Server: typecheck clean, **487 tests passing** (69 files).
- Client: typecheck clean, **806 tests passing** (125 files).
- Production build + bundle budgets green (main 192 KB).
