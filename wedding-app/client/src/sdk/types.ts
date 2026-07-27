/**
 * Shared types between SDK callers and the server. These mirror the
 * shape returned by the Phase 1 API exactly.
 *
 * Why duplicated (not imported from server)?
 *   - Keeps the client buildable without a project reference to the server
 *   - Lets the client evolve types ahead of the server (e.g. add UI-only
 *     fields like `_isOptimistic`)
 *   - Avoids accidentally exporting Node-only types into the browser bundle
 */

// ─── Auth / identity ────────────────────────────────
export interface SdkUser {
  id: string;
  email: string;
  fullName?: string;
}

export type AppRoleKey =
  | 'owner' | 'admin' | 'manager' | 'planner' | 'couple' | 'staff' | 'vendor' | 'guest';

export interface SdkMembership {
  organizationId?: string;
  eventId?: string;
  eventOrganizationId?: string;
  roleId: string;     // 'sys_owner' or uuid
  roleKey: string;    // 'owner' / 'admin' / 'catering-lead' / ...
  roleName: string;   // display name
}

// ─── Orgs ───────────────────────────────────────────
export interface SdkOrg {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  branding: string;   // JSON; SDK consumers can json-parse if needed
  settings: string;   // JSON
  created_at: string;
}

// ─── Roles ──────────────────────────────────────────
export type PermissionId = string;   // typed loosely on the client; the server validates

export interface SdkRole {
  id: string;
  organization_id: string | null;
  key: string;
  name: string;
  description: string | null;
  is_system: 0 | 1;
  system_kind: string | null;
  hierarchy: number;
  permissions: PermissionId[];
  created_at: string;
  updated_at: string;
}

export interface SdkPermissionDef {
  id: string;
  label: string;
  description: string;
  category: string;
}

// ─── Events ─────────────────────────────────────────
export type SdkEventStatus =
  | 'lead' | 'hold' | 'booked' | 'planning' | 'completed' | 'cancelled' | 'lost';

export interface SdkEvent {
  id: string;
  organization_id: string;
  title: string;
  slug: string;
  status: SdkEventStatus;
  start_date: string | null;
  end_date: string | null;
  guest_count: number;
  primary_contact_user_id: string | null;
  budget_cents: number | null;
  metadata: string;       // JSON
  created_at: string;
}

// ─── Guests ─────────────────────────────────────────
export type SdkRsvpStatus = 'pending' | 'attending' | 'declined' | 'maybe';

export interface SdkGuest {
  id: string;
  organization_id: string;
  event_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  party_name: string | null;
  rsvp_status: SdkRsvpStatus;
  dietary_restrictions: string | null;
  accessibility_notes: string | null;
  table_assignment: string | null;
  room_assignment: string | null;
  seat_assignment: string | null;
  plus_one_allowed: 0 | 1;
  allow_portal_access: 0 | 1;
  allow_lodging_access: 0 | 1;
  metadata: string;
  created_at: string;
}

export interface SdkGuestCounts {
  pending: number;
  attending: number;
  declined: number;
  maybe: number;
}

// ─── RSVPs / Portal ─────────────────────────────────
export interface SdkRsvp {
  id: string;
  event_id: string;
  guest_id: string | null;
  guest_name?: string;
  attending: 0 | 1;
  attending_days: string;   // JSON array
  meal_choice: string | null;
  plus_one_name: string | null;
  plus_one_meal_choice: string | null;
  dietary_notes: string | null;
  special_needs: string | null;
  notes: string | null;
  submitted_at: string;
  submitted_ip: string | null;
}

export interface SdkPortalInfo {
  event: {
    id: string;
    title: string;
    startDate: string | null;
    endDate: string | null;
  };
  portalEnabled: boolean;
  requiresPassword: boolean;
  guests: Array<{ id: string; fullName: string; tableAssignment?: string | null; seatAssignment?: string | null }>;
  layout?: Record<string, any> | null;
}

// ─── Venues / Catalog / Layouts / Vendors / Timeline / Staff ───
// (Kept minimal here; routes return raw rows. Each domain SDK module
// can re-export more specific types as needed.)

