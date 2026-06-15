import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';

export type HealthActionStateStatus = 'open' | 'acknowledged' | 'snoozed' | 'resolved';

export interface HealthActionStateRow {
  id: string;
  organization_id: string;
  action_id: string;
  status: HealthActionStateStatus;
  snoozed_until: string | null;
  assigned_to: string | null;
  note: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export const healthActionStatesRepo = {
  listForOrg(orgId: string): HealthActionStateRow[] {
    return db.prepare(`SELECT * FROM health_action_states WHERE organization_id = ? ORDER BY updated_at DESC`).all(orgId) as HealthActionStateRow[];
  },

  find(orgId: string, actionId: string): HealthActionStateRow | undefined {
    return db.prepare(`SELECT * FROM health_action_states WHERE organization_id = ? AND action_id = ?`).get(orgId, actionId) as HealthActionStateRow | undefined;
  },

  upsert(input: {
    organizationId: string;
    actionId: string;
    status: HealthActionStateStatus;
    snoozedUntil?: string | null;
    assignedTo?: string | null;
    note?: string | null;
    updatedBy?: string | null;
  }): HealthActionStateRow {
    const existing = this.find(input.organizationId, input.actionId);
    if (existing) {
      db.prepare(
        `UPDATE health_action_states
         SET status = ?, snoozed_until = ?, assigned_to = ?, note = ?, updated_by = ?, updated_at = datetime('now')
         WHERE organization_id = ? AND action_id = ?`,
      ).run(
        input.status,
        input.snoozedUntil ?? null,
        input.assignedTo ?? null,
        input.note ?? null,
        input.updatedBy ?? null,
        input.organizationId,
        input.actionId,
      );
    } else {
      db.prepare(
        `INSERT INTO health_action_states
          (id, organization_id, action_id, status, snoozed_until, assigned_to, note, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        uuid(),
        input.organizationId,
        input.actionId,
        input.status,
        input.snoozedUntil ?? null,
        input.assignedTo ?? null,
        input.note ?? null,
        input.updatedBy ?? null,
      );
    }
    return this.find(input.organizationId, input.actionId)!;
  },

  resolvedForOrg(orgId: string): HealthActionStateRow[] {
    return db.prepare(
      `SELECT * FROM health_action_states
       WHERE organization_id = ? AND status = 'resolved'
       ORDER BY updated_at DESC LIMIT 100`,
    ).all(orgId) as HealthActionStateRow[];
  },
};
