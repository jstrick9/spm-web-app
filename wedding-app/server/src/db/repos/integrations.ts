/**
 * Integrations repository.
 *
 * Storage rule: NEVER pass plaintext secrets through this layer.
 * Callers seal secrets with sealSecret() BEFORE upserting.
 * Decryption only happens in the integration runtime (src/integrations/runtime.ts).
 */
import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { parseJson, stringifyJson } from '../../lib/json.js';

export interface IntegrationRow {
  id: string;
  organization_id: string;
  provider: string;
  status: 'pending' | 'connected' | 'disabled' | 'error' | 'revoked';
  display_name: string | null;
  config: string;         // JSON
  secret_payload: string | null;
  webhook_secret: string | null;
  last_error: string | null;
  last_synced_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const integrationsRepo = {
  findById(id: string): IntegrationRow | undefined {
    return db.prepare(`SELECT * FROM integrations WHERE id = ?`).get(id) as IntegrationRow | undefined;
  },

  findByOrgProvider(orgId: string, provider: string): IntegrationRow | undefined {
    return db.prepare(
      `SELECT * FROM integrations WHERE organization_id = ? AND provider = ?`,
    ).get(orgId, provider) as IntegrationRow | undefined;
  },

  listForOrg(orgId: string): IntegrationRow[] {
    return db.prepare(
      `SELECT * FROM integrations WHERE organization_id = ? ORDER BY provider`,
    ).all(orgId) as IntegrationRow[];
  },

  /**
   * Insert OR update an integration. The framework calls this after a
   * successful OAuth callback or "save credentials" form submission.
   * `secretPayload` must already be sealed via sealSecret().
   */
  upsert(input: {
    organizationId: string;
    provider: string;
    displayName?: string;
    config?: Record<string, unknown>;
    secretPayload?: string;
    webhookSecret?: string;
    status?: IntegrationRow['status'];
    createdBy?: string;
  }): IntegrationRow {
    const existing = this.findByOrgProvider(input.organizationId, input.provider);
    if (existing) {
      const fields: string[] = [];
      const values: unknown[] = [];
      if (input.displayName !== undefined)    { fields.push('display_name = ?');     values.push(input.displayName); }
      if (input.config !== undefined)         { fields.push('config = ?');           values.push(stringifyJson(input.config)); }
      if (input.secretPayload !== undefined)  { fields.push('secret_payload = ?');   values.push(input.secretPayload); }
      if (input.webhookSecret !== undefined)  { fields.push('webhook_secret = ?');   values.push(input.webhookSecret); }
      if (input.status !== undefined)         { fields.push('status = ?');           values.push(input.status); }
      if (fields.length === 0) return existing;
      values.push(existing.id);
      db.prepare(
        `UPDATE integrations SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
      ).run(...values);
      return this.findById(existing.id)!;
    }
    const id = uuid();
    db.prepare(
      `INSERT INTO integrations
        (id, organization_id, provider, status, display_name, config, secret_payload, webhook_secret, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.organizationId,
      input.provider,
      input.status ?? 'pending',
      input.displayName ?? null,
      stringifyJson(input.config ?? {}),
      input.secretPayload ?? null,
      input.webhookSecret ?? null,
      input.createdBy ?? null,
    );
    return this.findById(id)!;
  },

  setStatus(id: string, status: IntegrationRow['status'], lastError?: string | null): void {
    db.prepare(
      `UPDATE integrations
       SET status = ?, last_error = ?, updated_at = datetime('now')
       WHERE id = ?`,
    ).run(status, lastError ?? null, id);
  },

  markSynced(id: string): void {
    db.prepare(
      `UPDATE integrations SET last_synced_at = datetime('now'), last_error = NULL, updated_at = datetime('now') WHERE id = ?`,
    ).run(id);
  },

  delete(id: string): boolean {
    return db.prepare(`DELETE FROM integrations WHERE id = ?`).run(id).changes > 0;
  },

  /** Parsed-config convenience reader. */
  parseConfig(row: IntegrationRow): Record<string, unknown> {
    return parseJson<Record<string, unknown>>(row.config, {});
  },

  // ─── Integration events (audit log) ─────────────────────
  logEvent(input: {
    integrationId: string;
    organizationId: string;
    direction: 'inbound' | 'outbound';
    kind: string;
    status: 'ok' | 'error' | 'retry' | 'dropped';
    payload?: Record<string, unknown>;
    errorMessage?: string;
    relatedType?: string;
    relatedId?: string;
  }): void {
    db.prepare(
      `INSERT INTO integration_events
       (id, integration_id, organization_id, direction, kind, status, payload, error_message, related_type, related_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      uuid(),
      input.integrationId,
      input.organizationId,
      input.direction,
      input.kind,
      input.status,
      stringifyJson(input.payload ?? {}),
      input.errorMessage ?? null,
      input.relatedType ?? null,
      input.relatedId ?? null,
    );
  },

  listEvents(integrationId: string, opts: { limit?: number } = {}) {
    return db.prepare(
      `SELECT * FROM integration_events WHERE integration_id = ? ORDER BY created_at DESC LIMIT ?`,
    ).all(integrationId, opts.limit ?? 100);
  },
};
