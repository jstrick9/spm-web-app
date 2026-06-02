import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';

export interface PaymentLinkRow {
  id: string; organization_id: string; event_id: string | null;
  contract_id: string | null; provider: string;
  external_id: string | null; amount_cents: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  payment_url: string | null; paid_at: string | null;
  metadata: string; created_at: string; updated_at: string;
}

export const paymentLinksRepo = {
  listForEvent(eventId: string): PaymentLinkRow[] {
    return db.prepare(`SELECT * FROM payment_links WHERE event_id = ? ORDER BY created_at DESC`).all(eventId) as PaymentLinkRow[];
  },

  findById(id: string): PaymentLinkRow | undefined {
    return db.prepare(`SELECT * FROM payment_links WHERE id = ?`).get(id) as PaymentLinkRow | undefined;
  },

  /** Reconcile an incoming webhook to its payment link via the provider's id. */
  findByExternalId(provider: string, externalId: string): PaymentLinkRow | undefined {
    return db.prepare(
      `SELECT * FROM payment_links WHERE provider = ? AND external_id = ?`,
    ).get(provider, externalId) as PaymentLinkRow | undefined;
  },

  /** Attach the provider's checkout id + hosted URL after creating a session. */
  attachCheckout(id: string, externalId: string, paymentUrl: string): PaymentLinkRow | undefined {
    db.prepare(
      `UPDATE payment_links
       SET external_id = ?, payment_url = ?, status = 'processing', updated_at = datetime('now')
       WHERE id = ?`,
    ).run(externalId, paymentUrl, id);
    return this.findById(id);
  },

  create(input: {
    organizationId: string; eventId?: string; contractId?: string;
    provider?: string; amountCents: number; paymentUrl?: string;
    externalId?: string; metadata?: Record<string, unknown>;
  }): PaymentLinkRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO payment_links (id, organization_id, event_id, contract_id, provider, amount_cents, payment_url, external_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.organizationId, input.eventId ?? null, input.contractId ?? null,
      input.provider ?? 'manual', input.amountCents, input.paymentUrl ?? null,
      input.externalId ?? null, stringifyJson(input.metadata ?? {}));
    return this.findById(id)!;
  },

  updateStatus(id: string, status: PaymentLinkRow['status'], paidAt?: string): PaymentLinkRow | undefined {
    db.prepare(`UPDATE payment_links SET status = ?, paid_at = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(status, paidAt ?? null, id);
    return this.findById(id);
  },

  totalsForEvent(eventId: string): { total: number; paid: number; pending: number } {
    const row = db.prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) as total,
              COALESCE(SUM(CASE WHEN status = 'completed' THEN amount_cents ELSE 0 END), 0) as paid,
              COALESCE(SUM(CASE WHEN status = 'pending' THEN amount_cents ELSE 0 END), 0) as pending
       FROM payment_links WHERE event_id = ?`
    ).get(eventId) as { total: number; paid: number; pending: number };
    return row;
  },
};
