-- Durable retry state for outbound webhook delivery failures.
ALTER TABLE webhook_deliveries ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE webhook_deliveries ADD COLUMN next_retry_at TEXT;
ALTER TABLE webhook_deliveries ADD COLUMN terminal_at TEXT;
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at, terminal_at);