export interface SdkVenue {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  environment: 'indoor' | 'outdoor' | 'both';
  description: string | null;
  capacity: number;
  width: number;
  height: number;
  canvas_width?: number | null;
  canvas_height?: number | null;
  master_layout?: string;
  underlay?: string;
  unit_system?: 'imperial' | 'metric';
  template_key?: string;
  approval_status?: 'draft' | 'approved' | 'archived';
  revision?: number;
  created_at: string;
}

export interface SdkCatalogItem {
  id: string;
  organizationId: string;
  kind: 'table' | 'fixture' | 'chair' | 'wall_style' | 'linen' | 'guideline' | 'spacing' | 'template';
  name: string;
  spec: Record<string, unknown>;
  visible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SdkLayout {
  id: string;
  organization_id: string;
  event_id: string | null;
  venue_id: string | null;
  name: string;
  visibility: 'private' | 'event' | 'venue' | 'public';
  approval_status?: 'draft' | 'pending' | 'approved' | 'rejected';
  revision: number;
  payload: string;       // JSON
  is_template: 0 | 1;
  created_at: string;
  updated_at: string;
}

export interface SdkVendor {
  id: string;
  organization_id: string;
  event_id: string | null;
  owner_user_id: string | null;
  name: string;
  category: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website_url: string | null;
  contract_amount_cents: number | null;
  amount_paid_cents: number;
  is_preferred: 0 | 1;
  notes: string | null;
  metadata: string;
  created_at: string;
}

export interface SdkTimelineItem {
  id: string;
  event_id: string;
  title: string;
  category: string;
  starts_at: string;
  ends_at: string | null;
  duration_min: number | null;
  location: string | null;
  notes: string | null;
  vendor_id: string | null;
  metadata?: string;
  completed: 0 | 1;
  assigned_to: string | null;
  created_at: string;
}

// ─── Generic envelopes ──────────────────────────────
export interface SdkAuthResponse {
  token: string;
  user: SdkUser;
  organizationId?: string;
  eventId?: string | null;
  redirectTo?: string;
}

export interface ApiErrorBody {
  error: string;
  message?: string;
  details?: unknown;
}


export interface SdkStaffTask {
  id: string;
  organization_id: string;
  event_id: string | null;
  title: string;
  description: string | null;
  phase: 'pre-event' | 'during-event' | 'post-event';
  status: 'not-started' | 'in-progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_at: string | null;
  estimated_minutes: number | null;
  completed_at: string | null;
  completed_by: string | null;
  assignee_name?: string | null;
  assignee_phone?: string | null;
  assignee_email?: string | null;
  assigned_staff: string[];
  assigned_areas: string[];
  tags: string[];
  checklist: { id: string; label: string; completed: boolean }[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SdkStaffArea {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  venue_id: string | null;
  assigned_staff: string[];
  created_at: string;
  updated_at: string;
}

export interface SdkStaffShift {
  id: string;
  organization_id: string;
  staff_id: string;
  area_id: string | null;
  event_id: string | null;
  role: 'coordinator' | 'setup' | 'cleaning' | 'parking' | 'other';
  starts_at: string;
  ends_at: string;
  notes: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  radio_channel?: string | null;
  handoff_notes?: string | null;
  clocked_in_at?: string | null;
  clocked_out_at?: string | null;
  created_at: string;
  updated_at: string;
}


export interface SdkPortalConfig {
  id: string;
  organization_id: string;
  event_id: string;
  enabled: number;
  password_hash: string | null;
  password_salt: string | null;
  access_starts_at: string | null;
  access_ends_at: string | null;
  grace_period_hours: number;
  config: string;
}


export interface SdkEventQuestion {
  id: string;
  organization_id: string;
  question: string;
  group_name: string;
  answer_type: 'dropdown' | 'integer' | 'text' | 'date' | 'boolean' | 'multiselect';
  options: string; // JSON array
  workflow: string; // JSON object
  required: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SdkEventAnswer {
  id: string;
  event_id: string;
  question_id: string;
  answer: string | null;
  answered_by: string | null;
  answered_at: string;
}
