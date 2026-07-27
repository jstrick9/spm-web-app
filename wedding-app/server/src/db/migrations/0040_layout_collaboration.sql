-- Planner/couple review workflow for event-specific layout revisions.
CREATE TABLE IF NOT EXISTS layout_comments (
  id TEXT PRIMARY KEY,
  layout_id TEXT NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  author_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  author_label TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  target_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_layout_comments_layout ON layout_comments(layout_id, revision, status, created_at);

CREATE TABLE IF NOT EXISTS layout_review_requests (
  id TEXT PRIMARY KEY,
  layout_id TEXT NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  decision TEXT NOT NULL DEFAULT 'pending' CHECK(decision IN ('pending','approved','changes_requested','rejected')),
  decision_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_layout_review_requests_layout ON layout_review_requests(layout_id, revision, decision);
