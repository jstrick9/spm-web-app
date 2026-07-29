-- Formal operational review between planning and the event-week completion stage.
PRAGMA foreign_keys=OFF;
CREATE TABLE events_final_review (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('lead','hold','booked','planning','final_review','completed','cancelled','lost')),
  start_date TEXT, end_date TEXT, guest_count INTEGER NOT NULL DEFAULT 0,
  primary_contact_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  budget_cents INTEGER, rsvp_deadline TEXT, lead_source TEXT, venue_id TEXT REFERENCES venues(id) ON DELETE SET NULL,
  metadata TEXT NOT NULL DEFAULT '{}', deleted_at TEXT, created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO events_final_review SELECT id, organization_id, title, slug, status, start_date, end_date, guest_count, primary_contact_user_id, budget_cents, rsvp_deadline, lead_source, venue_id, metadata, deleted_at, created_by, created_at, updated_at FROM events;
DROP TABLE events;
ALTER TABLE events_final_review RENAME TO events;
CREATE INDEX IF NOT EXISTS idx_events_org ON events(organization_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_events_slug ON events(organization_id, slug);
PRAGMA foreign_keys=ON;
