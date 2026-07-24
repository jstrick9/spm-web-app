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
  attempt_count: number;
  next_retry_at: string | null;
  terminal_at: string | null;
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

  replayTerminalDelivery(webhookId: string, deliveryId: string): boolean {
    return db.prepare(`UPDATE webhook_deliveries SET terminal_at = NULL, next_retry_at = datetime('now') WHERE id = ? AND webhook_id = ? AND terminal_at IS NOT NULL`).run(deliveryId, webhookId).changes > 0;
  },

  claimDueRetries(limit = 20): Array<WebhookDeliveryRow & { url: string; secret: string }> {
    const rows = db.prepare(`SELECT d.*, w.url, w.secret FROM webhook_deliveries d JOIN webhooks w ON w.id = d.webhook_id WHERE d.next_retry_at <= datetime('now') AND d.terminal_at IS NULL AND w.is_active = 1 ORDER BY d.next_retry_at LIMIT ?`).all(limit) as Array<WebhookDeliveryRow & { url: string; secret: string }>;
    for (const row of rows) db.prepare(`UPDATE webhook_deliveries SET next_retry_at = NULL, terminal_at = datetime('now') WHERE id = ?`).run(row.id);
    return rows;
  },

  healthForOrg(orgId: string) {
    return db.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN d.next_retry_at IS NOT NULL AND d.terminal_at IS NULL THEN 1 ELSE 0 END) AS retry_backlog,
      SUM(CASE WHEN d.terminal_at IS NOT NULL THEN 1 ELSE 0 END) AS terminal_failures,
      AVG(CASE WHEN d.duration_ms IS NOT NULL THEN d.duration_ms END) AS avg_duration_ms
      FROM webhook_deliveries d JOIN webhooks w ON w.id = d.webhook_id WHERE w.organization_id = ?`).get(orgId) as { total:number; retry_backlog:number|null; terminal_failures:number|null; avg_duration_ms:number|null };
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
