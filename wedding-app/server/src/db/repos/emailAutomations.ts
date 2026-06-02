import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';

export type TriggerType = 'rsvp_reminder' | 'thank_you' | 'save_the_date' | 'manual';

export interface EmailAutomationRow {
  id: string;
  organization_id: string;
  template_id: string;
  trigger_type: TriggerType;
  offset_days: number;
  enabled: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const emailAutomationsRepo = {
  listForOrg(orgId: string): EmailAutomationRow[] {
    return db.prepare(
      `SELECT * FROM email_automations WHERE organization_id = ? ORDER BY trigger_type`,
    ).all(orgId) as EmailAutomationRow[];
  },

  findById(id: string): EmailAutomationRow | undefined {
    return db.prepare(`SELECT * FROM email_automations WHERE id = ?`).get(id) as EmailAutomationRow | undefined;
  },

  /** Find the (single) enabled rule for a trigger in an org, if any. */
  findActive(orgId: string, trigger: TriggerType): EmailAutomationRow | undefined {
    return db.prepare(
      `SELECT * FROM email_automations
       WHERE organization_id = ? AND trigger_type = ? AND enabled = 1`,
    ).get(orgId, trigger) as EmailAutomationRow | undefined;
  },

  /** Upsert by (org, trigger_type) — at most one rule per trigger. */
  upsert(input: {
    organizationId: string;
    templateId: string;
    triggerType: TriggerType;
    offsetDays?: number;
    enabled?: boolean;
    createdBy?: string;
  }): EmailAutomationRow {
    const existing = db.prepare(
      `SELECT * FROM email_automations WHERE organization_id = ? AND trigger_type = ?`,
    ).get(input.organizationId, input.triggerType) as EmailAutomationRow | undefined;

    if (existing) {
      db.prepare(
        `UPDATE email_automations
         SET template_id = ?, offset_days = ?, enabled = ?, updated_at = datetime('now')
         WHERE id = ?`,
      ).run(
        input.templateId,
        input.offsetDays ?? existing.offset_days,
        input.enabled === undefined ? existing.enabled : (input.enabled ? 1 : 0),
        existing.id,
      );
      return this.findById(existing.id)!;
    }

    const id = uuid();
    db.prepare(
      `INSERT INTO email_automations
        (id, organization_id, template_id, trigger_type, offset_days, enabled, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.organizationId,
      input.templateId,
      input.triggerType,
      input.offsetDays ?? (input.triggerType === 'rsvp_reminder' ? 14 : 0),
      input.enabled === false ? 0 : 1,
      input.createdBy ?? null,
    );
    return this.findById(id)!;
  },

  delete(id: string): boolean {
    return db.prepare(`DELETE FROM email_automations WHERE id = ?`).run(id).changes > 0;
  },
};
