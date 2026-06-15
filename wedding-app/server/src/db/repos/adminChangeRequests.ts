import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';

export interface AdminChangeRequestRow {
  id: string;
  organization_id: string;
  requested_by: string | null;
  title: string;
  area: string;
  reason: string | null;
  status: 'open' | 'approved' | 'rejected' | 'resolved';
  response_note: string | null;
  created_at: string;
  updated_at: string;
}

export const adminChangeRequestsRepo = {
  listForOrg(orgId: string): AdminChangeRequestRow[] {
    return db.prepare(`SELECT * FROM admin_change_requests WHERE organization_id = ? ORDER BY created_at DESC`).all(orgId) as AdminChangeRequestRow[];
  },
  create(input: { orgId: string; requestedBy?: string | null; title: string; area?: string; reason?: string | null }): AdminChangeRequestRow {
    const id = uuid();
    db.prepare(`INSERT INTO admin_change_requests (id, organization_id, requested_by, title, area, reason) VALUES (?, ?, ?, ?, ?, ?)`).run(
      id, input.orgId, input.requestedBy ?? null, input.title, input.area ?? 'configuration', input.reason ?? null,
    );
    return db.prepare(`SELECT * FROM admin_change_requests WHERE id = ?`).get(id) as AdminChangeRequestRow;
  },
  update(id: string, patch: { status?: AdminChangeRequestRow['status']; responseNote?: string | null }): AdminChangeRequestRow | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.status) { fields.push('status = ?'); values.push(patch.status); }
    if ('responseNote' in patch) { fields.push('response_note = ?'); values.push(patch.responseNote ?? null); }
    if (!fields.length) return db.prepare(`SELECT * FROM admin_change_requests WHERE id = ?`).get(id) as AdminChangeRequestRow | undefined;
    values.push(id);
    db.prepare(`UPDATE admin_change_requests SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    return db.prepare(`SELECT * FROM admin_change_requests WHERE id = ?`).get(id) as AdminChangeRequestRow | undefined;
  },
};
