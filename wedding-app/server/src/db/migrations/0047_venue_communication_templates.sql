CREATE TABLE IF NOT EXISTS venue_communication_templates (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('rain_plan','timing_change','parking','arrival','guest_guidance','other')),
  audience TEXT NOT NULL CHECK (audience IN ('couple','guests','both')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_venue_communication_templates_org ON venue_communication_templates(organization_id, active, category);
