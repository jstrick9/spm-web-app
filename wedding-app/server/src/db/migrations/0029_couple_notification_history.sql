-- ============================================================
-- Migration 0029: Couple notification history
-- ============================================================

CREATE TABLE IF NOT EXISTS couple_notification_history (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  reminder_key    TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('in_app','email','sms','digest')),
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','read','dismissed')),
  due_at          TEXT,
  recipient_role  TEXT NOT NULL DEFAULT 'couple' CHECK (recipient_role IN ('couple','partner','planner')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_couple_notification_history_event ON couple_notification_history(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_couple_notification_history_user ON couple_notification_history(user_id, event_id, status);
