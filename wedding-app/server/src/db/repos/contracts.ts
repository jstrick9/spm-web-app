import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';

export interface ContractRow {
  id: string;
  organization_id: string;
  event_id: string;
  title: string;
  status: 'draft' | 'sent' | 'signed' | 'expired';
  recipient_name: string;
  recipient_email: string | null;
  amount_cents: number | null;
  content: string;
  sent_at: string | null;
  signed_at: string | null;
  signature: string | null;
  signer_ip: string | null;
  metadata: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const contractsRepo = {
  listForEvent(eventId: string): ContractRow[] {
    return db.prepare(
      `SELECT * FROM contracts WHERE event_id = ? ORDER BY created_at DESC`
    ).all(eventId) as ContractRow[];
  },

  findById(id: string): ContractRow | undefined {
    return db.prepare(`SELECT * FROM contracts WHERE id = ?`).get(id) as ContractRow | undefined;
  },

  create(input: {
    organizationId: string; eventId: string; title: string;
    recipientName: string; recipientEmail?: string;
    amountCents?: number; content?: string; createdBy: string;
  }): ContractRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO contracts (id, organization_id, event_id, title, recipient_name, recipient_email, amount_cents, content, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.organizationId, input.eventId, input.title,
      input.recipientName, input.recipientEmail ?? null,
      input.amountCents ?? null, input.content ?? '', input.createdBy);
    return this.findById(id)!;
  },

  update(id: string, patch: Partial<{
    title: string; status: ContractRow['status'];
    recipientName: string; recipientEmail: string;
    amountCents: number; content: string;
    sentAt: string; signedAt: string; signature: string; signerIp: string;
  }>): ContractRow | undefined {
    const map: Record<string, string> = {
      title: 'title', status: 'status', recipientName: 'recipient_name',
      recipientEmail: 'recipient_email', amountCents: 'amount_cents',
      content: 'content', sentAt: 'sent_at', signedAt: 'signed_at',
      signature: 'signature', signerIp: 'signer_ip',
    };
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      const col = map[k]; if (!col) continue;
      fields.push(`${col} = ?`); values.push(v ?? null);
    }
    if (!fields.length) return this.findById(id);
    values.push(id);
    db.prepare(`UPDATE contracts SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  delete(id: string): boolean {
    return db.prepare(`DELETE FROM contracts WHERE id = ?`).run(id).changes > 0;
  },
};
