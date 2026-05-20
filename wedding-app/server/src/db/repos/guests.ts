import { db } from '../database.js';
import { uuid, hashToken, generateOpaqueToken } from '../../lib/crypto.js';
import { parseJson, stringifyJson } from '../../lib/json.js';

export interface GuestRow {
  id: string;
  organization_id: string;
  event_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  party_name: string | null;
  rsvp_status: 'pending' | 'attending' | 'declined' | 'maybe';
  dietary_restrictions: string | null;
  accessibility_notes: string | null;
  table_assignment: string | null;
  room_assignment: string | null;
  seat_assignment: string | null;
  plus_one_allowed: number;
  portal_token_hash: string | null;
  portal_token_salt: string | null;
  allow_portal_access: number;
  allow_lodging_access: number;
  metadata: string;
  deleted_at: string | null;
  created_at: string;
}

export interface GuestInput {
  fullName: string;
  email?: string;
  phone?: string;
  partyName?: string;
  rsvpStatus?: GuestRow['rsvp_status'];
  dietaryRestrictions?: string;
  accessibilityNotes?: string;
  tableAssignment?: string;
  roomAssignment?: string;
  seatAssignment?: string;
  plusOneAllowed?: boolean;
  allowPortalAccess?: boolean;
  allowLodgingAccess?: boolean;
  metadata?: Record<string, unknown>;
}

export const guestsRepo = {
  findById(id: string): GuestRow | undefined {
    return db.prepare(
      `SELECT * FROM guests WHERE id = ? AND deleted_at IS NULL`
    ).get(id) as GuestRow | undefined;
  },

  listForEvent(eventId: string): GuestRow[] {
    return db.prepare(
      `SELECT * FROM guests WHERE event_id = ? AND deleted_at IS NULL ORDER BY full_name`
    ).all(eventId) as GuestRow[];
  },

  create(orgId: string, eventId: string, input: GuestInput): GuestRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO guests
         (id, organization_id, event_id, full_name, email, phone, party_name,
          rsvp_status, dietary_restrictions, accessibility_notes,
          table_assignment, room_assignment, seat_assignment,
          plus_one_allowed, allow_portal_access, allow_lodging_access, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, orgId, eventId,
      input.fullName,
      input.email ?? null,
      input.phone ?? null,
      input.partyName ?? null,
      input.rsvpStatus ?? 'pending',
      input.dietaryRestrictions ?? null,
      input.accessibilityNotes ?? null,
      input.tableAssignment ?? null,
      input.roomAssignment ?? null,
      input.seatAssignment ?? null,
      input.plusOneAllowed ? 1 : 0,
      input.allowPortalAccess === false ? 0 : 1,
      input.allowLodgingAccess ? 1 : 0,
      stringifyJson(input.metadata ?? {}),
    );
    return this.findById(id)!;
  },

  update(id: string, patch: Partial<GuestInput>): GuestRow | undefined {
    const map: Record<keyof GuestInput, { col: string; bool?: boolean; json?: boolean }> = {
      fullName:             { col: 'full_name' },
      email:                { col: 'email' },
      phone:                { col: 'phone' },
      partyName:            { col: 'party_name' },
      rsvpStatus:           { col: 'rsvp_status' },
      dietaryRestrictions:  { col: 'dietary_restrictions' },
      accessibilityNotes:   { col: 'accessibility_notes' },
      tableAssignment:      { col: 'table_assignment' },
      roomAssignment:       { col: 'room_assignment' },
      seatAssignment:       { col: 'seat_assignment' },
      plusOneAllowed:       { col: 'plus_one_allowed', bool: true },
      allowPortalAccess:    { col: 'allow_portal_access', bool: true },
      allowLodgingAccess:   { col: 'allow_lodging_access', bool: true },
      metadata:             { col: 'metadata', json: true },
    };
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      const spec = map[k as keyof GuestInput];
      if (!spec) continue;
      fields.push(`${spec.col} = ?`);
      if (spec.bool) values.push(v ? 1 : 0);
      else if (spec.json) values.push(stringifyJson(v));
      else values.push(v ?? null);
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    db.prepare(
      `UPDATE guests SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).run(...values);
    return this.findById(id);
  },

  softDelete(id: string): boolean {
    const res = db.prepare(
      `UPDATE guests SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`
    ).run(id);
    return res.changes > 0;
  },

  /** Issue a new portal token for the guest. Returns the plaintext (only chance!). */
  rotatePortalToken(id: string): string {
    const plaintext = generateOpaqueToken();
    const rec = hashToken(plaintext);
    db.prepare(
      `UPDATE guests SET portal_token_hash = ?, portal_token_salt = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(rec.hash, rec.salt, id);
    return plaintext;
  },

  revokePortalToken(id: string): void {
    db.prepare(
      `UPDATE guests SET portal_token_hash = NULL, portal_token_salt = NULL, allow_portal_access = 0, updated_at = datetime('now') WHERE id = ?`
    ).run(id);
  },

  countByStatus(eventId: string): Record<string, number> {
    const rows = db.prepare(
      `SELECT rsvp_status, COUNT(*) AS n FROM guests
       WHERE event_id = ? AND deleted_at IS NULL
       GROUP BY rsvp_status`
    ).all(eventId) as Array<{ rsvp_status: string; n: number }>;
    const out: Record<string, number> = { pending: 0, attending: 0, declined: 0, maybe: 0 };
    for (const r of rows) out[r.rsvp_status] = r.n;
    return out;
  },
};

