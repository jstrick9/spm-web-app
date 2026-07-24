-- Explicit asset ownership and revocable external-access capabilities.
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('gallery_image','couple_document','vendor_coi','layout_variance')),
  owner_id TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT,
  visibility TEXT NOT NULL CHECK (visibility IN ('private','public','capability')) DEFAULT 'private',
  publish_status TEXT NOT NULL CHECK (publish_status IN ('draft','approved','rejected')) DEFAULT 'draft',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assets_owner ON assets(owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_assets_event ON assets(event_id, visibility, publish_status);

CREATE TABLE IF NOT EXISTS asset_capabilities (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  token_salt TEXT NOT NULL,
  audience TEXT NOT NULL CHECK (audience IN ('guest','vendor','planner','external')),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_asset_capabilities_asset ON asset_capabilities(asset_id, expires_at);

-- Backfill records created by the first protected-storage rollout. Legacy
-- external URLs deliberately remain outside this table and continue through
-- the controlled redirect path until an operator imports/replaces them.
INSERT OR IGNORE INTO assets (id, organization_id, event_id, owner_type, owner_id, storage_key, original_filename, mime_type, visibility, publish_status, created_by)
SELECT 'couple_document:' || id, organization_id, event_id, 'couple_document', id, url, filename, mime_type,
       'private', CASE WHEN visibility = 'guest_visible' AND approval_status = 'approved' THEN 'approved' ELSE 'draft' END, uploaded_by
FROM couple_documents WHERE url LIKE '/uploads/private/%';

INSERT OR IGNORE INTO assets (id, organization_id, event_id, owner_type, owner_id, storage_key, original_filename, mime_type, visibility, publish_status, created_by)
SELECT 'layout_variance:' || id, organization_id, event_id, 'layout_variance', id, photo_url, 'variance-evidence', NULL, 'private', 'draft', created_by
FROM layout_variance_evidence WHERE photo_url LIKE '/uploads/private/%';

INSERT OR IGNORE INTO assets (id, organization_id, event_id, owner_type, owner_id, storage_key, original_filename, mime_type, visibility, publish_status, created_by)
SELECT 'vendor_coi:' || id, organization_id, event_id, 'vendor_coi', id,
       json_extract(metadata, '$.coiLink'), COALESCE(json_extract(metadata, '$.coiFileName'), 'certificate-of-insurance'),
       json_extract(metadata, '$.coiMimeType'), 'capability', 'approved', NULL
FROM vendors WHERE json_extract(metadata, '$.coiLink') LIKE '/uploads/private/%';
