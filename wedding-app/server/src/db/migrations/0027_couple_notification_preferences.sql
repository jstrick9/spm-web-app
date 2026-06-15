-- ============================================================
-- Migration 0027: Couple notification preferences
-- ============================================================

CREATE TABLE IF NOT EXISTS couple_notification_preferences (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_enabled   INTEGER NOT NULL DEFAULT 1,
  sms_enabled     INTEGER NOT NULL DEFAULT 0,
  in_app_enabled  INTEGER NOT NULL DEFAULT 1,
  digest_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (digest_frequency IN ('instant','daily','weekly','off')),
  quiet_hours     TEXT NOT NULL DEFAULT '{}',
  decision_alerts INTEGER NOT NULL DEFAULT 1,
  due_task_alerts INTEGER NOT NULL DEFAULT 1,
  message_alerts  INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_couple_notification_preferences_user ON couple_notification_preferences(user_id, event_id);
