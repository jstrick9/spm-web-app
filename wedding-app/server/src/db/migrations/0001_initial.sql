-- ============================================================
-- Wedding Venue App - SQLite schema v3
-- ============================================================
-- v3 adds dynamic, org-scoped custom roles + the 'vendor' system role.
-- See docs/PHASE-1-RBAC-UPGRADE.md for the rationale.
--
-- Conventions:
--   * All ids are UUID strings (generated in Node, not SQLite)
--   * All timestamps are TEXT ISO-8601
--   * All booleans are INTEGER 0/1
--   * JSON fields are TEXT; the repo layer json-parses on read
--   * Soft delete via deleted_at on events/guests/vendors/venues
--   * Every domain row has organization_id for tenant isolation
--   * RBAC: memberships.role_id references roles.id. System roles have
--     predictable string ids ('sys_owner', 'sys_admin', ...) seeded
--     once at app startup. Custom roles have UUID ids and an org owner.
-- ============================================================

-- Connection-level PRAGMAs live in src/db/database.ts (applied per connection;
-- they can't run inside a transaction anyway).

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

-- ============================================================
-- ROLES + PERMISSIONS (the upgrade)
-- ============================================================
--
-- Why store roles in the DB instead of code?
--   * Owners/admins need to create custom roles ("Senior Coordinator",
--     "Catering Lead") at runtime, without a deploy.
--   * Custom roles are PER ORG. Org A's "Senior Coordinator" is a
--     different row than Org B's "Senior Coordinator".
--   * System roles (sys_owner, sys_admin, sys_planner, sys_couple,
--     sys_staff, sys_vendor, sys_guest) have NULL organization_id and
--     are IMMUTABLE (CHECK constraint + repo-level guard).
--   * The set of POSSIBLE permission ids stays in code (lib/permissions.ts);
--     this table just records which roles grant which.

CREATE TABLE IF NOT EXISTS roles (
  id              TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  -- key is a stable identifier within the org (or globally for system roles)
  key             TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  is_system       INTEGER NOT NULL DEFAULT 0,
  -- For system roles: a role 'kind' string used as a hint for UIs and
  -- as the membership 'role' label clients see. NULL for custom roles.
  system_kind     TEXT,
  -- Hierarchy: higher = more powerful. Used for "who can grant what" checks.
  hierarchy       INTEGER NOT NULL DEFAULT 50,
  created_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  -- Custom role keys must be unique within an org. System roles (NULL org)
  -- get a unique key globally.
  UNIQUE (organization_id, key)
);
CREATE INDEX IF NOT EXISTS idx_roles_org ON roles(organization_id);

-- Permission grants for each role. We do NOT enforce that permission_id
-- exists in any catalog table because the catalog lives in code (the
-- registry in lib/permissions.ts is the source of truth); enforcing in
-- the DB would require a migration every time we add a permission.
-- Instead we validate at write time in the route layer.
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL,
  granted_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- MEMBERSHIPS - now reference roles.id (one role per scope)
-- ============================================================

CREATE TABLE IF NOT EXISTS organization_memberships (
  id              TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id         TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('invited','active','suspended','disabled')),
  invited_by      TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org  ON organization_memberships(organization_id);

CREATE TABLE IF NOT EXISTS event_memberships (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  status     TEXT NOT NULL DEFAULT 'active'
             CHECK (status IN ('invited','active','suspended','disabled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_event_memberships_user  ON event_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_event_memberships_event ON event_memberships(event_id);

-- ============================================================
-- EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  id                       TEXT PRIMARY KEY,
  organization_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title                    TEXT NOT NULL,
  slug                     TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'planning'
                           CHECK (status IN ('lead','hold','booked','planning','completed','cancelled','lost')),
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
-- LAYOUTS
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
-- VENDORS (business records - separate from vendor USERS)
-- ============================================================
-- NOTE: a 'vendor record' here is the venue's contact list of vendors
-- (DJ Smith, Acme Florals). A 'vendor USER' is an actual user account
-- with the sys_vendor role assigned. A vendor record may optionally
-- link to a user account via owner_user_id.

CREATE TABLE IF NOT EXISTS vendors (
  id                    TEXT PRIMARY KEY,
  organization_id       TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id              TEXT REFERENCES events(id) ON DELETE CASCADE,
  -- The user account associated with this vendor record (NULL until the
  -- venue invites them to log in). When set, that user has the sys_vendor
  -- role and can see this vendor's bookings via the vendor portal.
  owner_user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
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
CREATE INDEX IF NOT EXISTS idx_vendors_owner ON vendors(owner_user_id);

CREATE TABLE IF NOT EXISTS vendor_payments (
  id           TEXT PRIMARY KEY,
  vendor_id    TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_at      TEXT NOT NULL,
  method       TEXT,
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

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
-- DIRECT MESSAGES
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

INSERT OR IGNORE INTO schema_version (version) VALUES (1);
