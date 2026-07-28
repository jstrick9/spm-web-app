# Seven Paths Manor Wedding Venue Intelligence Platform Blueprint

**Purpose:** Reset the product around one operating reality: **Seven Paths Manor manages wedding spaces, reusable venue assets, staff, vendors, event operations, and final approvals. Couples manage their own guest list and planning decisions.**

**Long-term direction:** Preserve multi-tenant architecture, but configure and simplify the product first for one venue organization. Do not optimize the primary experience for generic SaaS administration, unrelated venue brands, or every possible event type.

**Status:** Product and technical blueprint for the next platform-wide redesign.

---

## 1. Executive product decision

The platform should be a **venue operating system with a dedicated couple workspace**, not a broad generic event-management application.

### Product promises

1. A Seven Paths Manor manager can create a trustworthy reusable venue space without CAD expertise.
2. A couple can complete decisions, manage guests, and propose a wedding layout without altering protected venue operations.
3. The venue retains control of safety, capacity, inventory, vendor access, final layout approval, and day-of execution.
4. Every module appears only when it serves the active user, event stage, and permission.
5. The experience is task-first: users see what they need to do next—not a catalog of software features.

### Target deployment sequence

| Stage | Product posture |
|---|---|
| **Now** | Single configured organization: Seven Paths Manor. Opinionated defaults, venue-specific workflows, minimal system/admin exposure. |
| **Later** | Multi-property operator support: shared brand, templates, inventory rules, and staff with property-level access. |
| **Future SaaS** | Separate venue tenants with isolated data, branded portals, configurable modules, and subscription controls. |

The existing multi-tenant data model is an asset. The default UX should not expose multi-tenant complexity to Seven Paths Manor staff or couples.

---

## 2. Non-negotiable role boundary

### Seven Paths Manor owns

- Venue spaces, physical dimensions, fixed architecture, underlays, operational zones.
- Venue templates and approved reusable layout scaffolds.
- Inventory definition, availability, and shared-inventory conflict decisions.
- Capacity, accessibility, exits, load-in, power, bar/service, tent/weather and operational rules.
- Vendor roster, preferred vendors, vendor access, staffing, operations, setup packets, and final layout approval.
- Event creation, booking status, contracts, payments, timelines, and operational readiness.

### Couple owns

- Guest list, guest identities, invitations, RSVPs, seating selections, household/relationship details, and guest communications.
- Wedding preferences, decor preferences, couple decisions, guest-facing portal choices, and proposal requests.
- Event-layout proposals using only approved venue spaces and permitted event objects.

### Venue guest access: read-only operational visibility

Venue users may view but not create/edit/delete guest records. The venue needs:

- Current guest count and RSVP totals.
- Names for operational setup and day-of hospitality.
- Read-only relationship context such as bridal party, VIP, family, or relation to couple.
- Read-only accessibility and dietary operational notes where necessary.
- Seating and table summaries only after couple data is provided.

The venue must not be able to add/edit/remove guests, submit RSVPs, send couple-originated invitations, or alter guest identity data.

### Recommended role model

| Role | Home | Core authority |
|---|---|---|
| Venue Owner | Venue command center | All operational/configuration/final approval decisions. |
| Venue Manager | Today + Events | Spaces, templates, events, staffing, vendors, layouts, final approvals. |
| Venue Operations Staff | Today / assigned event | Read approved plans, floor walk, tasks, setup packets, variance evidence. |
| Venue Sales/Events Coordinator | Leads/Events | Tour, proposal, contract, timeline coordination; no platform configuration. |
| Planner | Assigned event workspace | Propose layouts, collaborate, timeline/vendor coordination subject to venue rules. |
| Couple | Couple Event Hub | Guests, RSVPs, decisions, portal, layout/decor proposals. |
| Vendor | Vendor portal | Assigned instructions, load-in, documents, check-in; no guest list or other vendor data. |

Use capability permissions for enforcement, but present role names and human tasks in the UI.

---

## 3. Simplified information architecture

### A. Seven Paths Manor staff navigation

**Primary navigation** should contain only:

1. **Today** — events today/this week, tasks, arrivals, setup status, risks.
2. **Events** — booking pipeline and active event portfolio.
3. **Venue Studio** — spaces, templates, inventory, preferred assets.
4. **Operations** — staffing, vendors, setup packets, floor walks, day-of issues.
5. **Reports** — only useful venue reporting: conversion, revenue, utilization, event readiness.

**Settings** should be a restrained secondary area:

