-- ============================================================
-- Wedding Venue App - SQLite schema v2
-- ============================================================
-- Phase 1 of the full migration. Covers every domain present in
-- the original localStorage app. Designed for:
--   * application-layer RBAC (no row-level security needed; we
--     enforce in Fastify routes)
--   * jsonb-like flexibility via TEXT + json_extract()
--   * easy backups (one file, atomic snapshot with .backup)
--
-- Conventions:
--   - All ids are UUID strings (generated in Node, not SQLite)
--   - All timestamps are TEXT ISO-8601 (SQLite has no real timestamp)
--   - All booleans are INTEGER 0/1 (SQLite has no real boolean)
--   - All JSON fields are TEXT; the repo layer json-parses on read
--   - Soft delete via deleted_at on tables that need it (events,
--     guests, vendors); hard delete on catalog items
--   - Every domain-row has organization_id for tenant isolation
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous  = NORMAL;
PRAGMA temp_store   = MEMORY;
PRAGMA cache_size   = -64000;

-- ============================================================
-- IDENTITY / TENANCY
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE COLLATE NOCASE,
  full_name           TEXT NOT NULL DEFAULT '',
  password_hash       TEXT NOT NULL,
  password_salt       TEXT NOT NULL,
  password_algorithm  TEXT NOT NULL DEFAULT 'pbkdf2-sha256',
  password_updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  session_version     INTEGER NOT NULL DEFAULT 1,
  failed_login_count  INTEGER NOT NULL DEFAULT 0,
  locked_until        TEXT,
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('invited','active','suspended','disabled')),
  avatar_path         TEXT,
  phone               TEXT,
  preferences         TEXT NOT NULL DEFAULT '{}',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  token_salt   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  used_at      TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id, expires_at, used_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);

