-- 0054: RSVP late-submission flag.
--
-- Venues set an RSVP deadline for catering counts, but guests can (and do)
-- submit after it. Until now the platform accepted late submissions with NO
-- signal — a venue could finalize headcounts while a guest who responded a
-- day late was silently missing. This column records that a submission
-- arrived after the deadline so guest lists can flag it.
ALTER TABLE rsvp_submissions ADD COLUMN late_submission INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_rsvp_submissions_late ON rsvp_submissions(event_id, late_submission);
