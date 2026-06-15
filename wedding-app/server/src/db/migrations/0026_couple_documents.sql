-- ============================================================
-- Migration 0026: Couple document hub
-- ============================================================

CREATE TABLE IF NOT EXISTS couple_documents (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  url             TEXT NOT NULL,
  mime_type       TEXT,
  category        TEXT NOT NULL CHECK (category IN ('inspiration_photo','insurance','vendor_doc','ceremony_doc','playlist','diagram','permit','guest_list','menu','contract','post_event_gallery','other')),
  visibility      TEXT NOT NULL DEFAULT 'couple_venue' CHECK (visibility IN ('couple','couple_venue','planner','vendor','guest_visible')),
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('draft','pending','approved','changes_requested','rejected')),
  version         INTEGER NOT NULL DEFAULT 1,
  notes           TEXT,
  extracted_summary TEXT,
  uploaded_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TEXT,
  history         TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_couple_documents_event ON couple_documents(event_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_couple_documents_approval ON couple_documents(event_id, approval_status, visibility);
