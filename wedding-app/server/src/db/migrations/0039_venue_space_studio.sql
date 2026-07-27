-- First-class, reusable venue-space scaffolds for the Venue Studio.
ALTER TABLE venues ADD COLUMN unit_system TEXT NOT NULL DEFAULT 'imperial' CHECK (unit_system IN ('imperial','metric'));
ALTER TABLE venues ADD COLUMN template_key TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE venues ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'draft' CHECK (approval_status IN ('draft','approved','archived'));
ALTER TABLE venues ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE venues ADD COLUMN underlay TEXT NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS venue_space_versions (
  id TEXT PRIMARY KEY,
  venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  master_layout TEXT NOT NULL,
  underlay TEXT NOT NULL DEFAULT '{}',
  change_description TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(venue_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_venue_space_versions_venue ON venue_space_versions(venue_id, revision DESC);
