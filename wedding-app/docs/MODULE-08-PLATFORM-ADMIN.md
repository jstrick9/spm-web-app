# MODULE-08 — Platform Admin: Comprehensive Review

**Scope:** `routes/{roles,platformConfig,integrations,audit}.ts`, `admin-change-requests` (in
platformConfig), health/risk/report surfaces in `routes/intelligence.ts`, `lib/permissions.ts`
(org/admin grants), client `AdminPanel` + `adminPanels` + `TeamMembers` + `AuditLog` +
`IntegrationHub` + `IntelligenceDashboard`/`AnalyticsDashboard`, App route guards, `sdk/*`.

**Review date:** 2026-08-04 · **Status:** findings fixed in this module commit (PA-01…PA-08).

---

## Module strengths

- **Roles & memberships are genuinely well-built**: system-role immutability, reserved-key
  protection, copy-from-role with cross-org denial, in-use-role deletion rejection, owner
  removal/role-change guards, owner/admin-only elevation checks, full audits on every mutation.
- **Integrations**: secrets never returned (opaque `hasSecrets`), provider schema validation,
  verify-on-write, per-org event logs, OAuth-only flow for OAuth providers.
- **Platform config**: size-capped, audited, three scopes (org/event/user), public logo endpoint
  with storage redirection.
- **Manager change-request flow** (manager → owner admin-change requests) is a thoughtful
  delegation pattern.

---

## Findings & fixes

| ID | Sev | Area | Finding | Fix |
|----|-----|------|---------|-----|
| PA-01 | **High** | Feature dead | **`platform.manage` is granted to NO system role** (only in the catalog + client route guard) and **enforced by NO server route** — so the client's `/system` AdminPanel, which is guarded by `RequirePermission('platform.manage')`, is unreachable for the owner. All admins fall into the manager-mode viewer instead. | Grant `platform.manage` to owner (+admin) in system roles; client `AdminPanel` manager-mode detection stays based on the actual permission (`roles.manage`), so owners see the full studio. |
| PA-02 | **Med** | Authorization | **`audit.view`, `integrations.view`, `reports.view` granted to the manager role** — but the underlying admin surfaces (audit log, integration hub, analytics dashboards) are reachable. The manager's own description says "…without owner-level admin powers", and FI-11 established the finance-escalation pattern; broad read access to **every org's audit trail + integrations + revenue analytics** is an owner/admin-level capability. | Remove `audit.view`/`integrations.view`/`reports.view` from the manager role; keep them owner/admin (+ planner retains `reports.view` for planning analytics per its role). Client side uses the permission hooks, so the surfaces disappear for managers automatically. |
| PA-03 | **Med** | RBAC | **`org.settings.manage` is granted to no role** except via `ALL_INTERNAL_PERMISSIONS` (owner/admin) — but the manager's AdminPanel renders `AdminConfigurationManager` (org config PUT) which would 403 for managers; the manager viewer still renders config editors. | Client manager-mode: only render config editors the manager can actually write; the settings PUT stays owner/admin. |
| PA-04 | **Med** | Governance | **Owner-change-request queue is rendered for the owner, but a MANAGER can create change requests targeting the owner and the owner queue doesn't show an "in review" distinction** — minor, but the bigger gap: nothing prevents a **manager** from approving change requests (the `admin-change-requests` PATCH is `roles.manage` = owner/admin only ✓, but the UI's `OwnerChangeRequestQueue` renders approve/reject buttons to anyone with the config viewer). | Gate the owner-queue decision buttons with `isOwner` (org.manage) in the client. |
| PA-05 | **Med** | API | **Audit log GET is a fixed 200-row cap with no paging or filtering beyond action** — the audit surface can't review history at scale, and `Number(limit)` accepts negatives/NaN. | Validate limit (1–1000, default 200); add `before`/`after`/`actorEmail` filters + `total` + `nextBefore` paging token. |
| PA-06 | **Low** | Admin | **BackupManager's restore card is aspirational copy** — the download itself is real (`GET /api/orgs/:orgId/export/backup.json` exists and is wired). Restore is deliberately not a web action (file-system + migrate). | Documented as such; the export endpoint verified + covered by existing exports tests. |
| PA-07 | **Low** | API | **`/api/orgs/:orgId/config` GET uses `org.view`, but event-level config PUT asserts org-level `events.edit` without `orgMap`** — event-scoped planners with `events.edit` can't write event config. | Use `{eventId}` scope + orgMap (same pattern as all prior modules). |
| PA-08 | **Low** | Consistency | `GET /api/orgs/:orgId/integrations` uses `org.view` while every other integration endpoint uses `integrations.view`/`org.settings.manage` — inconsistent read gate. | Align to `integrations.view`. |

---

## Verification & regression tests

Server — new `routes/platform-admin-module.integration.test.ts` (+ rbac-coverage updates):

1. `platform.manage` granted to owner/admin, not manager (PA-01); manager loses
   `audit.view`/`integrations.view`/`reports.view` (PA-02); `org.settings.manage` owner/admin-only
   (PA-03).
2. Event-scoped planner can PUT event config (PA-07).
3. Audit GET: negative/huge limit → 400; filters + paging work (PA-05).
4. Integration list requires `integrations.view` (PA-08).

Client — `AdminPanel.test.tsx` (owner sees full studio; manager sees viewer + no owner-queue decision
buttons), `useRealtimeInvalidation` unchanged. Full suites re-run.

**Validation:** server `tsc --noEmit` ✅ · server vitest **529/529** ✅ · client `tsc --noEmit` ✅ ·
client vitest **821/821** ✅ · `npm run build` + bundle budgets ✅. (Existing integrations test updated for
the new manager gate; rbac-coverage extended with the platform-admin split.)

---

## Affected modules / follow-ups

- **All venue roles** — removing `audit.view`/`integrations.view`/`reports.view` from manager
  tightens the blast radius of a compromised manager account (audit trails + payment integrations +
  revenue forecasts now owner/admin-only).
- **Integrations/Intelligence (next module)** — integration hub + analytics surfaces now sit behind
  the corrected permissions; the OAuth flows remain unchanged.
- **Security & Ops (later module)** — the audit-log paging (PA-05) becomes the basis for the ops
  runbook's log-review section; BackupManager restore stays an ops-runbook action.
- **Deferred:** org-level pagination for members list; admin-change-request "in review" status
  lifecycle; platform-level (cross-org) admin console for a true SaaS deployment.