- Seven Paths Manor profile/branding.
- Team and roles.
- Couple experience settings.
- Integrations.
- Advanced system tools only for owner/admin.

### B. Couple navigation

Couples should never see staff operations or platform/system tools. Their event hub should have:

1. **Plan** — next steps, decisions, dates, budget checkpoints.
2. **Guests** — the only full guest-management surface.
3. **Design** — approved space, layout proposal, decor, seating, inventory choices allowed by the venue.
4. **Wedding details** — timeline, vendors/contact choices, documents, questions.
5. **Guest experience** — invitations, RSVP portal, website/itinerary.

### C. Remove from normal navigation

The current app exposes a broad mix of generic modules: cross-event guests, catalog studio, questions studio, intelligence, integrations, platform studio, admin/system tools, analytics, health command center, email automation, NPS, and vendor check-in. These may remain in the codebase or as owner-only optional tools, but should not be part of normal Seven Paths Manor navigation.

---

## 4. Module-by-module recommendation

### 4.1 Authentication, onboarding, and login

**Keep and redesign.**

Current strengths: auth, invitations, organization data, branding capabilities, role permissions.

Changes:

- Brand login as **Seven Paths Manor**; remove generic product language.
- Primary paths: `Venue team sign in` and `Couple invitation sign in`.
- Do not let couples create an organization.
- Couple invitation accepts event context, role, and next task.
- First login should be role-specific:
  - Venue owner: create spaces → assets/inventory → templates → invite team.
  - Venue manager: today’s events and assigned setup tasks.
  - Couple: welcome, guest-list import, planning milestones, venue-approved space selection.

### 4.2 Dashboard / Today

**Keep, simplify, split by role.**

Venue dashboard should prioritize:

- Today/next 7 days events.
- Pending layout approvals and reopen requests.
- Space/template setup completeness.
- Inventory shortfalls/shared reservation risks.
- Staff coverage and vendor check-in readiness.
- Contract/payment/event readiness only when action is required.

Remove or hide generic dashboard cards that do not cause a near-term venue action. Health command center/intelligence should become a concise **Operational alerts** card, not a separate product destination for normal users.

### 4.3 Venue Studio

**Highest priority. Keep and continue.**

Implemented direction is strong: guided space setup, templates, units, underlays, calibration, SVG/DXF import, versioning, operational zones, approval, event layouts, inventory-aware objects.

Required product shape:

- **Spaces:** Ballroom, lawn, terrace, tent, cocktail patio, rain plan, rehearsal area.
- **Templates:** reusable approved event layouts per space and service style.
- **Assets/inventory:** tables, chairs, linen, decor, bars, staging, power/service assets.
- **Rules:** capacity, event type constraints, curfew, candles, weather/rain plan, access routes.
- **Property connections:** optional ceremony → cocktail → reception/rain plan movement map.

Rename `Venue Builder` and `Catalog Studio` in normal UI to one coherent **Venue Studio** with tabs: Spaces, Templates, Inventory, Rules, Property Map.

### 4.4 Event lifecycle / booking

**Keep and make the center of venue operations.**

Venue-owned event stages should be:

Lead → Tour → Hold → Booked → Planning → Final review → Event week → Completed → Closed.

The event page should show only context-relevant tabs. Example:

- Sales phase: couple, dates, space availability, proposal, contract, payments.
- Planning phase: layout, timeline, vendors, couple decisions, guest count summary.
- Event week: setup packet, staffing, floor walk, vendor access, readiness.

### 4.5 Couple Event Hub

**Keep; make it the couple’s single source of truth.**

Reduce overlapping modules/reminders/advanced planning/post-event areas into a clear journey with a prominent “next decision” card.

Couple tasks:

- Guest list and RSVP only.
- Design proposal only in venue-approved space.
- Decor and seating proposals.
- Menu/vendor choices that the venue chooses to expose.
- Document review/signature, payment, questions.

### 4.6 Guest management

**Move exclusively into Couple Event Hub.**

Keep powerful guest tools but remove all venue edit paths and venue navigation entries.

Couple functions:

- Import/export, households, RSVP, plus ones, seating assignment, dietary/accessibility details, invitations, portal.

Venue functions:

- Read-only guest operational manifest.
- Headcount / RSVP / meal / accessibility aggregate summaries.
- Read-only names and tagged operational roles.
- No create/edit/delete, no invitation sending, no RSVP editing.

Cross-event guest browser and guest merge should be hidden owner-only data-quality tools or retired from routine workflows.

### 4.7 Layout and design

