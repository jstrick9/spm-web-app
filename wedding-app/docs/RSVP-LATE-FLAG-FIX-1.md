# RSVP-LATE-FLAG-FIX-1 — venues can now see RSVPs that arrived after the deadline

## Gap
Venues set an RSVP deadline because catering counts hinge on it — but the
platform accepted post-deadline submissions with **zero signal**. A guest
responding a day late silently changed the headcount; the venue could
finalize numbers while that guest was missing from them.

## Fix (migration 0054 + server + client)
1. **Migration `0054_rsvp_late_submission.sql`** — `rsvp_submissions.late_submission`
   column (+ index).
2. **Submit route** (`guests/portal.ts`) — a submission is flagged late when
   the event has an `rsvp_deadline` and the LOCAL calendar date is past it
   (US-evening-safe, consistent with `localDateString()` everywhere else);
   audited as `public.rsvp.late_submission`.
3. **Exposure**:
   - Venue guest list (`/api/events/:id/guests`) → `lateSubmission` per guest.
   - Couple guest list (`/api/events/:id/couple-guests`) → `lateSubmission`.
   - Catering dietary CSV → `⚠ LATE RSVP (after deadline)` prepended to the
     guest's catering notes.
4. **UI** — venue GuestsTable RSVP cell shows a warning **"Late RSVP"** chip
   next to the status when flagged (tooltip: "RSVP arrived after the RSVP
   deadline").

## Bonus fix in the same pass
The catering export's "latest submission" join ordered by `submitted_at
DESC` — two submissions within the same second (e.g. a quick edit) made the
join nondeterministic, showing STALE submission data. Now orders by `rowid
DESC` (insertion order).

## Tests
- `portal-flow.integration.test.ts` +1 (`1j3b`): no-deadline → not late;
  past deadline → late; audit row; catering CSV contains the LATE marker;
  venue + couple guest lists carry the flag.
- Live verification against the running server confirmed the CSV marker.
