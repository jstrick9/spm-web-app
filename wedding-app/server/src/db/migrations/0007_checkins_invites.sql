-- ============================================================
-- Migration 0007: Vendor check-ins + invitation tracking
-- ============================================================

-- ─── VENDOR CHECK-INS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_checkins (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id       TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'expected'
                  CHECK (status IN ('expected','arrived','setup','completed','departed','late')),
  checked_in_at   TEXT,
  checked_in_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, vendor_id)
);
CREATE INDEX IF NOT EXISTS idx_checkins_event ON vendor_checkins(event_id);

-- ─── INVITATION TRACKING ────────────────────────────────
CREATE TABLE IF NOT EXISTS invite_tracking (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id        TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'not_sent'
                  CHECK (status IN ('not_sent','sent','opened','bounced')),
  sent_at         TEXT,
  opened_at       TEXT,
  channel         TEXT NOT NULL DEFAULT 'email',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, guest_id)
);
CREATE INDEX IF NOT EXISTS idx_invites_event ON invite_tracking(event_id);

INSERT OR IGNORE INTO schema_version (version) VALUES (7);