**Keep; preserve clear ownership boundary.**

Venue scaffold is protected. Couple/planner proposal is editable. Final approval is venue-owned.

Continue UX principles:

- No generic paint tools in normal workflows.
- Quantity-first setups and independent editable copies.
- Venue-defined tables/chairs/decor and service-style capacities.
- Inventory reservation is event-scoped and visible.
- Approved layouts lock; changes use reopen request → venue-managed new proposal draft.
- Comments, pins, compare views, review queue, notifications.

Future improvements:

- Better direct canvas measurement interaction.
- Template gallery by service style and guest range.
- Clearer automatic aisles/circulation warnings.
- Named setup groups and reuse inside an event.

### 4.8 Inventory

**Keep; relocate under Venue Studio and event layout context.**

Venue inventory needs:

- Physical definition: dimensions, service capacities, condition, owner/vendor rental, photos.
- Availability/reservations by event.
- Reorder/maintenance tracking only when relevant.
- Shared inventory review.
- Preferred default mappings by space/template.

Do not expose generic inventory administration to couples. Couples choose permitted items in design proposals; the system shows availability but the venue governs assets.

### 4.9 Vendors

**Keep; make venue-first.**

Venue needs preferred vendor directory, contract/insurance status, access instructions, event assignment, load-in, payment/commission tracking where applicable, and day-of check-in.

Couple needs a curated approved/preferred vendor selection experience—not the venue’s full vendor operations database.

### 4.10 Timeline / run sheet / staffing

**Keep; consolidate under Operations.**

Venue timeline should drive:

- Event day run sheet.
- Vendor arrival/load-in/strike.
- Staff shifts and assigned zones.
- Ceremony/reception transitions.
- Setup packet distribution.
- Rain plan switch.

Couples should see their wedding schedule and decision deadlines, not internal staff task mechanics unless the venue intentionally shares them.

### 4.11 Contracts, payments, sales

**Keep, but stage-gate.**

Useful venue functionality:

- Proposal, contract, deposit/payment status, add-ons, signed documents, cancellation/refund policy.

Hide deep payment/accounting tools from couples until a payment or signature needs action. Keep financial/legal analytics owner-only.

### 4.12 Portal, invitations, RSVP, itinerary

**Keep as Couple Guest Experience.**

Guest-facing features should be controlled by the couple, using venue-approved branding/guardrails. The venue should not manage guest records but can surface selected logistics: parking, venue map, accessibility, dress code, arrival instructions.

### 4.13 Platform Studio, questions, intelligence, integrations

**Retain as owner-only optional configuration—not routine modules.**

- Platform Studio → **Seven Paths Manor Brand & Experience**.
- Questions Studio → **Couple Intake Forms**, enabled only during sales/planning.
- Intelligence/forecast/risk → owner/manager reports and alerts, consolidated.
- Integration Hub → owner/admin settings.
- Email automation/NPS → optional future modules; remove from default navigation.

---

## 5. End-to-end journeys

### Venue owner: initial setup

1. Sign in to Seven Paths Manor workspace.
2. Complete Venue Studio checklist:
   - spaces;
   - underlays/dimensions;
   - exits/accessibility/power/loading;
   - inventory;
   - templates;
   - venue rules;
   - brand/couple portal.
3. Invite managers/staff.
4. Review readiness dashboard.

### Venue manager: new booked event

1. Create/select event from booking record.
2. Assign approved venue space and event date.
3. Invite couple.
4. Select initial layout template.
5. Assign event team and vendor requirements.
6. Monitor couple decisions, guest count summary, layout proposal, and risks.
7. Approve final layout and distribute setup packet.

### Couple: invited planning workspace

1. Accept invitation; confirm wedding basics.
2. Import/manage guests and invitations.
3. See guest count and decision checklist.
4. Select permitted space/template and submit design proposal.
5. Choose permitted decor/inventory/vendor options.
6. Receive review feedback and request reopening if approved layout needs revision.
7. Complete portal, timeline, documents, payments.

### Event week / day-of venue staff

1. Open Today or assigned event.
2. Read approved layout/setup packet.
3. Check inventory and vendor access.
4. Perform floor walk and record variance evidence.
5. Activate rain plan if needed.
6. Complete setup, event, strike tasks.

---

## 6. What to remove, hide, or defer

### Hide from everyday users immediately

