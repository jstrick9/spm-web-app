-- ============================================================
-- Migration 0024: Couple requests, approvals, identity safeguards
-- ============================================================

CREATE TABLE IF NOT EXISTS couple_portal_requests (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  requester_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  request_type    TEXT NOT NULL CHECK (request_type IN ('partner_invite','planner_request','account_recovery','identity_verification','venue_question','event_change_request','guest_portal_update','rsvp_reminder_request','vendor_request','vendor_question','planner_collaboration','finance_question','change_order_request','design_preferences_review','decision_needed','post_event_lost_item','post_event_feedback','review_testimonial_request')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed','cancelled')),
  target_email    TEXT,
  target_name     TEXT,
  note            TEXT,
  metadata        TEXT NOT NULL DEFAULT '{}',
  reviewed_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_couple_portal_requests_event ON couple_portal_requests(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_couple_portal_requests_requester ON couple_portal_requests(requester_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_couple_portal_requests_status ON couple_portal_requests(organization_id, status, request_type);
