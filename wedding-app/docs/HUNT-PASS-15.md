# Systematic Hunt Pass 15 — "Couple Intake Forms" Was a Dead End (wired end-to-end)

**Date:** 2026-08-07

## Gap found & fixed

The venue's "Couple Intake Forms" (Questions Studio + per-event answers API)
had **zero UI consumers**: the SDK's `listAnswers`/`upsertAnswer` had no
callers, the answers PUT was `events.edit`-only (couples were forbidden),
and nothing rendered the questions or the answers. The feature was
promised by navigation and studio copy but unusable.

**Wired end-to-end:**
- **Server** (`routes/questions.ts`):
  - `GET /api/events/:eventId/questions` — events.view; org intake
    questions scoped to an event (couples can see their forms).
  - `PUT /api/events/:eventId/answers/:questionId` — now also allows the
    event's COUPLE members (mirrors `canWriteCoupleData`), not just
    `events.edit` venue roles.
  - `GET /api/orgs/:orgId/questions/:questionId/answers` — single org-wide
    answers query for the venue studio (avoids the client scanning events).
- **Client**:
  - `CoupleIntakePanel` (new, lazy-loaded in the couple hub): groups the
    venue's questions, renders the right control per answer type
    (text/integer/date/boolean/dropdown/multiselect), enforces required
    answers per group before saving, shows per-group progress and answered
    checkmarks, editable any time.
  - Questions Studio: per-question "View answers" expander (venue sees each
    couple's answer + event title).
  - `sdk.questions.listForEvent` + `listQuestionAnswers`.

## Tests
- `routes/intake-questions.integration.test.ts` +4 — couples list their
  questions; couples ANSWER (was 403); venue views answers; strangers
  can't read questions/answers (403/404).
- `CoupleIntakePanel.test.tsx` +3 — grouped rendering with correct
  controls + saved-state prefill, required-answer enforcement blocks save,
  group save calls upsert per question.
- `e2e/couple-intake.e2e.spec.ts` — venue publishes questions → fresh
  couple answers the required question in their hub → the venue's
  Questions Studio "View answers" shows the couple's answer; server
  verified.
