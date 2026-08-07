# Guest Portal i18n Pass — working language selector with persistence

**Date:** 2026-08-07
**Scope:** the last known gap — the guest portal language selector
(en/es/fr/zh) previously stored a state variable that translated nothing.
This pass adds a real i18n layer, wires BOTH existing selectors to it, and
persists the choice locally AND server-side per guest.

---

## What shipped

### 1. Client i18n layer (`client/src/i18n/`)
- `translations.ts` — a typed dictionary for **en / es / fr / zh** covering
  ~300 keys across the entire guest-facing portal: shell (header, tabs,
  countdown, hero, welcome card, polls, weather card, info modules),
  home cards (dashboard, start-here/lookup/help, venue messages, memories,
  event-day mode, reminders, privacy, care, FAQ, travel, gifts), the RSVP
  wizard (every step, field, button, error, receipt incl. the late-submission
  notice), the weekend itinerary, the wayfinding map chrome, the recovery
  center, and the public NPS survey. `{var}` interpolation included.
  Venue-authored CONTENT (FAQ text, notices, shuttle notes, poll questions)
  remains as authored — it is data, not UI.
- `I18nContext.tsx` — `I18nProvider` + `useI18n()` (`lang`, `setLang`, `t`).
  Language resolution: server-saved preference (info payload) →
  localStorage (`wvi_guest_language`) → `en`. Every change persists to
  localStorage immediately and notifies the caller for server sync.
  Unknown keys fall back to `en`, then the key itself (never a crash).

### 2. Server persistence (`routes/guests/portal.ts` + `shared.ts`)
- New public endpoint **`POST /api/portal/:eventId/language`**
  (`{ guestId, token, language }`, rate-limited 20/min, honeypot-protected,
  audited as `portal.language.update`). Validates the portal token and
  stores the language in guest **metadata** — deliberately NOT inside
  `reminderPreferences`, so switching the shell language can never clobber
  the guest's reminder opt-ins (regression-tested).
- `GET /api/portal/:eventId/info` now returns `language` (guest metadata →
  old reminder-preferences field → `en`), so the choice round-trips and a
  guest's next device opens in their language.
- SDK: `sdk.portal.setLanguage(...)` + `PortalInfoResponse.language`.

### 3. Selector wiring
- Portal shell header select AND the "Start Here" card select both drive
  the provider; the whole portal re-renders in the chosen language live.
- Token-holding guests sync to the server (fire-and-forget); anonymous
  guests persist locally.
- The reminder-preferences card keeps its own language field (that one is
  the language for REMINDER EMAILS, already persisted server-side).

## Tests
- `i18n/I18nContext.test.tsx` (+6): defaults, live switching, interpolation,
  missing-key fallback, localStorage restore, server-`initialLang` adoption,
  invalid-value rejection.
- `routes/portal-language.integration.test.ts` (+4): store+restore, en
  default, 400 invalid language / 403 bad token, and **reminder prefs are
  not clobbered** when the shell language changes.
- `e2e/guest-portal-i18n.e2e.spec.ts` (+1): selector → Español live →
  reload persistence → server info reports `es` → Français → 中文.
- Updated existing portal tests for the translated chrome (labels/aria are
  translated live; selects are captured before switching so post-change
  assertions use the translated names).

## Totals
**44 e2e specs · 976 client unit tests · 698 server tests — all green.**

## Notes for future sessions
- Guest portal tests: the main portal suite's `beforeEach` now clears
  localStorage (`wvi_guest_language`) — the shell language is a shared
  mutable global, and a leftover `es` turns every later English assertion
  into a "label not found" failure.
- `getByLabelText('Portal shell language')` only works while `lang === 'en'`;
  after switching, the same control is `Idioma del portal` etc. Capture the
  element reference before switching.
- New UI strings must be added to ALL FOUR locale dictionaries in
  `i18n/translations.ts` (the `en` entry doubles as the fallback).
