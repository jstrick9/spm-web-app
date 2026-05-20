-- ============================================================
-- Wedding Venue App — SQLite schema (POC)
-- ============================================================
-- Translated from supabase/migrations/0001_initial.sql
-- Postgres-specific bits replaced as follows:
--   pgcrypto      → Node's built-in crypto module (hashing in app code)
--   gen_random_uuid()  → Node generates the uuid before INSERT
--   jsonb         → TEXT with json_extract() / json_set() at read/write time
--   ENUMs         → TEXT + CHECK constraint
--   RLS policies  → enforced in Fastify routes (application-layer authz)
--   timestamptz   → TEXT (ISO-8601 strings) — SQLite has no real timestamp type
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;          -- better concurrent-read performance
PRAGMA synchronous  = NORMAL;       -- fsync on COMMIT only (safe with WAL)
PRAGMA temp_store   = MEMORY;
PRAGMA cache_size   = -64000;       -- ~64 MB page cache

-- ─── USERS (auth) ────────────────────────────────────────────
-- One row per platform user (venue staff, couples, planners).
-- Passwords are PBKDF2-SHA256 hashed (matches existing client code in
-- src/utils/auth.ts of the original app so we can later reuse credentials).
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
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ─── ORGANIZATIONS ───────────────────────────────────────────
-- A venue (or venue group). Owns events, vendors, guests.
CREATE TABLE IF NOT EXISTS organizations (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  support_email TEXT,
  phone         TEXT,
  website_url   TEXT,
  owner_id      TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── ORG MEMBERSHIPS (who can do what in an org) ─────────────
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

-- ─── EVENTS ──────────────────────────────────────────────────
-- A single wedding / occasion within an organization.
CREATE TABLE IF NOT EXISTS events (
  id                       TEXT PRIMARY KEY,
  organization_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title                    TEXT NOT NULL,
  slug                     TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'planning'
                           CHECK (status IN ('lead','hold','booked','planning','completed','cancelled','lost')),
  start_date               TEXT,                       -- ISO date 'YYYY-MM-DD'
  end_date                 TEXT,
  guest_count              INTEGER NOT NULL DEFAULT 0 CHECK (guest_count >= 0),
  primary_contact_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  budget_cents             INTEGER CHECK (budget_cents IS NULL OR budget_cents >= 0),
  metadata                 TEXT NOT NULL DEFAULT '{}',  -- JSON
  created_by               TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at               TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at               TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_events_org ON events(organization_id);

-- ─── EVENT MEMBERSHIPS (bride/groom, day-of planner, etc.) ──
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

-- ─── GUESTS ──────────────────────────────────────────────────
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
  plus_one_allowed      INTEGER NOT NULL DEFAULT 0,    -- SQLite has no bool
  portal_token_hash     TEXT,
  portal_token_salt     TEXT,
  allow_portal_access   INTEGER NOT NULL DEFAULT 1,
  metadata              TEXT NOT NULL DEFAULT '{}',
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guests_event ON guests(event_id);
CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email);

-- ─── RSVP SUBMISSIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rsvp_submissions (
  id                   TEXT PRIMARY KEY,
  organization_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id             TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  guest_id             TEXT REFERENCES guests(id) ON DELETE SET NULL,
  attending            INTEGER NOT NULL,               -- 1 or 0
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

-- ─── AUDIT LOG (security/compliance) ─────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id              TEXT PRIMARY KEY,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  actor_user_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_label     TEXT,                                -- denormalized for forensics after user delete
  action          TEXT NOT NULL,                       -- 'user.login', 'guest.create', 'rsvp.submit', ...
  target_type     TEXT,
  target_id       TEXT,
  ip              TEXT,
  user_agent      TEXT,
  details         TEXT NOT NULL DEFAULT '{}',          -- JSON
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_org     ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ─── SCHEMA VERSION (for future migrations) ──────────────────
CREATE TABLE IF NOT EXISTS schema_version (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO schema_version (version) VALUES (1);
