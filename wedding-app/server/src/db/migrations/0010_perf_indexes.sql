-- Migration 0010: Performance indexes for intelligence queries
-- These covering indexes support:
--   • forecast.ts  — trailing-12-month GROUP BY strftime('%Y-%m', start_date)
--   • recommendations.ts — seasonal heatmap, lead source ROI
--   • risk.ts       — listing active events by org + status
--   • lifecycle emails — RSVP deadline scan
--   • scheduled_emails — idempotency lookups
--
-- All are CREATE INDEX IF NOT EXISTS so this migration is safe to re-run.

-- ── Events ──────────────────────────────────────────────────────────────────

-- Used by forecast.ts GROUP BY ym and recommendations.ts seasonal heatmap
CREATE INDEX IF NOT EXISTS idx_events_org_date
  ON events(organization_id, start_date)
  WHERE deleted_at IS NULL;

-- Used by risk.ts and pipeline revenue queries
CREATE INDEX IF NOT EXISTS idx_events_org_status
  ON events(organization_id, status)
  WHERE deleted_at IS NULL;

-- Used by nightly lifecycle email scan (RSVP deadline proximity)
CREATE INDEX IF NOT EXISTS idx_events_rsvp_deadline
  ON events(organization_id, rsvp_deadline)
  WHERE rsvp_deadline IS NOT NULL AND deleted_at IS NULL;

-- ── Guests ───────────────────────────────────────────────────────────────────

-- Used by guest identity resolution (email matching)
CREATE INDEX IF NOT EXISTS idx_guests_org_email
  ON guests(organization_id, email)
  WHERE deleted_at IS NULL AND email IS NOT NULL;

-- Used by runTrigger guest iteration
CREATE INDEX IF NOT EXISTS idx_guests_event_email
  ON guests(event_id, email)
  WHERE deleted_at IS NULL;

-- ── Vendor ratings ───────────────────────────────────────────────────────────

-- Used by vendorScoringRepo.aggregate — per-vendor score rollup
CREATE INDEX IF NOT EXISTS idx_vendor_ratings_vendor
  ON vendor_ratings(vendor_id, created_at);

-- ── Scheduled emails ─────────────────────────────────────────────────────────

-- Primary idempotency lookup
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_idempotency
  ON scheduled_emails(event_id, guest_id, trigger_type);

-- Used by scheduledEmailsRepo.findRecentSend (cooldown check)
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_event_trigger
  ON scheduled_emails(event_id, trigger_type, created_at);

-- Used by scheduledEmailsRepo.listForEvent
CREATE INDEX IF NOT EXISTS idx_scheduled_emails_event
  ON scheduled_emails(event_id, created_at DESC);

-- ── Audit log ────────────────────────────────────────────────────────────────

-- Org-scoped audit log queries (AuditLog screen)
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_ts
  ON audit_logs(organization_id, created_at DESC);

-- ── Webhooks ─────────────────────────────────────────────────────────────────

-- Used by webhooksRepo.matchingHooks (org + event_type filter)
CREATE INDEX IF NOT EXISTS idx_webhooks_org_event_type
  ON webhooks(organization_id, event_types, is_active)
  WHERE is_active = 1;
