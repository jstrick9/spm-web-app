import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';

export type InviteStatus = 'not_sent' | 'sent' | 'opened' | 'bounced';

export interface InviteTrackingRow {
  id: string;
  organization_id: string;
  event_id: string;
  guest_id: string;
  status: InviteStatus;
  sent_at: string | null;
  opened_at: string | null;
  channel: string;
  created_at: string;
  updated_at: string;
}

export const inviteTrackingRepo = {
  listForEvent(eventId: string): InviteTrackingRow[] {
    return db.prepare(
      `SELECT * FROM invite_tracking WHERE event_id = ? ORDER BY created_at`
    ).all(eventId) as InviteTrackingRow[];
  },

  statusMap(eventId: string): Record<string, InviteStatus> {
    const rows = this.listForEvent(eventId);
    const map: Record<string, InviteStatus> = {};
    for (const r of rows) map[r.guest_id] = r.status;
    return map;
  },

  upsert(input: {
    organizationId: string; eventId: string; guestId: string;
    status: InviteStatus; channel?: string;
  }): InviteTrackingRow {
    const existing = db.prepare(
      `SELECT * FROM invite_tracking WHERE event_id = ? AND guest_id = ?`
    ).get(input.eventId, input.guestId) as InviteTrackingRow | undefined;

    const now = new Date().toISOString();
    if (existing) {
      const sentAt = input.status === 'sent' ? now : null;
      const openedAt = input.status === 'opened' ? now : null;
      db.prepare(
        `UPDATE invite_tracking SET status = ?, sent_at = COALESCE(?, sent_at),
         opened_at = COALESCE(?, opened_at), updated_at = datetime('now') WHERE id = ?`
      ).run(input.status, sentAt, openedAt, existing.id);
      return db.prepare(`SELECT * FROM invite_tracking WHERE id = ?`).get(existing.id) as InviteTrackingRow;
    }

    const id = uuid();
    db.prepare(
      `INSERT INTO invite_tracking (id, organization_id, event_id, guest_id, status, sent_at, opened_at, channel)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.organizationId, input.eventId, input.guestId,
      input.status, input.status === 'sent' ? now : null,
      input.status === 'opened' ? now : null, input.channel ?? 'email');
    return db.prepare(`SELECT * FROM invite_tracking WHERE id = ?`).get(id) as InviteTrackingRow;
  },

  /** Bulk mark all guests for an event as sent. */
  bulkSend(orgId: string, eventId: string, guestIds: string[]): number {
    let count = 0;
    const tx = db.transaction(() => {
      for (const gid of guestIds) {
        this.upsert({ organizationId: orgId, eventId, guestId: gid, status: 'sent' });
        count++;
      }
    });
    tx();
    return count;
  },

  counts(eventId: string): { notSent: number; sent: number; opened: number; bounced: number } {
    const rows = db.prepare(
      `SELECT status, COUNT(*) AS n FROM invite_tracking WHERE event_id = ? GROUP BY status`
    ).all(eventId) as Array<{ status: string; n: number }>;
    const c = { notSent: 0, sent: 0, opened: 0, bounced: 0 };
    for (const r of rows) {
      if (r.status === 'not_sent') c.notSent = r.n;
      else if (r.status === 'sent') c.sent = r.n;
      else if (r.status === 'opened') c.opened = r.n;
      else if (r.status === 'bounced') c.bounced = r.n;
    }
    return c;
  },
};
