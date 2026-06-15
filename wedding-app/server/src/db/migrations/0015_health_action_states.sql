-- ============================================================
-- Migration 0015: Persistent Event Health Command action states
-- acknowledge / snooze / assign / resolve state per generated action.
-- ============================================================

CREATE TABLE IF NOT EXISTS health_action_states (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  action_id       TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','acknowledged','snoozed','resolved')),
  snoozed_until   TEXT,
  assigned_to     TEXT REFERENCES users(id) ON DELETE SET NULL,
  note            TEXT,
  updated_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, action_id)
);

CREATE INDEX IF NOT EXISTS idx_health_action_states_org_status ON health_action_states(organization_id, status, snoozed_until);