CREATE TABLE IF NOT EXISTS organizations (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  support_email TEXT,
  phone         TEXT,
  website_url   TEXT,
  owner_id      TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  branding      TEXT NOT NULL DEFAULT '{}',
  settings      TEXT NOT NULL DEFAULT '{}',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS organization_memberships (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'planner'
                  CHECK (role IN ('owner','admin','planner','staff')),
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('invited','active','suspended','disabled')),
  invited_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org  ON organization_memberships(organization_id);

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

CREATE TABLE IF NOT EXISTS team_invitations (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT REFERENCES events(id) ON DELETE CASCADE,
  invitation_type TEXT NOT NULL DEFAULT 'organization'
                  CHECK (invitation_type IN ('organization','event')),
  email           TEXT NOT NULL COLLATE NOCASE,
  role_id         TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  token_hash      TEXT NOT NULL,
  token_salt      TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  accepted_at     TEXT,
  revoked_at      TEXT,
  invited_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_team_invitations_org ON team_invitations(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_invitations_event ON team_invitations(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON team_invitations(email, expires_at, accepted_at, revoked_at);

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

CREATE TABLE IF NOT EXISTS couple_documents (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  url             TEXT NOT NULL,
  mime_type       TEXT,
  category        TEXT NOT NULL CHECK (category IN ('inspiration_photo','insurance','vendor_doc','ceremony_doc','playlist','diagram','permit','guest_list','menu','contract','post_event_gallery','other')),
  visibility      TEXT NOT NULL DEFAULT 'couple_venue' CHECK (visibility IN ('couple','couple_venue','planner','vendor','guest_visible')),
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('draft','pending','approved','changes_requested','rejected')),
  version         INTEGER NOT NULL DEFAULT 1,
  notes           TEXT,
  extracted_summary TEXT,
  uploaded_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at     TEXT,
  history         TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_couple_documents_event ON couple_documents(event_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_couple_documents_approval ON couple_documents(event_id, approval_status, visibility);

CREATE TABLE IF NOT EXISTS couple_notification_preferences (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_enabled   INTEGER NOT NULL DEFAULT 1,
  sms_enabled     INTEGER NOT NULL DEFAULT 0,
  in_app_enabled  INTEGER NOT NULL DEFAULT 1,
  digest_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (digest_frequency IN ('instant','daily','weekly','off')),
  quiet_hours     TEXT NOT NULL DEFAULT '{}',
  decision_alerts INTEGER NOT NULL DEFAULT 1,
  due_task_alerts INTEGER NOT NULL DEFAULT 1,
  message_alerts  INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_couple_notification_preferences_user ON couple_notification_preferences(user_id, event_id);

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

CREATE TABLE IF NOT EXISTS couple_notification_history (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  reminder_key    TEXT NOT NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('in_app','email','sms','digest')),
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','read','dismissed')),
  due_at          TEXT,
  recipient_role  TEXT NOT NULL DEFAULT 'couple' CHECK (recipient_role IN ('couple','partner','planner')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_couple_notification_history_event ON couple_notification_history(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_couple_notification_history_user ON couple_notification_history(user_id, event_id, status);

-- ============================================================
-- EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  id                       TEXT PRIMARY KEY,
  organization_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title                    TEXT NOT NULL,
  slug                     TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'planning'
                           CHECK (status IN ('lead','hold','booked','planning','final_review','completed','cancelled','lost')),
  start_date               TEXT,
  end_date                 TEXT,
  guest_count              INTEGER NOT NULL DEFAULT 0 CHECK (guest_count >= 0),
  primary_contact_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  budget_cents             INTEGER CHECK (budget_cents IS NULL OR budget_cents >= 0),
  metadata                 TEXT NOT NULL DEFAULT '{}',
  deleted_at               TEXT,
  created_by               TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_events_org    ON events(organization_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(organization_id, status, deleted_at);

CREATE TABLE IF NOT EXISTS event_memberships (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'couple'
             CHECK (role IN ('owner','admin','planner','couple','staff','guest')),
  status     TEXT NOT NULL DEFAULT 'active'
             CHECK (status IN ('invited','active','suspended','disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_memberships_user  ON event_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_event_memberships_event ON event_memberships(event_id);

CREATE TABLE IF NOT EXISTS sub_events (
  id           TEXT PRIMARY KEY,
  event_id     TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  starts_at    TEXT NOT NULL,
  ends_at      TEXT,
  venue_id     TEXT,
  invite_only  INTEGER NOT NULL DEFAULT 0,
  metadata     TEXT NOT NULL DEFAULT '{}',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sub_events_event ON sub_events(event_id);

-- ============================================================
-- VENUES + CATALOG
-- ============================================================

CREATE TABLE IF NOT EXISTS venues (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'reception',
  environment     TEXT NOT NULL DEFAULT 'indoor'
                  CHECK (environment IN ('indoor','outdoor','both')),
  description     TEXT,
  capacity        INTEGER NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  width           REAL NOT NULL DEFAULT 0 CHECK (width >= 0),
  height          REAL NOT NULL DEFAULT 0 CHECK (height >= 0),
  canvas_width    REAL,
  canvas_height   REAL,
  shape           TEXT NOT NULL DEFAULT '{}',
  style           TEXT NOT NULL DEFAULT '{}',
  master_layout   TEXT NOT NULL DEFAULT '{}',
  metadata        TEXT NOT NULL DEFAULT '{}',
  deleted_at      TEXT,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_venues_org ON venues(organization_id, deleted_at);

-- One row per catalog item type. We use a SINGLE catalog_items table
-- with a 'kind' discriminator instead of one table per type, because
-- the original app shares 90% of the structure across tables/fixtures/
-- chairs/walls/linens. Domain queries filter on `kind`.
CREATE TABLE IF NOT EXISTS catalog_items (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL
                  CHECK (kind IN ('table','fixture','chair','wall_style','linen','guideline','spacing','template')),
  name            TEXT NOT NULL,
  spec            TEXT NOT NULL DEFAULT '{}',
  visible         INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_catalog_org_kind ON catalog_items(organization_id, kind);

-- ============================================================
-- LAYOUTS (the floor plan canvas data)
-- ============================================================

CREATE TABLE IF NOT EXISTS layouts (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT REFERENCES events(id) ON DELETE CASCADE,
  venue_id        TEXT REFERENCES venues(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  visibility      TEXT NOT NULL DEFAULT 'event'
                  CHECK (visibility IN ('private','event','venue','public')),
  revision        INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  payload         TEXT NOT NULL DEFAULT '{}',
  is_template     INTEGER NOT NULL DEFAULT 0,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_layouts_org   ON layouts(organization_id);
CREATE INDEX IF NOT EXISTS idx_layouts_event ON layouts(event_id);

CREATE TABLE IF NOT EXISTS layout_versions (
  id                 TEXT PRIMARY KEY,
  layout_id          TEXT NOT NULL REFERENCES layouts(id) ON DELETE CASCADE,
  revision           INTEGER NOT NULL,
  payload            TEXT NOT NULL,
  change_description TEXT,
  created_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (layout_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_layout_versions_layout ON layout_versions(layout_id);

-- ============================================================
-- GUESTS / RSVP / PORTAL
-- ============================================================

CREATE TABLE IF NOT EXISTS guests (
  id                    TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id              TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  full_name             TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  party_name            TEXT,
  rsvp_status           TEXT NOT NULL DEFAULT 'pending'
                        CHECK (rsvp_status IN ('pending','attending','declined','maybe')),
  dietary_restrictions  TEXT,
  accessibility_notes   TEXT,
  table_assignment      TEXT,
  room_assignment       TEXT,
  seat_assignment       TEXT,
  plus_one_allowed      INTEGER NOT NULL DEFAULT 0,
  portal_token_hash     TEXT,
  portal_token_salt     TEXT,
  allow_portal_access   INTEGER NOT NULL DEFAULT 1,
  allow_lodging_access  INTEGER NOT NULL DEFAULT 0,
  metadata              TEXT NOT NULL DEFAULT '{}',
  deleted_at            TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_guests_event ON guests(event_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email);

CREATE TABLE IF NOT EXISTS guest_sub_event_invitations (
  id            TEXT PRIMARY KEY,
  guest_id      TEXT NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  sub_event_id  TEXT NOT NULL REFERENCES sub_events(id) ON DELETE CASCADE,
  rsvp_status   TEXT NOT NULL DEFAULT 'pending',
  UNIQUE (guest_id, sub_event_id)
);

CREATE TABLE IF NOT EXISTS rsvp_submissions (
  id                   TEXT PRIMARY KEY,
  organization_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id             TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id             TEXT REFERENCES guests(id) ON DELETE SET NULL,
  attending            INTEGER NOT NULL,
  attending_days       TEXT NOT NULL DEFAULT '[]',
  meal_choice          TEXT,
  plus_one_name        TEXT,
  plus_one_meal_choice TEXT,
  dietary_notes        TEXT,
  special_needs        TEXT,
  notes                TEXT,
  submitted_at         TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_ip         TEXT,
  user_agent           TEXT
);
CREATE INDEX IF NOT EXISTS idx_rsvp_event ON rsvp_submissions(event_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_guest ON rsvp_submissions(guest_id);

CREATE TABLE IF NOT EXISTS guest_portal_configs (
  id                   TEXT PRIMARY KEY,
  organization_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id             TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  enabled              INTEGER NOT NULL DEFAULT 0,
  password_hash        TEXT,
  password_salt        TEXT,
  access_starts_at     TEXT,
  access_ends_at       TEXT,
  grace_period_hours   INTEGER NOT NULL DEFAULT 36,
  config               TEXT NOT NULL DEFAULT '{}',
  created_by           TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_by           TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id)
);

-- ============================================================
-- DECOR
-- ============================================================

CREATE TABLE IF NOT EXISTS decor_items (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id     TEXT,
  name            TEXT NOT NULL,
  spec            TEXT NOT NULL DEFAULT '{}',
  image_path      TEXT,
  visible         INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_decor_items_org ON decor_items(organization_id);

CREATE TABLE IF NOT EXISTS decor_categories (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  icon            TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS decor_arrangements (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  payload         TEXT NOT NULL DEFAULT '{}',
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS decor_packages (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  style           TEXT,
  description     TEXT,
  arrangements    TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- VENDORS
-- ============================================================

CREATE TABLE IF NOT EXISTS vendors (
  id                    TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id              TEXT REFERENCES events(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  category              TEXT NOT NULL DEFAULT 'other',
  contact_name          TEXT,
  email                 TEXT,
  phone                 TEXT,
  website_url           TEXT,
  contract_amount_cents INTEGER CHECK (contract_amount_cents IS NULL OR contract_amount_cents >= 0),
  amount_paid_cents     INTEGER NOT NULL DEFAULT 0,
  is_preferred          INTEGER NOT NULL DEFAULT 0,
  notes                 TEXT,
  metadata              TEXT NOT NULL DEFAULT '{}',
  deleted_at            TEXT,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vendors_org   ON vendors(organization_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_vendors_event ON vendors(event_id);

CREATE TABLE IF NOT EXISTS vendor_payments (
  id           TEXT PRIMARY KEY,
  vendor_id    TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_at      TEXT NOT NULL,
  method       TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS vendor_portal_tokens (
  id           TEXT PRIMARY KEY,
  vendor_id    TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL,
  token_salt   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  revoked_at   TEXT,
  last_used_at TEXT,
  created_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_vendor_portal_tokens_vendor
  ON vendor_portal_tokens(vendor_id, revoked_at, expires_at);

-- ============================================================
-- TIMELINE
-- ============================================================

CREATE TABLE IF NOT EXISTS timeline_events (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other',
  starts_at       TEXT NOT NULL,
  ends_at         TEXT,
  duration_min    INTEGER,
  location        TEXT,
  notes           TEXT,
  vendor_id       TEXT REFERENCES vendors(id) ON DELETE SET NULL,
  completed       INTEGER NOT NULL DEFAULT 0,
  assigned_to     TEXT REFERENCES users(id) ON DELETE SET NULL,
  metadata        TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_timeline_event ON timeline_events(event_id, starts_at);

-- Manager timeline operations records for cross-device visibility, auditability,
-- reporting, and event-day export/offline continuity.

CREATE TABLE IF NOT EXISTS timeline_change_logs (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id         TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  timeline_item_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
  change_type      TEXT NOT NULL,
  summary          TEXT NOT NULL,
  payload          TEXT NOT NULL DEFAULT '{}',
  created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_timeline_change_logs_event ON timeline_change_logs(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_change_logs_item ON timeline_change_logs(timeline_item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS timeline_approvals (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('manager','owner','planner')),
  status          TEXT NOT NULL CHECK (status IN ('not_started','requested','approved','changes_requested')),
  note            TEXT,
  requested_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  approved_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, role)
);
CREATE INDEX IF NOT EXISTS idx_timeline_approvals_event ON timeline_approvals(event_id, role);

CREATE TABLE IF NOT EXISTS timeline_incidents (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id         TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  timeline_item_id TEXT REFERENCES timeline_events(id) ON DELETE SET NULL,
  severity         TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','delay','incident','critical')),
  note             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','monitoring','resolved')),
  created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_timeline_incidents_event ON timeline_incidents(event_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_incidents_item ON timeline_incidents(timeline_item_id, created_at DESC);

CREATE TABLE IF NOT EXISTS timeline_reminders (
  id               TEXT PRIMARY KEY,
  organization_id  TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id         TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  timeline_item_id TEXT REFERENCES timeline_events(id) ON DELETE CASCADE,
  remind_at        TEXT NOT NULL,
  channel          TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app','sms','email')),
  audience         TEXT NOT NULL DEFAULT 'venue_staff' CHECK (audience IN ('venue_staff','vendors','couple','planner')),
  status           TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','cancelled')),
  payload          TEXT NOT NULL DEFAULT '{}',
  created_by       TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_timeline_reminders_event ON timeline_reminders(event_id, remind_at);
CREATE INDEX IF NOT EXISTS idx_timeline_reminders_item ON timeline_reminders(timeline_item_id, remind_at);

CREATE TABLE IF NOT EXISTS event_offline_packets (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  audience        TEXT NOT NULL CHECK (audience IN ('venue_staff','vendors','couple','planner')),
  payload         TEXT NOT NULL DEFAULT '{}',
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, audience)
);
CREATE INDEX IF NOT EXISTS idx_event_offline_packets_event ON event_offline_packets(event_id, audience);


-- ============================================================
-- STAFF OPERATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS staff_tasks (
  id                TEXT PRIMARY KEY,
  organization_id   TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id          TEXT REFERENCES events(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT,
  phase             TEXT NOT NULL DEFAULT 'pre-event'
                    CHECK (phase IN ('pre-event','during-event','post-event')),
  status            TEXT NOT NULL DEFAULT 'not-started'
                    CHECK (status IN ('not-started','in-progress','completed','blocked')),
  priority          TEXT NOT NULL DEFAULT 'medium'
                    CHECK (priority IN ('low','medium','high','critical')),
  due_at            TEXT,
  estimated_minutes INTEGER,
  completed_at      TEXT,
  completed_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  assignee_name     TEXT,
  assignee_phone    TEXT,
  assignee_email    TEXT,
  assigned_staff    TEXT NOT NULL DEFAULT '[]',
  assigned_areas    TEXT NOT NULL DEFAULT '[]',
  tags              TEXT NOT NULL DEFAULT '[]',
  checklist         TEXT NOT NULL DEFAULT '[]',
  notes             TEXT,
  created_by        TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_event ON staff_tasks(event_id, status);

CREATE TABLE IF NOT EXISTS staff_areas (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  venue_id        TEXT REFERENCES venues(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  color           TEXT NOT NULL DEFAULT '#cccccc',
  icon            TEXT,
  assigned_staff  TEXT NOT NULL DEFAULT '[]',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff_shifts (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT REFERENCES events(id) ON DELETE CASCADE,
  staff_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area_id         TEXT REFERENCES staff_areas(id) ON DELETE SET NULL,
  role            TEXT NOT NULL DEFAULT 'other'
                  CHECK (role IN ('coordinator','setup','cleaning','parking','other')),
  starts_at       TEXT NOT NULL,
  ends_at         TEXT NOT NULL,
  notes           TEXT,
  clocked_in_at   TEXT,
  clocked_out_at  TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- EVENT QUESTIONS / ANSWERS
-- ============================================================

CREATE TABLE IF NOT EXISTS event_questions (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  group_name      TEXT NOT NULL DEFAULT 'Other',
  answer_type     TEXT NOT NULL DEFAULT 'text'
                  CHECK (answer_type IN ('dropdown','integer','text')),
  options         TEXT NOT NULL DEFAULT '[]',
  workflow        TEXT NOT NULL DEFAULT '{}',
  required        INTEGER NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS event_answers (
  id          TEXT PRIMARY KEY,
  event_id    TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES event_questions(id) ON DELETE CASCADE,
  answer      TEXT,
  answered_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  answered_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, question_id)
);

-- ============================================================
-- DIRECT MESSAGES (admin <-> couple thread)
-- ============================================================

CREATE TABLE IF NOT EXISTS direct_messages (
  id          TEXT PRIMARY KEY,
  thread_id   TEXT NOT NULL,
  sender_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  body        TEXT NOT NULL,
  read_by     TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_direct_messages_thread ON direct_messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS admin_change_requests (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  area            TEXT NOT NULL DEFAULT 'configuration',
  reason          TEXT,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','rejected','resolved')),
  response_note   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_admin_change_requests_org ON admin_change_requests(organization_id, status, created_at DESC);


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


-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id              TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  actor_user_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_label     TEXT,
  action          TEXT NOT NULL,
  target_type     TEXT,
  target_id       TEXT,
  ip              TEXT,
  user_agent      TEXT,
  details         TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_org     ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ============================================================
-- SCHEMA VERSION
-- ============================================================

CREATE TABLE IF NOT EXISTS schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO schema_version (version) VALUES (2);

-- ============================================================
-- Couple advanced planning normalized sections
-- ============================================================
CREATE TABLE IF NOT EXISTS couple_ceremony_plans (
  event_id        TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payload         TEXT NOT NULL DEFAULT '{}',
  updated_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS couple_wedding_party_plans (
  event_id        TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payload         TEXT NOT NULL DEFAULT '{}',
  updated_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS couple_vip_notes_plans (
  event_id        TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payload         TEXT NOT NULL DEFAULT '{}',
  privacy_scope   TEXT NOT NULL DEFAULT 'venue_planner_only' CHECK (privacy_scope IN ('venue_planner_only','couple_venue','couple_private')),
  updated_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS couple_transportation_plans (
  event_id        TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payload         TEXT NOT NULL DEFAULT '{}',
  updated_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS couple_memory_book_plans (
  event_id        TEXT PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  payload         TEXT NOT NULL DEFAULT '{}',
  updated_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_couple_ceremony_plans_org ON couple_ceremony_plans(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_couple_wedding_party_plans_org ON couple_wedding_party_plans(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_couple_vip_notes_plans_org ON couple_vip_notes_plans(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_couple_transportation_plans_org ON couple_transportation_plans(organization_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_couple_memory_book_plans_org ON couple_memory_book_plans(organization_id, updated_at DESC);

-- ============================================================
-- Guest portal help requests
-- ============================================================
CREATE TABLE IF NOT EXISTS guest_help_requests (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id        TEXT REFERENCES guests(id) ON DELETE SET NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('cannot_find_name','wrong_guest','expired_or_revoked','other')),
  name            TEXT,
  email           TEXT,
  message         TEXT,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','resolved','closed')),
  assigned_to     TEXT,
  resolution_note TEXT,
  sla_due_at      TEXT,
  last_reply_at   TEXT,
  last_reply_channel TEXT CHECK (last_reply_channel IN ('email','sms','in_app')),
  last_reply_job_id TEXT,
  last_reply_status TEXT,
  created_ip      TEXT,
  user_agent      TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_guest_help_requests_event ON guest_help_requests(event_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_help_requests_org ON guest_help_requests(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_help_requests_sla ON guest_help_requests(event_id, sla_due_at, status);

-- Migration 0033 additive columns for guest_help_requests
-- Kept as ALTER-compatible documentation; new installs include them here.

-- ============================================================
-- Guest-visible help request replies
-- ============================================================
CREATE TABLE IF NOT EXISTS guest_help_request_replies (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  request_id      TEXT NOT NULL REFERENCES guest_help_requests(id) ON DELETE CASCADE,
  guest_id        TEXT REFERENCES guests(id) ON DELETE SET NULL,
  channel         TEXT NOT NULL CHECK (channel IN ('email','sms','in_app')),
  body            TEXT NOT NULL,
  dispatch_status TEXT,
  job_id          TEXT,
  sent_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
  sent_by_label   TEXT,
  visible_to_guest INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_guest_help_replies_guest ON guest_help_request_replies(event_id, guest_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guest_help_replies_request ON guest_help_request_replies(request_id, created_at DESC);

-- Final Review change requests: couples, planners, and venue managers may request;
-- the venue manager records the final decision.
CREATE TABLE IF NOT EXISTS final_review_change_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  requested_role TEXT NOT NULL CHECK (requested_role IN ('couple','planner','manager')),
  detail TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','accepted','declined','resolved')),
  manager_note TEXT,
  decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_final_review_change_event ON final_review_change_requests(event_id, status, created_at);
