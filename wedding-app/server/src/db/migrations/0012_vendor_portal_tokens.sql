-- ============================================================
-- Migration 0012: Vendor Portal Tokens
-- Signed/revocable/expiring public vendor portal links.
-- ============================================================

CREATE TABLE IF NOT EXISTS vendor_portal_tokens (
  id          TEXT PRIMARY KEY,
  vendor_id   TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  token_salt  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT,
  last_used_at TEXT,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vendor_portal_tokens_vendor
  ON vendor_portal_tokens(vendor_id, revoked_at, expires_at);

INSERT OR IGNORE INTO schema_version (version) VALUES (12);
