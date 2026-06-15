-- ============================================================
-- Migration 0033: Guest help request operations
-- ============================================================

ALTER TABLE guest_help_requests ADD COLUMN sla_due_at TEXT;
ALTER TABLE guest_help_requests ADD COLUMN last_reply_at TEXT;
ALTER TABLE guest_help_requests ADD COLUMN last_reply_channel TEXT CHECK (last_reply_channel IN ('email','sms','in_app'));
ALTER TABLE guest_help_requests ADD COLUMN last_reply_job_id TEXT;
ALTER TABLE guest_help_requests ADD COLUMN last_reply_status TEXT;

CREATE INDEX IF NOT EXISTS idx_guest_help_requests_sla ON guest_help_requests(event_id, sla_due_at, status);
