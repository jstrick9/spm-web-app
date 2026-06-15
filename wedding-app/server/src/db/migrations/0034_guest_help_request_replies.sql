-- ============================================================
-- Migration 0034: Guest-visible help request replies
-- ============================================================

CREATE TABLE IF NOT EXISTS guest_help_request_replies (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  request_id      TEXT NOT NULL REFERENCES guest_help_requests(id) ON DELETE CASCADE,
  guest_id        TEXT REFERENCES guests(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('email','sms','in_app')),
  body            TEXT NOT NULL,
  dispatch_status TEXT,
  job_id          TEXT,
  sent_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
  sent_by_label   TEXT,
  visible_to_guest INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guest_help_replies_guest ON guest_help_request_replies(event_id, guest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_help_replies_request ON guest_help_request_replies(request_id, created_at DESC);
