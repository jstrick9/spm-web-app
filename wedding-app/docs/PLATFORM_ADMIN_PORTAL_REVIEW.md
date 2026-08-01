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
| High | Admin Portal information architecture | Platform Studio mixes first-time venue setup, advanced venue administration, operational controls, backup guidance, diagnostics, and developer-oriented tools. Required/advanced separation is present but must be reviewed tab-by-tab for role visibility, actual persistence, and production readiness. Manager-mode presentation previously depended solely on a local-storage onboarding hint. Platform Studio could retain a stale active preview banner after committing a theme. | Owner cognitive load; stale role/preview presentation risk; risk that non-functional “advanced” controls look production-ready. | **Improved**: Admin Panel now prefers authenticated membership role data once loaded, retaining local onboarding fallback only while identity is unresolved. Committed themes now clear preview state after save. Broader tab-by-tab review continues. |
| High | Team management | The admin UI used the legacy registered-user-only add-member endpoint even though the backend supports invitations for unregistered users. Pending invitations also had no admin-facing revocation path. | Team onboarding dead end, inaccurate admin guidance, and inability to invalidate an incorrect/obsolete invitation. | **Fixed**: Team Members now uses the invitation lifecycle, displays pending invitations, and supports auditable revocation. Role hierarchy review continues. |
| Critical | Custom role administration | Custom roles could reuse a reserved system role key such as `admin`. Many role-sensitive workflows use role keys as semantic checks, so collision could create misleading or unintended role behavior. | Role-key confusion and potential privilege/behavior ambiguity across Admin, Venue, staffing, and event workflows. | **Fixed**: custom role creation rejects any key already reserved by a system role; regression coverage added. |
| Medium | Configuration persistence / retention | Organization/event configuration APIs persist generic JSON with size checks and audit entries. The admin save confirmation previously reported success even if the user canceled the confirmation dialog. The retention UI also implied immediate automatic deletion although no retention job consumes that preference. | False success state and potentially destructive policy misunderstanding. | **Fixed**: confirmation now occurs before mutation; cancel leaves draft unchanged and does not show a success toast. Retention control is now accurately described as a review preference until a reviewed retention job is configured. |
| High | Backup export / restore | The Backup Manager used a browser navigation download without attaching the JWT, while the export endpoint requires bearer authentication. Its destructive-looking restore button did not create an actionable request. | Backup/export non-functional in token-authenticated sessions; recovery readiness risk and misleading restore control. | **Fixed**: export now fetches with the stored JWT and creates an authenticated blob download. Self-service restore is now clearly a non-destructive **Request Restore** action that creates an auditable admin change request. |
| Medium | Audit / advanced tooling | Audit Log manager policy content used only a local onboarding hint to determine manager mode, creating the same stale presentation risk as Platform Studio. Owner/admin change-request APIs existed but had no owner-side decision control. System Health labeled integration readiness using unrelated aggregate health checks rather than actual integration records. Diagnostic domain switches could look like shared production feature flags even though they are browser-local. Catalog space, decor item, and decor category deletion lacked confirmation despite potential layout/unlinking or reassignment impact. Retention, policy, notifications, approvals, and catalog tools still need distinction between actionable production controls and informational/deferred surfaces. | Stale role presentation; manager requests could lack an actionable approval path; misleading or destructive controls and unsupported operational expectations. | **Improved**: Audit Log now prefers authenticated membership role data; owner/admin Platform Studio now has an auditable open change-request review queue; System Health now queries and reports actual integration connection data; diagnostics now explicitly disclose browser-local scope; venue-space deletion now warns of event-layout impact. Remaining advanced-tool review pending. |

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

## Retention decision

The venue selected **report-only** retention handling for now. Retention settings remain documented policy preferences; no automatic deletion/anonymization or candidate-review job will run until the venue explicitly authorizes a future retention workflow.

## Platform Admin focused quality gate

- Server administration coverage: **41/41 tests passed** across role management, platform configuration, admin change requests, and authenticated exports.
- Client administration coverage: **28/28 tests passed** across Admin Panel, Team Members, Audit Log, Platform Studio, and diagnostics controls.
- Server and client TypeScript checks passed.
- Production dependency audit passed with **0 vulnerabilities** for server and client production dependencies.

## Remaining review watchlist

- Advanced module production-readiness labeling for diagnostics, retention, policy, notification, approval, and catalog tools.
- Future retention execution workflow only if the venue changes its report-only decision.
- Ongoing regression coverage whenever new platform-level role keys, permissions, or destructive administration actions are introduced.
