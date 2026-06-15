-- Normalized layout/floorplan manager operations records for high-volume day-of
-- floor walk verification, photo evidence, rain plan activation, vendor zone
-- inspections, and signed read-only physical setup packet links.

CREATE TABLE IF NOT EXISTS layout_floor_walk_checks (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT REFERENCES events(id) ON DELETE CASCADE,
  layout_id       TEXT NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  check_id        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','issue')),
  note            TEXT,
  verified_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  verified_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(layout_id, check_id)
);
CREATE INDEX IF NOT EXISTS idx_layout_floor_walk_checks_layout ON layout_floor_walk_checks(layout_id, check_id);
CREATE INDEX IF NOT EXISTS idx_layout_floor_walk_checks_event ON layout_floor_walk_checks(event_id, status);

CREATE TABLE IF NOT EXISTS layout_variance_evidence (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT REFERENCES events(id) ON DELETE CASCADE,
  layout_id       TEXT NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  note            TEXT NOT NULL,
  photo_url       TEXT,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_layout_variance_evidence_layout ON layout_variance_evidence(layout_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_layout_variance_evidence_event ON layout_variance_evidence(event_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS layout_rain_plan_activations (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT REFERENCES events(id) ON DELETE CASCADE,
  layout_id       TEXT NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  active          INTEGER NOT NULL DEFAULT 0,
  note            TEXT,
  activated_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  activated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_layout_rain_plan_layout ON layout_rain_plan_activations(layout_id, activated_at DESC);
CREATE INDEX IF NOT EXISTS idx_layout_rain_plan_event ON layout_rain_plan_activations(event_id, activated_at DESC);

CREATE TABLE IF NOT EXISTS layout_vendor_zone_inspections (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT REFERENCES events(id) ON DELETE CASCADE,
  layout_id       TEXT NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  vendor_id       TEXT REFERENCES vendors(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','issue')),
  zone_label      TEXT,
  note            TEXT,
  inspected_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  inspected_at    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(layout_id, vendor_id)
);
CREATE INDEX IF NOT EXISTS idx_layout_vendor_zone_inspections_layout ON layout_vendor_zone_inspections(layout_id, status);
CREATE INDEX IF NOT EXISTS idx_layout_vendor_zone_inspections_vendor ON layout_vendor_zone_inspections(vendor_id, status);

CREATE TABLE IF NOT EXISTS layout_setup_packets (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT REFERENCES events(id) ON DELETE CASCADE,
  layout_id       TEXT NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  audience        TEXT NOT NULL DEFAULT 'setup_crew' CHECK (audience IN ('setup_crew','vendors','planner','fire_marshal')),
  payload         TEXT NOT NULL DEFAULT '{}',
  expires_at      TEXT,
  revoked_at      TEXT,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(layout_id, audience)
);
CREATE INDEX IF NOT EXISTS idx_layout_setup_packets_layout ON layout_setup_packets(layout_id, audience);
CREATE INDEX IF NOT EXISTS idx_layout_setup_packets_token ON layout_setup_packets(token);
