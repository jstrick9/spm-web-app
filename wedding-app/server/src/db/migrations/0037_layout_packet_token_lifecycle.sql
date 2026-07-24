-- Hash newly issued layout packet tokens; existing raw tokens remain readable
-- only as a legacy compatibility path until operators rotate them.
ALTER TABLE layout_setup_packets ADD COLUMN token_salt TEXT;
ALTER TABLE layout_setup_packets ADD COLUMN token_last_used_at TEXT;
CREATE INDEX IF NOT EXISTS idx_layout_packets_expiry ON layout_setup_packets(expires_at, revoked_at);
