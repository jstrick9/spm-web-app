# HARDENING-PASS-2 — Email injection, upload spoofing, double-booking, fabricated weather

Session date: 2026-08-05

This pass closes four distinct gaps found in autonomous review after
MODULE-10 and the five prior UX passes.

---

## 1. Email template rendering — HTML injection + header injection

**File:** `server/src/db/repos/emailTemplates.ts`

**Problem:** `emailTemplatesRepo.render()` substituted merge values into the
HTML body **unescaped**. A guest or vendor whose name/note contained markup
(e.g. `<img src=x onerror=…>`, `A&B`) would inject raw HTML into every
recipient's email body — an XSS-in-email vector, a layout-breaker, and a
phishing aid. The subject line additionally accepted CR/LF from merge values,
which is the classic SMTP header-injection primitive (nodemailer strips it,
but defense-in-depth demands the server not produce it).

**Fix (`render`):**
- HTML body: values are escaped (`& < > " '`) before substitution.
- Subject: CR/LF, tab, NUL and other C0/C1 control chars are collapsed to
  single spaces and trimmed — both per-value and on the final subject.
- Merge keys are treated as literal regex text (a key like `a.b` no longer
  matches `{{axb}}`).
- Plain-text body remains verbatim (no escaping in text emails).

**Tests:** `server/src/db/repos/emailTemplates.test.ts` (7 tests) — escaping,
subject CRLF neutralization, plain-text verbatim, regex-safe keys, repeated
keys, create→render round-trip, and the password-reset/`{{reset_url}}` path
still working unbroken.

---

## 2. Upload content sniffing — magic-byte validation

**File:** `server/src/lib/fileStorage.ts`

**Problem:** every upload route validated **only the declared MIME type** from
the data URI. HTML/JS payloads could be uploaded while claiming to be
`image/png` or `application/pdf`; the bytes are later served from
`/uploads/*` under the declared content type, and could be opened/inlined by
browsers, scanners, or downstream tools.

**Fix:** `decode()` now runs a magic-byte check against the declared type:
- JPEG `FF D8`, PNG 8-byte signature, GIF87a/GIF89a, RIFF…WEBP, BMP `BM`,
  AVIF `ftyp` brand (`avif|avis|mif1|msf1`), PDF `%PDF-`.
- Mismatch → `400 invalid-image-content` / `invalid-document-content`.
- Truncated-but-signed payloads (e.g. the `/9j/abc` gallery fixture) still
  pass — the check is a signature check, not a full decode.

**Tests:** `server/src/lib/fileStorage.test.ts` extended (HTML-under-PNG,
script-under-JPEG, HTML-under-PDF rejected; truncated JPEG and real PDF
accepted). `platformConfig.integration.test.ts`'s body-limit fixture updated
to carry a real PNG signature.

---

## 3. Couple-appointment double-booking guard

**Files:** `server/src/db/repos/coupleAppointments.ts`,
`server/src/routes/couple/planning.ts`

**Problem:** a couple could be booked into two overlapping venue meetings
(tasting 10:00–11:00 + planning meeting 10:30–11:30) with no warning —
confusing for the couple and embarrassing for the venue.

**Fix:**
- Repo: `findConflicting(eventId, startsAt, endsAt, excludeId?)` —
  non-cancelled appointments with fixed times only; back-to-back
  (`end === start`) is allowed.
- `POST …/couple-appointments` with a fixed window that overlaps a live
  appointment → `409 appointment-time-conflict` with the conflicting
  appointment's title/times in `details`.
- `PATCH …/:id` to `confirmed` re-checks the appointment's own window →
  same 409. (Availability-window-only requests are never blocked.)
- Client: `CoupleEventHub` appointment mutations now surface friendly toasts
  on failure (previously silent), with specific copy for
  `appointment-time-conflict`.

**Tests:** `server/src/routes/appointments-module.integration.test.ts`
(6 tests) — create overlap blocked, back-to-back/next-day allowed, cancelled
ignored, window-only requests allowed, confirm-time conflict blocked then
unblocked after cancel, self-re-confirm never conflicts.

---

## 4. Fabricated weather widget removed from guest portal

**File:** `client/src/screens/portal/PublicGuestPortal.tsx`

**Problem:** the guest portal home tab rendered a "Venue Weather Monitor"
card with **hard-coded, fabricated forecast data** — `72°F`, "Passing
Showers", "40% afternoon", "Plan B on standby" — presented to guests as
"Live forecast guidance". There is no weather integration anywhere in the
codebase; the data was invented, which is a UX-honesty failure (guests plan
outfits/umbrellas off it) and a legal-adjacent trust issue.

**Fix:** replaced with a **Weather & Rain Plan** card rendered **only when**
the venue has authored real guidance (`guestSchedule.weatherRainPlanNote`,
already persisted via portal settings `PortalDesignerCard`). No data, no
card. Honest fallback text elsewhere ("Weather and rain-plan travel notes
will appear here if needed") already existed in `GuestPortalHome`.

**Tests:** `client/src/screens/portal/PublicGuestPortal.test.tsx` — updated
the widget assertion to the venue-authored note, and added a test that no
weather/rain card (and none of the old fake values) renders when the venue
has posted nothing.

---

## 5. Malformed-input probe batch #4

**File:** `server/src/routes/probe-batch4.integration.test.ts` (39 tests)

A fresh adversarial sweep against the full API surface:
- **Query params:** `limit=abc/-5/0/1e6/1e308`, `offset=-3`, invalid
  `before`/`after` dates, `actorEmail=%00`, `search` with NUL/CR/LF.
- **Content types:** JSON endpoints hit with `text/plain`,
  `application/x-www-form-urlencoded`, `application/xml`, empty bodies,
  malformed JSON, JSON arrays/numbers/strings/null as top-level bodies.
- **Payload shapes:** null/array/object titles, numeric orgIds, deep nesting,
  `__proto__`/`constructor.prototype` pollution attempts, malformed dates,
  wrong-typed scalars in PATCH bodies, DELETE bodies, PUT/HEAD on unknown
  routes, garbage and path-traversal upload URLs.

Result: **zero 5xx** — every probe returns 4xx or success. The suite is kept
as a permanent regression net.

---

## 6. RFC 5545 ICS escaping (follow-up commit `815ffad`)

**Files:** `server/src/routes/guests/portal.ts`, `server/src/routes/exports.ts`

**Problem:** the guest portal's per-sub-event `.ics` endpoint built its own
VEVENT with only newline stripping — a title like `Rehearsal, Dinner;
Planning \ Backslash` produced malformed calendar files (`,`/`;`/`\` are
RFC 5545 TEXT structure characters), and CR/LF in any user-controlled value
could inject extra ICS lines. The event `export.ics` similarly replaced
`,`/`;`/`\` with spaces but never neutralized CR/LF.

**Fix:** both endpoints now route every user-controlled value through
`lib/ics.ts` `icsText()` (escape `\`, `;`, `,`; collapse CR/LF).

**Tests:** `server/src/routes/portal-ics.integration.test.ts` (3 tests) —
escaping across SUMMARY/LOCATION/DESCRIPTION, well-formed line structure
(no injected properties), invite-only token guard, and a CRLF
line-injection attempt on the event export `.ics`.

---

## Verification

- Server: full suite green (641 tests / 84 files).
- Client: full suite green (898 tests / 135 files).
- `tsc --noEmit` clean on both apps; `npm run build` + bundle-budget pass.
- SDK↔server route surface cross-checked: every SDK call resolves to a
  registered server route (no dead/misrouted endpoints).
