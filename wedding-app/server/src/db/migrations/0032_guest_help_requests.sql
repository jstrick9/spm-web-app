-- ============================================================
-- Migration 0032: Guest portal help requests
-- ============================================================

CREATE TABLE IF NOT EXISTS guest_help_requests (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id        TEXT REFERENCES guests(id) ON DELETE SET NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('cannot_find_name','wrong_guest','expired_or_revoked','other')),
  name            TEXT,
  email           TEXT,
  message         TEXT,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','resolved','closed')),
  assigned_to     TEXT,
  resolution_note TEXT,
  created_ip      TEXT,
  user_agent      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guest_help_requests_event ON guest_help_requests(event_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_help_requests_org ON guest_help_requests(organization_id, created_at DESC);
