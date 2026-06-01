import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { parseJson, stringifyJson } from '../../lib/json.js';
import { slugifyUnique } from '../../lib/slug.js';

export type EventStatus = 'lead' | 'hold' | 'booked' | 'planning' | 'completed' | 'cancelled' | 'lost';

export interface EventRow {
  id: string;
  organization_id: string;
  title: string;
  slug: string;
  status: EventStatus;
  start_date: string | null;
  end_date: string | null;
  guest_count: number;
  primary_contact_user_id: string | null;
  budget_cents: number | null;
  metadata: string;
  deleted_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface SubEventRow {
  id: string;
  event_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  venue_id: string | null;
  invite_only: number;
  metadata: string;
  created_at: string;
}

export const eventsRepo = {
  findById(id: string): EventRow | undefined {
    return db.prepare(`SELECT * FROM events WHERE id = ? AND deleted_at IS NULL`).get(id) as EventRow | undefined;
  },

  create(input: {
    organizationId: string;
    title: string;
    status?: EventStatus;
    startDate?: string;
    endDate?: string;
    guestCount?: number;
    budgetCents?: number;
    primaryContactUserId?: string;
    metadata?: Record<string, unknown>;
    createdBy: string;
  }): EventRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO events
         (id, organization_id, title, slug, status, start_date, end_date,
          guest_count, primary_contact_user_id, budget_cents, metadata, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.organizationId,
      input.title,
      slugifyUnique(input.title),
      input.status ?? 'planning',
      input.startDate ?? null,
      input.endDate ?? null,
      input.guestCount ?? 0,
      input.primaryContactUserId ?? null,
      input.budgetCents ?? null,
      stringifyJson(input.metadata ?? {}),
      input.createdBy,
    );
    return this.findById(id)!;
  },

  update(id: string, patch: Partial<Omit<EventRow, 'id' | 'organization_id' | 'created_at' | 'created_by' | 'metadata'>> & { metadata?: Record<string, unknown> }): EventRow | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const key of ['title','status','start_date','end_date','guest_count','primary_contact_user_id','budget_cents'] as const) {
      if (key in patch) {
        fields.push(`${key} = ?`);
        values.push((patch as Record<string, unknown>)[key]);
      }
    }
    if (patch.metadata) {
      fields.push('metadata = ?');
      values.push(stringifyJson(patch.metadata));
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    db.prepare(
      `UPDATE events SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).run(...values);
    return this.findById(id);
  },

  softDelete(id: string): boolean {
    const res = db.prepare(
      `UPDATE events SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`
    ).run(id);
    return res.changes > 0;
  },

  listForOrg(orgId: string, opts: {
    status?: EventStatus | EventStatus[];
    search?: string;
    /** Filter by date range (inclusive). Either bound optional. */
    startsAfter?: string;
    startsBefore?: string;
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
  } = {}): EventRow[] {
    let sql = `SELECT * FROM events WHERE organization_id = ?`;
    const params: unknown[] = [orgId];
    if (!opts.includeDeleted) sql += ` AND deleted_at IS NULL`;
    if (opts.status) {
      const arr = Array.isArray(opts.status) ? opts.status : [opts.status];
      sql += ` AND status IN (${arr.map(() => '?').join(',')})`;
      params.push(...arr);
    }
    if (opts.search) {
      sql += ` AND (title LIKE ? COLLATE NOCASE OR slug LIKE ? COLLATE NOCASE)`;
      const like = `%${opts.search}%`;
      params.push(like, like);
    }
    if (opts.startsAfter)  { sql += ` AND (start_date IS NULL OR start_date >= ?)`; params.push(opts.startsAfter); }
    if (opts.startsBefore) { sql += ` AND (start_date IS NULL OR start_date <= ?)`; params.push(opts.startsBefore); }
    sql += ` ORDER BY start_date IS NULL, start_date, created_at DESC`;
    if (opts.limit)  { sql += ` LIMIT ?`;  params.push(opts.limit); }
    if (opts.offset) { sql += ` OFFSET ?`; params.push(opts.offset); }
    return db.prepare(sql).all(...params) as EventRow[];
  },

  /** Count events grouped by status, for the kanban-style status board. */
  countByStatus(orgId: string): Record<EventStatus, number> {
    const rows = db.prepare(
      `SELECT status, COUNT(*) AS n FROM events
       WHERE organization_id = ? AND deleted_at IS NULL
       GROUP BY status`
    ).all(orgId) as Array<{ status: EventStatus; n: number }>;
    const out: Record<EventStatus, number> = {
      lead: 0, hold: 0, booked: 0, planning: 0,
      completed: 0, cancelled: 0, lost: 0,
    };
    for (const r of rows) out[r.status] = r.n;
    return out;
  },

  /** event_id → organization_id map for events the user can see. */
  orgMapForUser(userId: string): Record<string, string> {
    const rows = db.prepare(
      `SELECT DISTINCT e.id, e.organization_id
       FROM events e
       LEFT JOIN event_memberships em ON em.event_id = e.id AND em.user_id = ?
       LEFT JOIN organization_memberships om ON om.organization_id = e.organization_id AND om.user_id = ? AND om.status = 'active'
       WHERE e.deleted_at IS NULL AND (em.id IS NOT NULL OR om.id IS NOT NULL)`
    ).all(userId, userId) as Array<{ id: string; organization_id: string }>;
    const map: Record<string, string> = {};
    for (const r of rows) map[r.id] = r.organization_id;
    return map;
  },

  // ── Event memberships (couple, day-of planner, vendor) ──
  addMember(input: { eventId: string; userId: string; roleId: string }): void {
    db.prepare(
      `INSERT OR REPLACE INTO event_memberships (id, event_id, user_id, role_id)
       VALUES (?, ?, ?, ?)`
    ).run(uuid(), input.eventId, input.userId, input.roleId);
  },

  listMembers(eventId: string) {
    return db.prepare(
      `SELECT em.*, u.email, u.full_name, r.key AS role_key, r.name AS role_name
       FROM event_memberships em
       JOIN users u ON u.id = em.user_id
       JOIN roles r ON r.id = em.role_id
       WHERE em.event_id = ?
       ORDER BY r.hierarchy DESC, em.created_at`
    ).all(eventId);
  },
};

// ─── Sub-events ──────────────────────────────────────────────
export const subEventsRepo = {
  findById(id: string) {
    return db.prepare("SELECT * FROM sub_events WHERE id = ?").get(id) as { id: string; event_id: string } | undefined;
  },

  create(input: {
    eventId: string;
    title: string;
    startsAt: string;
    endsAt?: string;
    venueId?: string;
    inviteOnly?: boolean;
    metadata?: Record<string, unknown>;
  }): SubEventRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO sub_events (id, event_id, title, starts_at, ends_at, venue_id, invite_only, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      input.eventId,
      input.title,
      input.startsAt,
      input.endsAt ?? null,
      input.venueId ?? null,
      input.inviteOnly ? 1 : 0,
      stringifyJson(input.metadata ?? {}),
    );
    return db.prepare(`SELECT * FROM sub_events WHERE id = ?`).get(id) as SubEventRow;
  },

  listForEvent(eventId: string): SubEventRow[] {
    return db.prepare(
      `SELECT * FROM sub_events WHERE event_id = ? ORDER BY starts_at`
    ).all(eventId) as SubEventRow[];
  },

  delete(id: string): boolean {
    const res = db.prepare(`DELETE FROM sub_events WHERE id = ?`).run(id);
    return res.changes > 0;
  },
};
