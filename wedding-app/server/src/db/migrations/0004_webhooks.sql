-- ============================================================
-- Migration 0004: Outbound webhooks
-- ============================================================

CREATE TABLE IF NOT EXISTS webhooks (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  secret          TEXT NOT NULL DEFAULT '',
  event_types     TEXT NOT NULL DEFAULT '["*"]',  -- JSON array of event type filters
  is_active       INTEGER NOT NULL DEFAULT 1,
  description     TEXT,
  last_triggered  TEXT,
  last_status     INTEGER,                        -- HTTP status of last delivery
  failure_count   INTEGER NOT NULL DEFAULT 0,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_webhooks_org ON webhooks(organization_id, is_active);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id          TEXT PRIMARY KEY,
  webhook_id  TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     TEXT NOT NULL DEFAULT '{}',
  status      INTEGER,                            -- HTTP response status
  response    TEXT,                                -- first 2KB of response body
  duration_ms INTEGER,
  error       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_webhook_del_hook ON webhook_deliveries(webhook_id, created_at);

INSERT OR IGNORE INTO schema_version (version) VALUES (4);
