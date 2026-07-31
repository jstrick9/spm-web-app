CREATE TABLE IF NOT EXISTS event_week_updates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES venue_communication_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL,
  critical INTEGER NOT NULL DEFAULT 0,
  published_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS event_week_update_acknowledgments (
  update_id TEXT NOT NULL REFERENCES event_week_updates(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewed_at TEXT,
  acknowledged_at TEXT,
  PRIMARY KEY(update_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_week_updates_event ON event_week_updates(event_id, published_at DESC);
