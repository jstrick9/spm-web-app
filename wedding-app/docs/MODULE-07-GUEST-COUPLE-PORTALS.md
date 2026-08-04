# MODULE-07 — Guest & Couple Portals: Comprehensive Review

**Scope:** `routes/guests/portal.ts` (public guest portal: status/info/lookup/help/privacy/accessibility/
reminders/resend/rsvp/day-of/ics/messages/verify), `routes/guests/core.ts` (help-request management),
`routes/couple/{portal,documents,finance,guests,planning,postEvent,shared}.ts`, `guest_help_requests`
schema (0032-0034), client `PublicGuestPortal` + `GuestRsvpWizard`, `CoupleEventHub` + couple screens,
`GuestPortalSettingsTab` (venue), `EventFeedbackTab` (venue moderation), `useRealtimeInvalidation`.

**Review date:** 2026-08-04 · **Status:** findings fixed in this module commit (CP-01…CP-09).

---

## Module strengths

- **Public guest portal is genuinely production-grade**: token lifecycle (hashed, revocable, rotate-on-
  resend), honeypots on every public POST, per-endpoint rate limits, password-protected portals,
  household RSVP, sub-event invitations, RSVP edit windows, severe-allergy escalation, offline passes /
  ICS exports, and privacy-first identity (generic directory is opt-in).
- **Guest help requests** have a real SLA model (3d link issues / 1d accessibility / same-day day-of
  help) with assignment, replies (email/SMS via providers), and a moderation queue.
- **Couple finance/documents sanitization** (`safeContract`/`safePayment`/`safeDocument`) keeps venue
  internals out of the couple surface; the couple hub is audited and role-scoped.
- Request-based venue collaboration (portal updates, RSVP reminders, partner/planner invites, change
  orders) is a well-designed two-way flow.

---

## Findings & fixes

| ID | Sev | Area | Finding | Fix |
|----|-----|------|---------|-----|
| CP-01 | **High** | Authorization | **Couple-write endpoints accept ANY `events.view` holder** — including the day-of **staff** role. `PATCH couple-profile`, `couple-design`, `couple-advanced-planning`, `couple-planning/:taskId`, reminders digest, inbox decisions, appointment booking/reschedule/signoff, documents upload/version, notification prefs, finance sign, post-event survey/review, seating, and couple-requests creation were all editable by staff. | New `canWriteCoupleData` guard (couple-role membership **or** `events.edit`) applied to all couple-owned writes (incl. appointment reschedule, which the couple needs — verified against the existing auth suite); reads stay `events.view`; venue moderation surfaces (review queue, review-links, request responses) keep their existing gates; couple-inbox **messages** stay on `messages.send`. |
| CP-02 | **Med** | Audit | **View-audit spam**: `couple.guests.view`, `couple.advanced_planning.view`, `couple.privacy.view`, `couple.post_event.view` write an audit row on every GET — the couple hub polls these endpoints. | Remove per-GET audits (mutation audits stay) — consistent with FI-13. |
| CP-03 | **Med** | Realtime | **No SSE for couple actions**: couple requests, decisions, document uploads, design submissions never broadcast — the venue and the partner's device go stale until refetch. | Broadcasts: `couple.request_created/updated`, `couple.decision_created`, `couple.document_uploaded/deleted`, `couple.design_submitted`; client invalidation handlers for the couple query keys. |
| CP-04 | **Med** | API design | `GET /couple-notification-preferences` **creates a row** (write-in-GET) on first access. | GET returns defaults without inserting; PATCH creates. |
| CP-05 | **Med** | Feature gap | **Couple documents cannot be deleted** (no route/repo/UI), and `newVersion` **orphans the previous file on disk** (no `deleteFile` cleanup). | `DELETE /couple-documents/:id` (couple-write) + repo method + client delete button; `newVersion` deletes the superseded file. |
| CP-06 | **Med** | Ops | **Help-request SLA is passive**: `sla_due_at` is computed and displayed, but nothing ever flags an overdue open request. | Worker scan (hourly): overdue open requests → audit `guest_help.sla_breach` (deduped) + SSE `guest_help.sla_breach` so the venue panel can highlight them. |
| CP-07 | **Med** | Feature gap | **Partner/planner invites silently no-op for unregistered emails**: approving a `partner_invite`/`planner_request` only adds an event membership when the user already exists — otherwise nothing happens and the partner never receives access. | When the target email has no account: create an **event-scoped team invitation** (couple/planner role), best-effort email delivery via SMTP, and return the invitation token in the response so the couple hub can show/copy the link. |
| CP-08 | **Low** | Documentation | `guest_help_requests.kind` CHECK only allows `cannot_find_name/wrong_guest/expired_or_revoked/other` — day-of-help, accessibility, privacy, memory, and question kinds are correctly flattened to `other` with the detail preserved in the message text. Intentional, but undocumented. | Schema comment migration + module doc note; venue list copy clarifies "kind shown in message". |
| CP-09 | **Low** | Data hygiene | `couple-advanced-planning` GET response is cached nowhere and recomputed per poll (fine at this scale) — flagged for the future, no change. | Documented only. |

---

## Verification & regression tests

Server — new `routes/portals-module.integration.test.ts` (+ updates where needed):

1. Staff (`events.view` only) gets 403 on couple-profile/design/advanced-planning/planning-task/
   notification-prefs/document writes; couple member succeeds; planner (`events.edit`) succeeds (CP-01).
2. GET notification-preferences is pure (no row created); PATCH creates (CP-04).
3. Document delete removes the row + asset; newVersion deletes the superseded file (CP-05).
4. Partner invite approval for an unregistered email creates an event-scoped team invitation +
   returns the token; for a registered email adds the membership (CP-07).
5. Couple request/decision/document actions broadcast SSE (CP-03); GETs no longer audit (CP-02).
6. SLA breach scan flags overdue open help requests exactly once (audit dedupe) + SSE (CP-06).

Client — `useRealtimeInvalidation.test.ts` (couple handlers), `CoupleEventHub.test.tsx` (document
delete button + invite-link display when the approval returns a token).

**Validation:** server `tsc --noEmit` ✅ · server vitest ✅ · client `tsc --noEmit` ✅ · client vitest ✅ ·
`npm run build` + bundle budgets ✅.

---

## Affected modules / follow-ups

- **Integrations/Intelligence (later module)** — reminder-preferences + resend-link already dispatch
  via the email/SMS job kinds; the new SLA scan joins the worker loop.
- **Platform Admin (later module)** — audit trail now excludes view noise and includes couple mutation
  actions; the help-request SLA scan is a new periodic job for the runbook.
- **Deferred:** couple hub pagination for guest lists; partner invite **SMS** fallback; portal
  password reset flow for guests (portal is password-gated at venue level only).
