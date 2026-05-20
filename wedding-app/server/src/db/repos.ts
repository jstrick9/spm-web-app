/**
 * Thin repository functions wrapping prepared statements.
 *
 * Why one file? At POC scale, 6 repos × 4 functions = 24 functions. Keeping
 * them together makes the SQL surface easy to audit. When this grows past
 * ~100 functions, split into per-domain files.
 */
import { db } from './database.js';
import { uuid } from '../lib/crypto.js';

// ─── USERS ───────────────────────────────────────────────────
export interface UserRow {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  password_salt: string;
  session_version: number;
  status: string;
}

export const usersRepo = {
  findByEmail(email: string): UserRow | undefined {
    return db
      .prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE`)
      .get(email) as UserRow | undefined;
  },

  findById(id: string): UserRow | undefined {
    return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as
      | UserRow
      | undefined;
  },

  create(input: {
    email: string;
    fullName: string;
    passwordHash: string;
    passwordSalt: string;
  }): UserRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO users (id, email, full_name, password_hash, password_salt)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, input.email, input.fullName, input.passwordHash, input.passwordSalt);
    return this.findById(id)!;
  },
};

// ─── ORGANIZATIONS ───────────────────────────────────────────
export const orgsRepo = {
  createWithOwner(input: { name: string; slug: string; ownerId: string }): string {
    const id = uuid();
    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO organizations (id, name, slug, owner_id) VALUES (?, ?, ?, ?)`
      ).run(id, input.name, input.slug, input.ownerId);

      db.prepare(
        `INSERT INTO organization_memberships (id, organization_id, user_id, role)
         VALUES (?, ?, ?, 'owner')`
      ).run(uuid(), id, input.ownerId);
    });
    tx();
    return id;
  },

  listForUser(userId: string) {
    return db
      .prepare(
        `SELECT o.* FROM organizations o
         JOIN organization_memberships m
           ON m.organization_id = o.id
         WHERE m.user_id = ? AND m.status = 'active'
         ORDER BY o.created_at`
      )
      .all(userId);
  },
};

// ─── EVENTS ──────────────────────────────────────────────────
export interface EventRow {
  id: string;
  organization_id: string;
  title: string;
  slug: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  guest_count: number;
  created_at: string;
}

export const eventsRepo = {
  create(input: {
    organizationId: string;
    title: string;
    slug: string;
    startDate?: string;
    endDate?: string;
    createdBy: string;
  }): EventRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO events
       (id, organization_id, title, slug, start_date, end_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.organizationId,
      input.title,
      input.slug,
      input.startDate ?? null,
      input.endDate ?? null,
      input.createdBy,
    );
    return this.findById(id)!;
  },

  findById(id: string): EventRow | undefined {
    return db.prepare(`SELECT * FROM events WHERE id = ?`).get(id) as
      | EventRow
      | undefined;
  },

  listForOrg(orgId: string): EventRow[] {
    return db
      .prepare(`SELECT * FROM events WHERE organization_id = ? ORDER BY start_date`)
      .all(orgId) as EventRow[];
  },

  /** event_id → organization_id map for the user's visible events.
   *  Used by the RBAC resolver to bridge event-scoped checks. */
  orgMapForUser(userId: string): Record<string, string> {
    const rows = db
      .prepare(
        `SELECT e.id, e.organization_id
         FROM events e
         LEFT JOIN event_memberships em
           ON em.event_id = e.id AND em.user_id = ?
         LEFT JOIN organization_memberships om
           ON om.organization_id = e.organization_id AND om.user_id = ?
         WHERE em.id IS NOT NULL OR om.id IS NOT NULL`
      )
      .all(userId, userId) as Array<{ id: string; organization_id: string }>;
    const map: Record<string, string> = {};
    for (const r of rows) map[r.id] = r.organization_id;
    return map;
  },
};

// ─── GUESTS ──────────────────────────────────────────────────
export interface GuestRow {
  id: string;
  organization_id: string;
  event_id: string;
  full_name: string;
  email: string | null;
  rsvp_status: string;
  table_assignment: string | null;
  plus_one_allowed: number;
  allow_portal_access: number;
}

export const guestsRepo = {
  create(input: {
    organizationId: string;
    eventId: string;
    fullName: string;
    email?: string;
    plusOneAllowed?: boolean;
  }): GuestRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO guests
       (id, organization_id, event_id, full_name, email, plus_one_allowed)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.organizationId,
      input.eventId,
      input.fullName,
      input.email ?? null,
      input.plusOneAllowed ? 1 : 0,
    );
    return this.findById(id)!;
  },

  findById(id: string): GuestRow | undefined {
    return db.prepare(`SELECT * FROM guests WHERE id = ?`).get(id) as
      | GuestRow
      | undefined;
  },

  listForEvent(eventId: string): GuestRow[] {
    return db
      .prepare(`SELECT * FROM guests WHERE event_id = ? ORDER BY full_name`)
      .all(eventId) as GuestRow[];
  },

  updateRsvpStatus(id: string, status: string) {
    db.prepare(
      `UPDATE guests SET rsvp_status = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(status, id);
  },
};

// ─── RSVPs ───────────────────────────────────────────────────
export const rsvpRepo = {
  submit(input: {
    organizationId: string;
    eventId: string;
    guestId?: string;
    attending: boolean;
    mealChoice?: string;
    plusOneName?: string;
    notes?: string;
    ip?: string;
    userAgent?: string;
  }): string {
    const id = uuid();
    db.prepare(
      `INSERT INTO rsvp_submissions
       (id, organization_id, event_id, guest_id, attending,
        meal_choice, plus_one_name, notes, submitted_ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.organizationId,
      input.eventId,
      input.guestId ?? null,
      input.attending ? 1 : 0,
      input.mealChoice ?? null,
      input.plusOneName ?? null,
      input.notes ?? null,
      input.ip ?? null,
      input.userAgent ?? null,
    );
    if (input.guestId) {
      guestsRepo.updateRsvpStatus(
        input.guestId,
        input.attending ? 'attending' : 'declined',
      );
    }
    return id;
  },

  listForEvent(eventId: string) {
    return db
      .prepare(
        `SELECT r.*, g.full_name AS guest_name
         FROM rsvp_submissions r
         LEFT JOIN guests g ON g.id = r.guest_id
         WHERE r.event_id = ?
         ORDER BY r.submitted_at DESC`
      )
      .all(eventId);
  },
};

// ─── AUDIT LOG ───────────────────────────────────────────────
export const auditRepo = {
  log(input: {
    organizationId?: string;
    actorUserId?: string;
    actorLabel?: string;
    action: string;
    targetType?: string;
    targetId?: string;
    ip?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
  }) {
    db.prepare(
      `INSERT INTO audit_logs
       (id, organization_id, actor_user_id, actor_label, action,
        target_type, target_id, ip, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uuid(),
      input.organizationId ?? null,
      input.actorUserId ?? null,
      input.actorLabel ?? null,
      input.action,
      input.targetType ?? null,
      input.targetId ?? null,
      input.ip ?? null,
      input.userAgent ?? null,
      JSON.stringify(input.details ?? {}),
    );
  },
};
