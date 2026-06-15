import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';

export type CoupleRequestType = 'partner_invite' | 'planner_request' | 'account_recovery' | 'identity_verification' | 'venue_question' | 'event_change_request' | 'guest_portal_update' | 'rsvp_reminder_request' | 'vendor_request' | 'vendor_question' | 'planner_collaboration' | 'finance_question' | 'change_order_request' | 'design_preferences_review' | 'decision_needed' | 'post_event_lost_item' | 'post_event_feedback' | 'review_testimonial_request';
export type CoupleRequestStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';

export interface CoupleRequestRow {
  id: string;
  organization_id: string;
  event_id: string;
  requester_user_id: string | null;
  request_type: CoupleRequestType;
  status: CoupleRequestStatus;
  target_email: string | null;
  target_name: string | null;
  note: string | null;
  metadata: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const coupleRequestsRepo = {
  listForEvent(eventId: string): CoupleRequestRow[] {
    return db.prepare(`SELECT * FROM couple_portal_requests WHERE event_id = ? ORDER BY created_at DESC`).all(eventId) as CoupleRequestRow[];
  },

  listForRequester(eventId: string, userId: string): CoupleRequestRow[] {
    return db.prepare(`SELECT * FROM couple_portal_requests WHERE event_id = ? AND requester_user_id = ? ORDER BY created_at DESC`).all(eventId, userId) as CoupleRequestRow[];
  },

  findById(id: string): CoupleRequestRow | undefined {
    return db.prepare(`SELECT * FROM couple_portal_requests WHERE id = ?`).get(id) as CoupleRequestRow | undefined;
  },

  create(input: {
    organizationId: string;
    eventId: string;
    requesterUserId?: string | null;
    requestType: CoupleRequestType;
    targetEmail?: string | null;
    targetName?: string | null;
    note?: string | null;
    metadata?: Record<string, unknown>;
    status?: CoupleRequestStatus;
  }): CoupleRequestRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO couple_portal_requests
       (id, organization_id, event_id, requester_user_id, request_type, status, target_email, target_name, note, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.organizationId,
      input.eventId,
      input.requesterUserId ?? null,
      input.requestType,
      input.status ?? 'pending',
      input.targetEmail?.trim().toLowerCase() || null,
      input.targetName ?? null,
      input.note ?? null,
      stringifyJson(input.metadata ?? {}),
    );
    return this.findById(id)!;
  },

  updateStatus(id: string, status: CoupleRequestStatus, reviewedBy?: string | null, metadata?: Record<string, unknown>): CoupleRequestRow | undefined {
    const current = this.findById(id);
    if (!current) return undefined;
    db.prepare(
      `UPDATE couple_portal_requests
       SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), metadata = ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).run(status, reviewedBy ?? null, stringifyJson(metadata ?? JSON.parse(current.metadata || '{}')), id);
    return this.findById(id);
  },
};
