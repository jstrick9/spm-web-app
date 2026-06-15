-- ============================================================
-- Migration 0028: Couple calendar appointments
-- ============================================================

CREATE TABLE IF NOT EXISTS couple_appointments (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  requester_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  appointment_type TEXT NOT NULL CHECK (appointment_type IN ('tasting','planning_meeting','final_walkthrough','rehearsal','payment','tour','other')),
  title           TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','confirmed','reschedule_requested','cancel_requested','completed','cancelled')),
  starts_at       TEXT,
  ends_at         TEXT,
  location        TEXT,
  note            TEXT,
  preparation     TEXT NOT NULL DEFAULT '[]',
  reminders       TEXT NOT NULL DEFAULT '[]',
  availability_window TEXT,
  provider_sync   TEXT NOT NULL DEFAULT '{}',
  signoff         TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_couple_appointments_event ON couple_appointments(event_id, starts_at, status);
CREATE INDEX IF NOT EXISTS idx_couple_appointments_requester ON couple_appointments(requester_user_id, event_id);
