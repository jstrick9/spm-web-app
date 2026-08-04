-- Migration 0052: seal webhook signing secrets (MODULE-09 IN-04).
--
-- The webhooks.secret column stored outbound signing secrets AND inbound
-- verification secrets in PLAINTEXT, and routes returned them to the client —
-- violating the platform rule that secrets are never returned. Add a sealed
-- column (WEDDING_SECRETS_KEY encryption), backfill by sealing existing
-- values, then drop the plaintext column.
ALTER TABLE webhooks ADD COLUMN secret_payload TEXT;
UPDATE webhooks SET secret_payload = secret WHERE secret IS NOT NULL AND secret != '';
ALTER TABLE webhooks DROP COLUMN secret;
