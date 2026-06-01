import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  organization_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

export interface PushSubscriptionInput {
  userId: string;
  organizationId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

export const pushSubscriptionsRepo = {
  upsert(input: PushSubscriptionInput): PushSubscriptionRow {
    const existing = db.prepare(
      `SELECT * FROM push_subscriptions WHERE endpoint = ?`
    ).get(input.endpoint) as PushSubscriptionRow | undefined;

    if (existing) {
      db.prepare(
        `UPDATE push_subscriptions
         SET user_id = ?, organization_id = ?, p256dh = ?, auth = ?,
             user_agent = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        input.userId, input.organizationId,
        input.p256dh, input.auth,
        input.userAgent ?? null,
        existing.id
      );
      return this.findById(existing.id)!;
    }

    const id = uuid();
    db.prepare(
      `INSERT INTO push_subscriptions
         (id, user_id, organization_id, endpoint, p256dh, auth, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, input.userId, input.organizationId,
      input.endpoint, input.p256dh, input.auth,
      input.userAgent ?? null
    );
    return this.findById(id)!;
  },

  findById(id: string): PushSubscriptionRow | undefined {
    return db.prepare(
      `SELECT * FROM push_subscriptions WHERE id = ?`
    ).get(id) as PushSubscriptionRow | undefined;
  },

  listForUser(userId: string): PushSubscriptionRow[] {
    return db.prepare(
      `SELECT * FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC`
    ).all(userId) as PushSubscriptionRow[];
  },

  listForOrg(orgId: string): PushSubscriptionRow[] {
    return db.prepare(
      `SELECT * FROM push_subscriptions WHERE organization_id = ? ORDER BY created_at DESC`
    ).all(orgId) as PushSubscriptionRow[];
  },

  deleteByEndpoint(endpoint: string): boolean {
    const res = db.prepare(
      `DELETE FROM push_subscriptions WHERE endpoint = ?`
    ).run(endpoint);
    return res.changes > 0;
  },

  deleteById(id: string): boolean {
    const res = db.prepare(
      `DELETE FROM push_subscriptions WHERE id = ?`
    ).run(id);
    return res.changes > 0;
  },
};
