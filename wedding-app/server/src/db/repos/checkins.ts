import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';

export type CheckInStatus = 'expected' | 'arrived' | 'setup' | 'completed' | 'departed' | 'late';

export interface CheckInRow {
  id: string;
  organization_id: string;
  event_id: string;
  vendor_id: string;
  status: CheckInStatus;
  checked_in_at: string | null;
  checked_in_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const checkinsRepo = {
  listForEvent(eventId: string): CheckInRow[] {
    return db.prepare(
      `SELECT * FROM vendor_checkins WHERE event_id = ? ORDER BY updated_at DESC`
    ).all(eventId) as CheckInRow[];
  },

  findByEventAndVendor(eventId: string, vendorId: string): CheckInRow | undefined {
    return db.prepare(
      `SELECT * FROM vendor_checkins WHERE event_id = ? AND vendor_id = ?`
    ).get(eventId, vendorId) as CheckInRow | undefined;
  },

  findById(id: string): CheckInRow | undefined {
    return db.prepare(`SELECT * FROM vendor_checkins WHERE id = ?`).get(id) as CheckInRow | undefined;
  },

  upsert(input: {
    organizationId: string; eventId: string; vendorId: string;
    status: CheckInStatus; checkedInBy?: string; notes?: string;
  }): CheckInRow {
    const existing = this.findByEventAndVendor(input.eventId, input.vendorId);
    const checkedInAt = ['arrived', 'setup'].includes(input.status) ? new Date().toISOString() : null;

    if (existing) {
      db.prepare(
        `UPDATE vendor_checkins SET status = ?, checked_in_at = COALESCE(?, checked_in_at),
         checked_in_by = COALESCE(?, checked_in_by), notes = COALESCE(?, notes),
         updated_at = datetime('now') WHERE id = ?`
      ).run(input.status, checkedInAt, input.checkedInBy ?? null, input.notes ?? null, existing.id);
      return this.findById(existing.id)!;
    }

    const id = uuid();
    db.prepare(
      `INSERT INTO vendor_checkins (id, organization_id, event_id, vendor_id, status, checked_in_at, checked_in_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.organizationId, input.eventId, input.vendorId,
      input.status, checkedInAt, input.checkedInBy ?? null, input.notes ?? null);
    return this.findById(id)!;
  },

  statusMap(eventId: string): Record<string, CheckInStatus> {
    const rows = this.listForEvent(eventId);
    const map: Record<string, CheckInStatus> = {};
    for (const r of rows) map[r.vendor_id] = r.status;
    return map;
  },

  counts(eventId: string): { expected: number; arrived: number; completed: number; departed: number } {
    const rows = db.prepare(
      `SELECT status, COUNT(*) AS n FROM vendor_checkins WHERE event_id = ? GROUP BY status`
    ).all(eventId) as Array<{ status: string; n: number }>;
    const c = { expected: 0, arrived: 0, completed: 0, departed: 0 };
    for (const r of rows) {
      if (r.status === 'expected') c.expected = r.n;
      else if (r.status === 'arrived' || r.status === 'setup') c.arrived += r.n;
      else if (r.status === 'completed') c.completed = r.n;
      else if (r.status === 'departed') c.departed = r.n;
    }
    return c;
  },
};
