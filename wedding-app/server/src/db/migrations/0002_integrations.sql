-- ============================================================
-- Migration 0002 — Integration framework
-- ============================================================
-- Tables for the pluggable external-service integration system.
--
-- Design notes:
--   * `integrations` holds one row per (org, provider). Credentials are
--     stored as `secret_payload` (libsodium-sealed JSON). The decryption
--     key lives in WEDDING_SECRETS_KEY (env), never on disk.
--   * `integration_events` is an append-only audit log for everything
--     that flows through an integration (webhook received, message sent,
--     poll completed, etc.). Indispensable for debugging.
--   * `oauth_states` stores short-lived OAuth state tokens (anti-CSRF +
--     ties the callback to the org that initiated the flow).
--   * `job_queue` is a tiny single-table durable job queue for async work
--     (send email, poll Calendly). No external dependency (no Redis).
-- ============================================================

-- ─── INTEGRATIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS integrations (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,             -- 'email_smtp' / 'calendly' / 'square' / ...
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','connected','disabled','error','revoked')),
  display_name    TEXT,                       -- "Acme Venues Gmail SMTP" — admin-set
  -- Public config (JSON, NOT secret) — e.g. SMTP host, sender address, webhook URL we exposed back
  config          TEXT NOT NULL DEFAULT '{}',
  -- Encrypted credentials (libsodium sealed_box ciphertext, base64).
  -- NULL until the credentials are first set. Decryption is in code via WEDDING_SECRETS_KEY.
  secret_payload  TEXT,
  -- Webhook secret (HMAC signing key) we share with the provider so we can verify inbound
  -- webhook signatures. NULL for providers that don't use HMAC.
  webhook_secret  TEXT,
  last_error      TEXT,
  last_synced_at  TEXT,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, provider)
);
CREATE INDEX IF NOT EXISTS idx_integrations_org      ON integrations(organization_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);

-- ─── INTEGRATION EVENTS (audit log per integration) ─────
CREATE TABLE IF NOT EXISTS integration_events (
  id              TEXT PRIMARY KEY,
  integration_id  TEXT NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  direction       TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  kind            TEXT NOT NULL,             -- 'webhook.received' / 'email.sent' / 'poll.ok' / 'oauth.refreshed' / etc.
  status          TEXT NOT NULL CHECK (status IN ('ok','error','retry','dropped')),
  payload         TEXT NOT NULL DEFAULT '{}',-- JSON; for inbound webhooks: redacted body
  error_message   TEXT,
  related_type    TEXT,                       -- 'event' / 'guest' / 'vendor' / ...
  related_id      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_integration_events_int  ON integration_events(integration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_events_org  ON integration_events(organization_id, created_at DESC);

-- ─── OAUTH STATE (short-lived) ───────────────────────────
-- Holds the `state` parameter we generated for an OAuth authorization
-- request. The callback must present the same state to prove we initiated
-- the flow. Rows expire after 10 minutes.
CREATE TABLE IF NOT EXISTS oauth_states (
  state           TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  redirect_path   TEXT,                       -- where to send the user after callback
  pkce_verifier   TEXT,                       -- PKCE: stash the verifier; sent only at token exchange
  expires_at      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expiry ON oauth_states(expires_at);

-- ─── JOB QUEUE (durable, single-table) ──────────────────
-- Minimal persistent job queue for async work that integrations spawn:
--   - send email
--   - poll a provider for updates
--   - retry a failed webhook handler
-- The worker (src/jobs/worker.ts) polls this table every ~1s.
CREATE TABLE IF NOT EXISTS job_queue (
  id              TEXT PRIMARY KEY,
  kind            TEXT NOT NULL,             -- 'email.send' / 'integration.poll' / ...
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  payload         TEXT NOT NULL DEFAULT '{}',
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','running','succeeded','failed','dead')),
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,
  run_at          TEXT NOT NULL DEFAULT (datetime('now')),
  last_error      TEXT,
  result          TEXT,
  locked_at       TEXT,                       -- when a worker picked it up
  locked_by       TEXT,                       -- pid:hostname of the worker
  finished_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_job_queue_dispatch ON job_queue(status, run_at);
CREATE INDEX IF NOT EXISTS idx_job_queue_kind     ON job_queue(kind, status);

INSERT OR IGNORE INTO schema_version (version) VALUES (2);
