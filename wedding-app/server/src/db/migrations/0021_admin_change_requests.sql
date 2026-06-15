CREATE TABLE IF NOT EXISTS admin_change_requests (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  area            TEXT NOT NULL DEFAULT 'configuration',
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','rejected','resolved')),
  response_note   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_change_requests_org ON admin_change_requests(organization_id, status, created_at DESC);
