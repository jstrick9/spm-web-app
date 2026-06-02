-- ============================================================
-- Migration 0009: Lifecycle Email Engine
-- Turns the existing email_templates + job_queue + SMTP provider
-- into an automated, per-guest lifecycle email system.
--
--   email_automations : per-org rules ("when X happens, send template Y")
--   scheduled_emails  : one row per (automation, guest) send — durable,
--                       idempotent send log + status tracking.
-- ============================================================

-- ─── EMAIL AUTOMATIONS (rules) ──────────────────────────
-- trigger_type:
--   'rsvp_reminder'  → guests with rsvp_status='pending', fired when the
--                      event's rsvp_deadline is `offset_days` away.
--   'thank_you'      → all attending guests, fired when status → completed.
--   'save_the_date'  → all guests, fired manually ("send now").
CREATE TABLE IF NOT EXISTS email_automations (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id     TEXT NOT NULL REFERENCES email_templates(id) ON DELETE CASCADE,
  trigger_type    TEXT NOT NULL CHECK (trigger_type IN
                    ('rsvp_reminder','thank_you','save_the_date','manual')),
  -- For rsvp_reminder: how many days BEFORE rsvp_deadline to send (default 14).
  offset_days     INTEGER NOT NULL DEFAULT 0,
  enabled         INTEGER NOT NULL DEFAULT 1,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  -- At most one rule per (org, trigger_type) keeps the model simple and
  -- prevents accidental duplicate automated sends.
  UNIQUE (organization_id, trigger_type)
);
CREATE INDEX IF NOT EXISTS idx_email_automations_org
  ON email_automations(organization_id);

-- ─── SCHEDULED EMAILS (per-guest send log) ──────────────
-- status: pending → sent | failed | skipped
-- The UNIQUE(event_id, guest_id, trigger_type) constraint is the idempotency
-- key: a guest can never be double-sent the same lifecycle email for an event.
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id        TEXT REFERENCES guests(id) ON DELETE CASCADE,
  automation_id   TEXT REFERENCES email_automations(id) ON DELETE SET NULL,
  template_id     TEXT REFERENCES email_templates(id) ON DELETE SET NULL,
  trigger_type    TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','sent','failed','skipped')),
  job_id          TEXT,
  error           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at         TEXT,
  UNIQUE (event_id, guest_id, trigger_type)
);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_event
  ON scheduled_emails(event_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status
  ON scheduled_emails(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_org
  ON scheduled_emails(organization_id);

-- Marker so the periodic rsvp_reminder scan only fires once per event per day.
-- (Stored as a scheduled_emails row with guest_id NULL + trigger 'rsvp_scan'.)
