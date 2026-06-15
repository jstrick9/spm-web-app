-- ============================================================
-- Migration 0023: Event-scoped invitations for booked couples
-- ============================================================

ALTER TABLE team_invitations ADD COLUMN event_id TEXT REFERENCES events(id) ON DELETE CASCADE;
ALTER TABLE team_invitations ADD COLUMN invitation_type TEXT NOT NULL DEFAULT 'organization'
  CHECK (invitation_type IN ('organization','event'));

CREATE INDEX IF NOT EXISTS idx_team_invitations_event ON team_invitations(event_id, created_at DESC);
