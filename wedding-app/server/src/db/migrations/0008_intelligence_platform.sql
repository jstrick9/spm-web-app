-- ============================================================
-- Migration 0008: Intelligence Platform Features
-- Lead source tracking, RSVP deadlines, vendor ratings,
-- email templates, multi-venue, payment processing
-- ============================================================

-- ─── LEAD SOURCE on events ──────────────────────────────
-- Track where each inquiry/lead came from for marketing ROI
ALTER TABLE events ADD COLUMN lead_source TEXT DEFAULT NULL;
ALTER TABLE events ADD COLUMN rsvp_deadline TEXT DEFAULT NULL;

-- ─── VENDOR RATINGS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_ratings (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vendor_id       TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  quality_score   INTEGER CHECK (quality_score >= 1 AND quality_score <= 5),
  timeliness_score INTEGER CHECK (timeliness_score >= 1 AND timeliness_score <= 5),
  communication_score INTEGER CHECK (communication_score >= 1 AND communication_score <= 5),
  review          TEXT,
  rated_by        TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (vendor_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_vendor_ratings_vendor ON vendor_ratings(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_ratings_event ON vendor_ratings(event_id);

-- ─── EMAIL TEMPLATES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_templates (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body_html       TEXT NOT NULL DEFAULT '',
  body_text       TEXT NOT NULL DEFAULT '',
  category        TEXT NOT NULL DEFAULT 'general'
                  CHECK (category IN ('save_the_date','invitation','rsvp_reminder','thank_you','logistics','custom')),
  merge_fields    TEXT NOT NULL DEFAULT '[]',
  is_default      INTEGER NOT NULL DEFAULT 0,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_templates_org ON email_templates(organization_id);

-- ─── VENUE ASSIGNMENTS (multi-venue support) ────────────
-- Links events to specific venue locations within an org
ALTER TABLE events ADD COLUMN venue_id TEXT REFERENCES venues(id) ON DELETE SET NULL;

-- ─── PAYMENT TRACKING ───────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_links (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT REFERENCES events(id) ON DELETE CASCADE,
  contract_id     TEXT REFERENCES contracts(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL DEFAULT 'manual'
                  CHECK (provider IN ('manual','stripe','square','paypal')),
  external_id     TEXT,
  amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','processing','completed','failed','refunded')),
  payment_url     TEXT,
  paid_at         TEXT,
  metadata        TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_payment_links_event ON payment_links(event_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_contract ON payment_links(contract_id);

INSERT OR IGNORE INTO schema_version (version) VALUES (8);