// ─── RSVPs ──────────────────────────────────────────────────
export const rsvpRepo = {
  submit(input: {
    organizationId: string;
    eventId: string;
    guestId?: string;
    attending: boolean;
    attendingDays?: string[];
    mealChoice?: string;
    plusOneName?: string;
    plusOneMealChoice?: string;
    dietaryNotes?: string;
    specialNeeds?: string;
    notes?: string;
    ip?: string;
    userAgent?: string;
  }): string {
    const id = uuid();
    db.prepare(
      `INSERT INTO rsvp_submissions
         (id, organization_id, event_id, guest_id, attending, attending_days,
          meal_choice, plus_one_name, plus_one_meal_choice,
          dietary_notes, special_needs, notes, submitted_ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, input.organizationId, input.eventId,
      input.guestId ?? null,
      input.attending ? 1 : 0,
      stringifyJson(input.attendingDays ?? []),
      input.mealChoice ?? null,
      input.plusOneName ?? null,
      input.plusOneMealChoice ?? null,
      input.dietaryNotes ?? null,
      input.specialNeeds ?? null,
      input.notes ?? null,
      input.ip ?? null,
      input.userAgent ?? null,
    );
    if (input.guestId) {
      db.prepare(
        `UPDATE guests SET rsvp_status = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(input.attending ? 'attending' : 'declined', input.guestId);
    }
    return id;
  },

  listForEvent(eventId: string) {
    return db.prepare(
      `SELECT r.*, g.full_name AS guest_name
       FROM rsvp_submissions r
       LEFT JOIN guests g ON g.id = r.guest_id
       WHERE r.event_id = ?
       ORDER BY r.submitted_at DESC`
    ).all(eventId);
  },

  findById(id: string) {
    return db.prepare(`SELECT * FROM rsvp_submissions WHERE id = ?`).get(id);
  },
};

// ─── Guest portal config ───────────────────────────────────
export const portalConfigRepo = {
  getForEvent(eventId: string) {
    return db.prepare(`SELECT * FROM guest_portal_configs WHERE event_id = ?`).get(eventId);
  },

  upsert(input: {
    organizationId: string;
    eventId: string;
    enabled: boolean;
    passwordHash?: string | null;
    passwordSalt?: string | null;
    accessStartsAt?: string;
    accessEndsAt?: string;
    gracePeriodHours?: number;
    config?: Record<string, unknown>;
    updatedBy: string;
  }) {
    const existing = this.getForEvent(input.eventId) as { id: string } | undefined;
    if (existing) {
      db.prepare(
        `UPDATE guest_portal_configs
           SET enabled = ?, password_hash = ?, password_salt = ?,
               access_starts_at = ?, access_ends_at = ?, grace_period_hours = ?,
               config = ?, updated_by = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        input.enabled ? 1 : 0,
        input.passwordHash ?? null,
        input.passwordSalt ?? null,
        input.accessStartsAt ?? null,
        input.accessEndsAt ?? null,
        input.gracePeriodHours ?? 36,
        stringifyJson(input.config ?? {}),
        input.updatedBy,
        existing.id,
      );
    } else {
      db.prepare(
        `INSERT INTO guest_portal_configs
           (id, organization_id, event_id, enabled, password_hash, password_salt,
            access_starts_at, access_ends_at, grace_period_hours, config,
            created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        uuid(), input.organizationId, input.eventId,
        input.enabled ? 1 : 0,
        input.passwordHash ?? null,
        input.passwordSalt ?? null,
        input.accessStartsAt ?? null,
        input.accessEndsAt ?? null,
        input.gracePeriodHours ?? 36,
        stringifyJson(input.config ?? {}),
        input.updatedBy, input.updatedBy,
      );
    }
    return this.getForEvent(input.eventId);
  },
};
