# Platform Admin Portal Review

_Status: in progress — portal/module review began 2026-07-31._

## Scope

This review covers platform-wide administration plus Seven Paths Manor owner/admin configuration surfaces currently exposed through **Admin / Platform Studio**, Team Members, configuration APIs, change requests, backup/restore guidance, audit and diagnostic tooling.

## Review method

- Trace UI entry points and role-based navigation.
- Verify server authorization independently of UI gates.
- Check API/UI contracts, empty/error states, destructive actions, and audit effects.
- Record affected downstream portals/modules.
- Fix validated issues as found in scoped commits.

## Findings and remediation log

| Priority | Area | Finding | Impact | Status |
|---|---|---|---|---|
| Critical | Team / role assignment | A user with member-invitation authority could potentially use the role update route to assign an `owner` or `admin` role. The organization owner could also be targeted for a role change through the generic endpoint. | Privilege-escalation risk and accidental ownership-role disruption. Affects Admin Portal, Venue Portal access, audit integrity, and all role-bound APIs. | **Fixed** in `0ea23a5`: owner membership role cannot be changed through the generic route; assigning owner/admin roles requires an existing owner/admin actor. |
| High | Admin Portal information architecture | Platform Studio mixes first-time venue setup, advanced venue administration, operational controls, backup guidance, diagnostics, and developer-oriented tools. Required/advanced separation is present but must be reviewed tab-by-tab for role visibility, actual persistence, and production readiness. | Owner cognitive load; risk that non-functional “advanced” controls look production-ready. | In review. |
| High | Team management | Team controls require role-by-role authorization and hierarchy validation, including invitation, role change, self-removal, owner protection, and pending-invite lifecycle. | Access governance and operational continuity. | Owner-role protection remediated; remaining behavior under review. |
| Medium | Configuration persistence | Organization/event configuration APIs persist generic JSON with size checks and audit entries. The portal needs module-level verification that each configuration editor reads/writes the same persisted fields and that defaults/empty states are understandable. | Configuration drift and confusing setup behavior. | In review. |
| Medium | Backup / restore | The admin surface includes backup/restore guidance and export functions. Restore capability, authorization, destructive safeguards, and operational runbook language require end-to-end review. | Data-loss / recovery risk. | Pending. |
| Medium | Advanced tooling | Diagnostics, feature flags, system health, integrations, retention, policy, notifications, approvals, and catalog tools need distinction between actionable production controls and informational/deferred surfaces. | Misleading controls and unsupported operational expectations. | Pending. |

## Immediate verified fix

### Privileged role-assignment protection

The membership role-update endpoint now:

- rejects an attempt to change the organization owner’s role;
- requires the actor to already be an owner or admin before assigning `owner` or `admin` to another member;
- retains organization scoping, role validation, audit logging, and existing role-management checks.

Validation run:

- server TypeScript typecheck;
- `roles.integration.test.ts` (17/17 passing);
- diff whitespace validation.

## Next Platform Admin review sequence

1. Team Members and invitation lifecycle
2. Role/permission preview and custom-role management
3. Organization configuration editors and persistence contracts
4. Backup/export/restore safeguards
5. System health, integrations, diagnostics, and feature controls
6. Audit, retention, policy, notification, approval, and catalog admin tools
7. Admin portal focused quality gate and regression mapping
