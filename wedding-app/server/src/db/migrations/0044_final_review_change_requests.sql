CREATE TABLE IF NOT EXISTS final_review_change_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  requested_role TEXT NOT NULL CHECK (requested_role IN ('couple','planner','manager')),
  detail TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','accepted','declined','resolved')),
  manager_note TEXT,
  decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_final_review_change_event ON final_review_change_requests(event_id, status, created_at);
