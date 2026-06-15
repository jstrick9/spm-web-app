import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';

export type CommunicationSeverity = 'fyi' | 'action_needed' | 'urgent' | 'owner_escalation';
export type CommunicationAudience = 'staff' | 'vendors' | 'guests' | 'all';
export type CommunicationChannel = 'in_app' | 'sms' | 'email' | 'all';

export interface CommunicationAuditRow {
  id: string;
  organization_id: string;
  event_id: string;
  channel: CommunicationChannel;
  audience: CommunicationAudience;
  severity: CommunicationSeverity;
  title: string;
  body: string;
  recipient_count: number;
  delivery_status: 'queued' | 'sent' | 'partial' | 'failed';
  approval_required: number;
  quiet_hours_override: number;
  created_by: string | null;
  created_at: string;
}

export interface BroadcastRecipientRow {
  id: string;
  broadcast_id: string;
  recipient_type: string;
  recipient_label: string;
  contact: string | null;
  channel: string;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  created_at: string;
}

export const communicationsRepo = {
  listForEvent(eventId: string) {
    const broadcasts = db.prepare(`SELECT * FROM event_communication_audit_logs WHERE event_id = ? ORDER BY created_at DESC LIMIT 100`).all(eventId) as CommunicationAuditRow[];
    const recipients = broadcasts.length ? db.prepare(`SELECT * FROM event_broadcast_recipients WHERE broadcast_id IN (${broadcasts.map(() => '?').join(',')}) ORDER BY created_at DESC`).all(...broadcasts.map(b => b.id)) as BroadcastRecipientRow[] : [];
    return { broadcasts, recipients };
  },

  createBroadcast(input: {
    organizationId: string;
    eventId: string;
    channel: CommunicationChannel;
    audience: CommunicationAudience;
    severity: CommunicationSeverity;
    title: string;
    body: string;
    approvalRequired?: boolean;
    quietHoursOverride?: boolean;
    createdBy?: string | null;
    recipients: Array<{ recipientType: string; recipientLabel: string; contact?: string | null; channel?: string; status?: 'queued' | 'sent' | 'failed' | 'skipped' }>;
  }): CommunicationAuditRow {
    const id = uuid();
    const deliveryStatus = input.approvalRequired ? 'queued' : input.recipients.some(r => r.status === 'failed') ? 'partial' : 'sent';
    const tx = db.transaction(() => {
      db.prepare(`INSERT INTO event_communication_audit_logs (id, organization_id, event_id, channel, audience, severity, title, body, recipient_count, delivery_status, approval_required, quiet_hours_override, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        id, input.organizationId, input.eventId, input.channel, input.audience, input.severity, input.title, input.body, input.recipients.length, deliveryStatus, input.approvalRequired ? 1 : 0, input.quietHoursOverride ? 1 : 0, input.createdBy ?? null,
      );
      for (const recipient of input.recipients) {
        db.prepare(`INSERT INTO event_broadcast_recipients (id, broadcast_id, recipient_type, recipient_label, contact, channel, status) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
          uuid(), id, recipient.recipientType, recipient.recipientLabel, recipient.contact ?? null, recipient.channel ?? input.channel, input.approvalRequired ? 'queued' : recipient.status ?? 'sent',
        );
      }
    });
    tx();
    return db.prepare(`SELECT * FROM event_communication_audit_logs WHERE id = ?`).get(id) as CommunicationAuditRow;
  },
};
