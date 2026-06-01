-- ============================================================
-- Migration 0005: Budget line items
-- ============================================================

CREATE TABLE IF NOT EXISTS budget_items (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category        TEXT NOT NULL DEFAULT 'Other',
  title           TEXT NOT NULL,
  planned_cents   INTEGER NOT NULL DEFAULT 0 CHECK (planned_cents >= 0),
  actual_cents    INTEGER CHECK (actual_cents IS NULL OR actual_cents >= 0),
  paid_cents      INTEGER NOT NULL DEFAULT 0 CHECK (paid_cents >= 0),
  vendor_id       TEXT REFERENCES vendors(id) ON DELETE SET NULL,
  notes           TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_budget_event ON budget_items(event_id);

INSERT OR IGNORE INTO schema_version (version) VALUES (5);
