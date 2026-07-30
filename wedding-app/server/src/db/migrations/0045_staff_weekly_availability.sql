CREATE TABLE IF NOT EXISTS staff_weekly_availability (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (starts_at < ends_at),
  UNIQUE(organization_id, staff_id, day_of_week, starts_at, ends_at)
);
CREATE INDEX IF NOT EXISTS idx_staff_weekly_availability_org_staff ON staff_weekly_availability(organization_id, staff_id, day_of_week);
