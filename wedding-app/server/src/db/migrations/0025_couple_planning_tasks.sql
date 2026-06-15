-- ============================================================
-- Migration 0025: Couple planning checklist and decision tracker
-- ============================================================

CREATE TABLE IF NOT EXISTS couple_planning_tasks (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  template_key    TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  owner           TEXT NOT NULL CHECK (owner IN ('couple','venue','planner','vendor')),
  due_date        TEXT,
  status          TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed','blocked')),
  approval_status TEXT NOT NULL DEFAULT 'not_required' CHECK (approval_status IN ('not_required','pending','approved','changes_requested')),
  decision_category TEXT CHECK (decision_category IN ('ceremony','reception','menu','music','floor_plan','decor','signage','transportation','lodging','documents','guest_list','timeline','other')),
  attachments     TEXT NOT NULL DEFAULT '[]',
  history         TEXT NOT NULL DEFAULT '[]',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, template_key)
);

CREATE INDEX IF NOT EXISTS idx_couple_planning_tasks_event ON couple_planning_tasks(event_id, sort_order, due_date);
CREATE INDEX IF NOT EXISTS idx_couple_planning_tasks_status ON couple_planning_tasks(event_id, status, approval_status);
