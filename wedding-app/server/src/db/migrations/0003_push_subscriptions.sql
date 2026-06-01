-- ============================================================
-- Migration 0003: Push subscriptions + SSE event stream support
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL UNIQUE,
  p256dh          TEXT NOT NULL,
  auth            TEXT NOT NULL,
  user_agent      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_org  ON push_subscriptions(organization_id);

-- Track the last SSE cursor each client has seen so we can resume
CREATE TABLE IF NOT EXISTS sse_events (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,    -- e.g. 'guest.created', 'event.updated', 'rsvp.submitted'
  payload         TEXT NOT NULL DEFAULT '{}',
  actor_user_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sse_org_id ON sse_events(organization_id, id);

INSERT OR IGNORE INTO schema_version (version) VALUES (3);
