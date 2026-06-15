-- ============================================================
-- Migration 0014: Team invitations for not-yet-registered users
-- ============================================================

CREATE TABLE IF NOT EXISTS team_invitations (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL COLLATE NOCASE,
  role_id         TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  token_hash      TEXT NOT NULL,
  token_salt      TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  accepted_at     TEXT,
  revoked_at      TEXT,
  invited_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_org ON team_invitations(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email, expires_at, accepted_at, revoked_at);
