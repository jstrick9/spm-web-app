-- ============================================================
-- Migration 0006: Contracts, Inventory, Gallery
-- ============================================================

-- ─── CONTRACTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contracts (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','signed','expired')),
  recipient_name  TEXT NOT NULL DEFAULT '',
  recipient_email TEXT,
  amount_cents    INTEGER CHECK (amount_cents IS NULL OR amount_cents >= 0),
  content         TEXT NOT NULL DEFAULT '',
  sent_at         TEXT,
  signed_at       TEXT,
  signature       TEXT,
  signer_ip       TEXT,
  metadata        TEXT NOT NULL DEFAULT '{}',
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_contracts_event ON contracts(event_id);

-- ─── INVENTORY ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sku             TEXT NOT NULL DEFAULT '',
  name            TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other'
                  CHECK (category IN ('chair','linen','centerpiece','av','lighting','tableware','other')),
  total_count     INTEGER NOT NULL DEFAULT 0 CHECK (total_count >= 0),
  available_count INTEGER NOT NULL DEFAULT 0 CHECK (available_count >= 0),
  condition       TEXT NOT NULL DEFAULT 'good'
                  CHECK (condition IN ('good','fair','poor','maintenance')),
  owner_type      TEXT NOT NULL DEFAULT 'venue'
                  CHECK (owner_type IN ('venue','vendor_rental')),
  notes           TEXT,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inventory_org ON inventory_items(organization_id);

-- ─── GALLERY ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gallery_images (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  url             TEXT NOT NULL,       -- data URI, blob URL, or path
  category        TEXT NOT NULL DEFAULT 'vibe',
  caption         TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  uploaded_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gallery_event ON gallery_images(event_id);

INSERT OR IGNORE INTO schema_version (version) VALUES (6);
