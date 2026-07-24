-- Bring guest portal links in line with vendor/invitation lifecycle controls.
ALTER TABLE guests ADD COLUMN portal_token_expires_at TEXT;
ALTER TABLE guests ADD COLUMN portal_token_last_used_at TEXT;
CREATE INDEX IF NOT EXISTS idx_guests_portal_token_expiry ON guests(portal_token_expires_at);
