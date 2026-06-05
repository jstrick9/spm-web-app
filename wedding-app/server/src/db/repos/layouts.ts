import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { parseJson, stringifyJson } from '../../lib/json.js';

export interface LayoutRow {
  id: string;
  organization_id: string;
  event_id: string | null;
  venue_id: string | null;
  name: string;
  visibility: 'private' | 'event' | 'venue' | 'public';
  approval_status: 'draft' | 'pending' | 'approved' | 'rejected';
  revision: number;
  payload: string;       // JSON: tables, fixtures, guests-on-tables, etc.
  is_template: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LayoutVersionRow {
  id: string;
  layout_id: string;
  revision: number;
  payload: string;
  change_description: string | null;
  created_by: string | null;
  created_at: string;
}

export const layoutsRepo = {
  findById(id: string): LayoutRow | undefined {
    return db.prepare(`SELECT * FROM layouts WHERE id = ?`).get(id) as LayoutRow | undefined;
  },

  listForOrg(orgId: string, opts: { eventId?: string; isTemplate?: boolean } = {}): LayoutRow[] {
    let sql = `SELECT * FROM layouts WHERE organization_id = ?`;
    const params: unknown[] = [orgId];
    if (opts.eventId !== undefined) {
      if (opts.eventId === '') sql += ` AND event_id IS NULL`;
      else { sql += ` AND event_id = ?`; params.push(opts.eventId); }
    }
    if (opts.isTemplate !== undefined) {
      sql += ` AND is_template = ?`;
      params.push(opts.isTemplate ? 1 : 0);
    }
    sql += ` ORDER BY updated_at DESC`;
    return db.prepare(sql).all(...params) as LayoutRow[];
  },

  create(input: {
    organizationId: string;
    eventId?: string;
    venueId?: string;
    name: string;
    visibility?: LayoutRow['visibility'];
    approvalStatus?: LayoutRow['approval_status'];
    payload: Record<string, unknown>;
    isTemplate?: boolean;
    createdBy: string;
  }): LayoutRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO layouts
         (id, organization_id, event_id, venue_id, name, visibility, approval_status,
          revision, payload, is_template, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`
    ).run(
      id,
      input.organizationId,
      input.eventId ?? null,
      input.venueId ?? null,
      input.name,
      input.visibility ?? 'event',
      input.approvalStatus ?? 'draft',
      stringifyJson(input.payload),
      input.isTemplate ? 1 : 0,
      input.createdBy,
      input.createdBy,
    );
    // Snapshot revision 1 in versions.
    this._snapshot(id, 1, input.payload, input.createdBy, 'initial');
    return this.findById(id)!;
  },

  /**
   * Save a new revision. Bumps revision, snapshots the OLD payload into
   * layout_versions, then writes the new payload. All atomic.
   */
  saveRevision(input: {
    layoutId: string;
    payload: Record<string, unknown>;
    updatedBy: string;
    changeDescription?: string;
    expectedRevision?: number;  // optimistic concurrency
    approvalStatus?: string;
  }): LayoutRow {
    const tx = db.transaction(() => {
      const current = this.findById(input.layoutId);
      if (!current) throw new Error('layout-not-found');
      if (
        input.expectedRevision !== undefined &&
        input.expectedRevision !== current.revision
      ) {
        const err = new Error('revision-conflict') as Error & { code: string };
        err.code = 'revision-conflict';
        throw err;
      }
      const newRev = current.revision + 1;
      
      // FIX: Persistent approval status updates mapped correctly inside SQLite!
      db.prepare(
        `UPDATE layouts
           SET payload = ?, revision = ?, approval_status = ?, updated_by = ?, updated_at = datetime('now')
         WHERE id = ?`
      ).run(
        stringifyJson(input.payload),
        newRev,
        input.approvalStatus ?? current.approval_status,
        input.updatedBy,
        input.layoutId
      );
      this._snapshot(input.layoutId, newRev, input.payload, input.updatedBy, input.changeDescription ?? null);
    });
    tx();
    return this.findById(input.layoutId)!;
  },

  _snapshot(layoutId: string, revision: number, payload: unknown, userId: string, desc: string | null): void {
    db.prepare(
      `INSERT OR REPLACE INTO layout_versions
         (id, layout_id, revision, payload, change_description, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(uuid(), layoutId, revision, stringifyJson(payload), desc, userId);
  },

  listVersions(layoutId: string): LayoutVersionRow[] {
    return db.prepare(
      `SELECT * FROM layout_versions WHERE layout_id = ? ORDER BY revision DESC`
    ).all(layoutId) as LayoutVersionRow[];
  },

  getVersion(layoutId: string, revision: number): LayoutVersionRow | undefined {
    return db.prepare(
      `SELECT * FROM layout_versions WHERE layout_id = ? AND revision = ?`
    ).get(layoutId, revision) as LayoutVersionRow | undefined;
  },

  rename(id: string, name: string): void {
    db.prepare(`UPDATE layouts SET name = ?, updated_at = datetime('now') WHERE id = ?`).run(name, id);
  },

  delete(id: string): boolean {
    const res = db.prepare(`DELETE FROM layouts WHERE id = ?`).run(id);
    return res.changes > 0;
  },
};
