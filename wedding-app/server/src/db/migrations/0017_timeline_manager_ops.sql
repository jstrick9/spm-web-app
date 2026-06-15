-- Manager timeline operations records for cross-device visibility, auditability,
-- reporting, and event-day export/offline continuity.

CREATE TABLE IF NOT EXISTS timeline_change_logs (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id         TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  timeline_item_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
  change_type      TEXT NOT NULL,
  summary          TEXT NOT NULL,
  payload          TEXT NOT NULL DEFAULT '{}',
  created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_timeline_change_logs_event ON timeline_change_logs(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_change_logs_item ON timeline_change_logs(timeline_item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS timeline_approvals (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('manager','owner','planner')),
  status          TEXT NOT NULL CHECK (status IN ('not_started','requested','approved','changes_requested')),
  note            TEXT,
  requested_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, role)
);
CREATE INDEX IF NOT EXISTS idx_timeline_approvals_event ON timeline_approvals(event_id, role);

CREATE TABLE IF NOT EXISTS timeline_incidents (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id         TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  timeline_item_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
  severity         TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','delay','incident','critical')),
  note             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','monitoring','resolved')),
  created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_timeline_incidents_event ON timeline_incidents(event_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_incidents_item ON timeline_incidents(timeline_item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS timeline_reminders (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id         TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  timeline_item_id TEXT REFERENCES timeline_events(id) ON DELETE CASCADE,
  remind_at        TEXT NOT NULL,
  channel          TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','sms','email')),
  audience         TEXT NOT NULL DEFAULT 'venue_staff' CHECK (audience IN ('venue_staff','vendors','couple','planner')),
  status           TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','cancelled')),
  payload          TEXT NOT NULL DEFAULT '{}',
  created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_timeline_reminders_event ON timeline_reminders(event_id, remind_at);
CREATE INDEX IF NOT EXISTS idx_timeline_reminders_item ON timeline_reminders(timeline_item_id, remind_at);

CREATE TABLE IF NOT EXISTS event_offline_packets (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  audience        TEXT NOT NULL CHECK (audience IN ('venue_staff','vendors','couple','planner')),
  payload         TEXT NOT NULL DEFAULT '{}',
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, audience)
);
CREATE INDEX IF NOT EXISTS idx_event_offline_packets_event ON event_offline_packets(event_id, audience);