- Generic System navigation.
- Cross-event guest browser and guest merge from venue/couple navigation.
- Catalog Studio as a separate product destination.
- Questions Studio as a separate destination.
- Raw integration hub, audit log, email automation, analytics internals.
- Generic risk/forecast/intelligence dashboards for couples.
- Broad admin interfaces for non-owner staff.

### Reframe rather than delete

| Current concept | Reframed concept |
|---|---|
| Catalog Studio | Venue Studio: Inventory & Templates |
| Venue Builder | Venue Studio: Spaces |
| Platform Studio | Seven Paths Manor Brand & Experience |
| Questions Studio | Couple Intake Forms |
| Intelligence Dashboard | Owner Insights |
| Event Health Command Center | Operational Alerts |
| Guest Operations Panel | Couple Guest Management / Venue Guest Summary |
| Global Calendar | Venue Booking & Operations Calendar |

### Defer until core venue/couple workflows are proven

- Generic NPS/feedback automation.
- Broad marketing/email automation builder.
- Complex revenue forecasting.
- Generic webhook management for ordinary staff.
- Optional immersive/3D visualization.
- Advanced CAD entities beyond needed venue drawings.

---

## 7. Technical and UX architecture recommendations

### Keep

- Existing multi-tenant organization/event model.
- Capability-based RBAC.
- First-class venues/spaces and layouts.
- Revision history, audit logs, SSE events, inventory reservations.
- Current incremental Venue Studio foundations.

### Change

1. **Role-specific route guards and navigation:** guest mutation endpoints must be couple-only; venue gets read-only guest operational routes.
2. **Module registry / feature configuration:** Seven Paths Manor can enable optional modules without presenting all of them by default.
3. **Event-stage configuration:** tabs and cards change based on lead/booked/planning/event week/completed state.
4. **Single source of truth for layout state:** scaffold, event proposal, inventory reservations, review status, and approved revision must remain explicitly linked.
5. **Terminology layer:** replace technical labels such as catalog, system, platform, and objects with venue language.
6. **Task-first command surfaces:** dashboard action queues over data tables.

### UX rules

- Default to guided forms and recognizable wedding terms.
- Make advanced tools progressive disclosure.
- Use one major decision per screen.
- Preserve a clear “what is locked / what can I change” explanation.
- Any destructive, capacity, safety, or inventory action must state impact and next step.
- Mobile is review/setup packet/floor walk first; desktop is advanced design first.

---

## 8. Recommended implementation roadmap

### Release 1 — Seven Paths Manor foundation

1. Rebuild navigation by venue/couple/staff role.
2. Make couple invitation onboarding primary.
3. Enforce couple-only guest mutation; add venue read-only guest summary/manifest.
4. Consolidate Venue Studio navigation and initial setup checklist.
5. Simplify dashboard to spaces/templates/inventory → events/layouts/operations.

### Release 2 — Venue event operations

1. Event-stage workflow and role-specific event tabs.
2. Venue template gallery and approved space selection.
3. Operational setup packet, staffing, vendors, floor walk.
4. Couple decision hub and proposal flow.

### Release 3 — Lean optional modules

1. Owner-only Brand & Experience settings.
2. Curated couple intake forms.
3. Preferred vendor program.
4. Contract/payment and sales refinements.
5. Optional reporting/forecasting/integrations.

### Release 4 — Multi-tenant productization

1. Multi-property hierarchy.
2. Tenant onboarding wizard.
3. Per-tenant enabled modules and branding.
4. Data isolation/operational support model.
5. Subscription/billing only after product workflow is proven.

---

## 9. Success measures

### Venue setup

- Time to create an approved reusable space.
- Percentage of spaces created without advanced canvas use.
- Percentage of spaces with complete exits/accessibility/power/loading details.

### Couple experience

- Couple invitation acceptance rate.
- Guest-list completion and RSVP completion rates.
- Percentage of layout proposals approved in one or two review cycles.
- Number of support requests per booked couple.

### Venue operations

- Layout approval time.
- Setup-day variance count.
- Inventory conflict rate.
- Vendor/staff readiness completion before event week.
- Time from booking to final approved operational plan.

---

## 10. Immediate decisions already confirmed

- Initial focus is **Seven Paths Manor**, while preserving a future multi-tenant path.
- Couples enter by **venue invitation**.
- Guest mutation belongs to **couples only**.
- Venue has read-only guest identity and operational visibility.
- First-class venue priorities: **spaces, templates, inventory**, then events/layouts/timeline/vendors/staff.
- Simplification should be **aggressive**: optional/advanced modules do not belong in normal workflow navigation.
- Deliverable is a detailed product and technical blueprint.
