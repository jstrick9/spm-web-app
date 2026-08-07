# HUNT-PASS-17 — Intake answer cross-org contamination fix + clean-sweep gate extension

**Cycle:** Clean Cycle #2 · **Date:** 2026-08-07 · **Status:** verified, pushed to all 4 branches

---

## Findings & fixes

### 1. Couples could attach intake answers to a foreign org's question (data-integrity bug)
**Symptom:** `PUT /api/events/:eventId/answers/:questionId` validated the caller's
permission but never checked the question. A couple (or venue) could write an answer row
bound to a question from ANOTHER org (or a nonexistent question). The foreign org's
Questions Studio "View answers" would then show a contaminated answer for an event it
does not own.

**Root cause:** Missing ownership check between `question.organization_id` and
`event.organization_id` in the upsert path.

**Fix:** The handler now loads the question, 404s on `question-not-found`, and 400s with
`question-org-mismatch` when the question belongs to a different org than the event.

**Tests:** `intake-questions.integration.test.ts` +2 — foreign-org question is rejected
(400) and the foreign org's answer view stays empty; nonexistent question → 404.
Suite: 709 server tests.

### 2. Clean-sweep gate missed 5 authenticated surfaces
**Symptom:** `surfaces-clean.e2e.spec.ts` covered 12 surfaces but not `/events`,
`/system/questions`, `/system/email-automations`, `/system/platform`, `/system/audit`.

**Fix:** Added all 5 (17 total). All render with zero console/network errors.

**Tests:** `surfaces-clean.e2e.spec.ts` extended; passed in isolation and in the full run.

---

## Re-audited this pass (no change needed)
- Guest portal "Request secure link" resend — privacy-safe, honeypot + rate limited,
  token only rotated when a delivery job can be queued (SMTP-gated); previously audited.
- Space-calendar double-booking conflicts — already surfaced in the dashboard grid +
  commitment rows ("This space is double-booked…").
- Guest reminder preferences — guest-initiated sends honor opt-ins/confirmation
  preference/contact availability and report dispatch status honestly.
- Event duplicate — wired in EventDetail.
- Couple Design & Preferences card — fully wired (save draft / submit review).
- `SdkEvent` typed reads now compile (fixed in HUNT-PASS-16).
