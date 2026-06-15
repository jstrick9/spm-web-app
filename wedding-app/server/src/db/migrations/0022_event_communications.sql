CREATE TABLE IF NOT EXISTS event_communication_audit_logs (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  channel         TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','sms','email','all')),
  audience        TEXT NOT NULL DEFAULT 'all' CHECK (audience IN ('staff','vendors','guests','all')),
  severity        TEXT NOT NULL DEFAULT 'fyi' CHECK (severity IN ('fyi','action_needed','urgent','owner_escalation')),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  delivery_status TEXT NOT NULL DEFAULT 'queued' CHECK (delivery_status IN ('queued','sent','partial','failed')),
  approval_required INTEGER NOT NULL DEFAULT 0,
  quiet_hours_override INTEGER NOT NULL DEFAULT 0,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_event_comm_audit_event ON event_communication_audit_logs(event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS event_broadcast_recipients (
  id              TEXT PRIMARY KEY,
  broadcast_id    TEXT NOT NULL REFERENCES event_communication_audit_logs(id) ON DELETE CASCADE,
  recipient_type  TEXT NOT NULL,
  recipient_label TEXT NOT NULL,
  contact         TEXT,
  channel         TEXT NOT NULL DEFAULT 'in_app',
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','skipped')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_event_broadcast_recipients_broadcast ON event_broadcast_recipients(broadcast_id, status);
