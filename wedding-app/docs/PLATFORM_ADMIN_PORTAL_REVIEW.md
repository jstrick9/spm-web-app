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
| Critical | Team / role assignment | A user with member-invitation authority could potentially use the role update route to assign an `owner` or `admin` role. The organization owner could also be targeted for a role change through the generic endpoint. The UI also exposed `owner` in the generic role selector. | Privilege-escalation risk and accidental ownership-role disruption. Affects Admin Portal, Venue Portal access, audit integrity, and all role-bound APIs. | **Fixed**: backend prevents owner-role changes and restricts owner/admin assignment; generic UI selector no longer offers `owner`. |
| High | Admin Portal information architecture | Platform Studio mixes first-time venue setup, advanced venue administration, operational controls, backup guidance, diagnostics, and developer-oriented tools. Required/advanced separation is present but must be reviewed tab-by-tab for role visibility, actual persistence, and production readiness. | Owner cognitive load; risk that non-functional “advanced” controls look production-ready. | In review. |
| High | Team management | The admin UI used the legacy registered-user-only add-member endpoint even though the backend supports invitations for unregistered users. Pending invitations also had no admin-facing revocation path. | Team onboarding dead end, inaccurate admin guidance, and inability to invalidate an incorrect/obsolete invitation. | **Fixed**: Team Members now uses the invitation lifecycle, displays pending invitations, and supports auditable revocation. Role hierarchy review continues. |
| Medium | Configuration persistence | Organization/event configuration APIs persist generic JSON with size checks and audit entries. The portal needs module-level verification that each configuration editor reads/writes the same persisted fields and that defaults/empty states are understandable. | Configuration drift and confusing setup behavior. | In review. |
| High | Backup export | The Backup Manager used a browser navigation download without attaching the JWT, while the export endpoint requires bearer authentication. Authenticated admins could receive a failed download. | Backup/export non-functional in token-authenticated sessions; recovery readiness risk. | **Fixed**: export now fetches the backup with the stored JWT, creates an authenticated blob download, and shows success/error state. Restore safeguards remain under review. |
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
