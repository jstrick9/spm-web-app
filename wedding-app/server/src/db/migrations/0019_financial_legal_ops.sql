-- Normalized financial/legal operations records for manager-visible escalation,
-- go/no-go flags, and contract obligation extraction/reporting.

CREATE TABLE IF NOT EXISTS event_financial_legal_escalations (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_type     TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('contract','payment','legal','manual')),
  source_id       TEXT,
  severity        TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info','warning','blocked')),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  label           TEXT NOT NULL,
  detail          TEXT,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_finleg_escalations_event ON event_financial_legal_escalations(event_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS event_go_no_go_flags (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  flag_type       TEXT NOT NULL DEFAULT 'financial_legal',
  source_type     TEXT NOT NULL DEFAULT 'manual' CHECK (source_type IN ('contract','payment','legal','manual')),
  source_id       TEXT,
  severity        TEXT NOT NULL DEFAULT 'blocked' CHECK (severity IN ('warning','blocked')),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','owner_approved','resolved')),
  label           TEXT NOT NULL,
  detail          TEXT,
  requires_owner_approval INTEGER NOT NULL DEFAULT 1,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_go_no_go_event ON event_go_no_go_flags(event_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS contract_obligation_extracts (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  contract_id     TEXT NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  obligation_key  TEXT NOT NULL,
  label           TEXT NOT NULL,
  excerpt         TEXT,
  confidence      TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low','medium','high')),
  status          TEXT NOT NULL DEFAULT 'detected' CHECK (status IN ('detected','approved','dismissed')),
  approved_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(contract_id, obligation_key)
);
CREATE INDEX IF NOT EXISTS idx_contract_obligation_event ON contract_obligation_extracts(event_id, status, obligation_key);
CREATE INDEX IF NOT EXISTS idx_contract_obligation_contract ON contract_obligation_extracts(contract_id, obligation_key);
