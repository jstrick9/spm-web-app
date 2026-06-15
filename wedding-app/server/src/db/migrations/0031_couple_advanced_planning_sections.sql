-- ============================================================
-- Migration 0031: Normalize large couple advanced planning sections
-- ============================================================

CREATE TABLE IF NOT EXISTS couple_ceremony_plans (
  event_id        TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payload         TEXT NOT NULL DEFAULT '{}',
  updated_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS couple_wedding_party_plans (
  event_id        TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payload         TEXT NOT NULL DEFAULT '{}',
  updated_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS couple_vip_notes_plans (
  event_id        TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payload         TEXT NOT NULL DEFAULT '{}',
  privacy_scope   TEXT NOT NULL DEFAULT 'venue_planner_only' CHECK (privacy_scope IN ('venue_planner_only','couple_venue','couple_private')),
  updated_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS couple_transportation_plans (
  event_id        TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payload         TEXT NOT NULL DEFAULT '{}',
  updated_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS couple_memory_book_plans (
  event_id        TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payload         TEXT NOT NULL DEFAULT '{}',
  updated_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_couple_ceremony_plans_org ON couple_ceremony_plans(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_couple_wedding_party_plans_org ON couple_wedding_party_plans(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_couple_vip_notes_plans_org ON couple_vip_notes_plans(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_couple_transportation_plans_org ON couple_transportation_plans(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_couple_memory_book_plans_org ON couple_memory_book_plans(organization_id, updated_at DESC);
