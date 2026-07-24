import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson, parseJson } from '../../lib/json.js';

export interface WebhookRow {
  id: string;
  organization_id: string;
  url: string;
  secret: string;
  event_types: string;  // JSON array
  is_active: number;
  description: string | null;
  last_triggered: string | null;
  last_status: number | null;
  failure_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookDeliveryRow {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: string;
  status: number | null;
  response: string | null;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
}

export const webhooksRepo = {
  create(input: {
    organizationId: string;
    url: string;
    secret?: string;
    eventTypes?: string[];
    description?: string;
    createdBy: string;
  }): WebhookRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO webhooks (id, organization_id, url, secret, event_types, description, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, input.organizationId, input.url,
      input.secret ?? '',
      stringifyJson(input.eventTypes ?? ['*']),
      input.description ?? null,
      input.createdBy
    );
    return this.findById(id)!;
  },

  findById(id: string): WebhookRow | undefined {
    return db.prepare(`SELECT * FROM webhooks WHERE id = ?`).get(id) as WebhookRow | undefined;
  },

  listForOrg(orgId: string): WebhookRow[] {
    return db.prepare(
      `SELECT * FROM webhooks WHERE organization_id = ? ORDER BY created_at DESC`
    ).all(orgId) as WebhookRow[];
  },

  listActiveForOrg(orgId: string): WebhookRow[] {
    return db.prepare(
      `SELECT * FROM webhooks WHERE organization_id = ? AND is_active = 1 ORDER BY created_at DESC`
    ).all(orgId) as WebhookRow[];
  },

  update(id: string, patch: {
    url?: string;
    secret?: string;
    eventTypes?: string[];
    isActive?: boolean;
    description?: string;
  }): WebhookRow | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.url !== undefined)         { fields.push('url = ?');         values.push(patch.url); }
    if (patch.secret !== undefined)      { fields.push('secret = ?');      values.push(patch.secret); }
    if (patch.eventTypes !== undefined)  { fields.push('event_types = ?'); values.push(stringifyJson(patch.eventTypes)); }
    if (patch.isActive !== undefined)    { fields.push('is_active = ?');   values.push(patch.isActive ? 1 : 0); }
    if (patch.description !== undefined) { fields.push('description = ?'); values.push(patch.description); }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    db.prepare(`UPDATE webhooks SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  delete(id: string): boolean {
    return db.prepare(`DELETE FROM webhooks WHERE id = ?`).run(id).changes > 0;
  },

  /** Record a delivery attempt. */
  recordDelivery(input: {
    webhookId: string;
    eventType: string;
    payload: Record<string, unknown>;
    status: number | null;
    response?: string;
    durationMs?: number;
    error?: string;
    attemptCount?: number;
    nextRetryAt?: string | null;
    terminalAt?: string | null;
  }): void {
    const id = uuid();
    db.prepare(
      `INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, status, response, duration_ms, error, attempt_count, next_retry_at, terminal_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, input.webhookId, input.eventType,
      stringifyJson(input.payload),
      input.status, (input.response ?? '').slice(0, 2048),
      input.durationMs ?? null, input.error ?? null, input.attemptCount ?? 1, input.nextRetryAt ?? null, input.terminalAt ?? null
    );
    // Update the webhook's last_triggered and status
    db.prepare(
      `UPDATE webhooks SET last_triggered = datetime('now'), last_status = ?,
       failure_count = CASE WHEN ? IS NULL OR ? >= 200 AND ? < 300 THEN 0 ELSE failure_count + 1 END,
       updated_at = datetime('now') WHERE id = ?`
    ).run(input.status, input.status, input.status, input.status, input.webhookId);
  },

  listDeliveries(webhookId: string, limit = 20): WebhookDeliveryRow[] {
    return db.prepare(
      `SELECT * FROM webhook_deliveries WHERE webhook_id = ? ORDER BY created_at DESC LIMIT ?`
    ).all(webhookId, limit) as WebhookDeliveryRow[];
  },

  /** Get webhooks that match a specific event type for an org. */
  matchingHooks(orgId: string, eventType: string): WebhookRow[] {
    const active = this.listActiveForOrg(orgId);
    return active.filter(h => {
      const types: string[] = parseJson(h.event_types, ['*']);
      return types.includes('*') || types.includes(eventType);
    });
  },
};
