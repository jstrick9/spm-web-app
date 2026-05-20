/**
 * Unified catalog repository for: tables, fixtures, chairs, wall_styles,
 * linens, guidelines, spacing, templates.
 *
 * Why one table for all? The original app had 8 separate localStorage keys
 * with 90% the same shape. Combining them lets the admin UI use one CRUD
 * pattern instead of 8 near-identical ones.
 */
import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { parseJson, stringifyJson } from '../../lib/json.js';

export type CatalogKind =
  | 'table' | 'fixture' | 'chair' | 'wall_style'
  | 'linen' | 'guideline' | 'spacing' | 'template';

export interface CatalogItemRow {
  id: string;
  organization_id: string;
  kind: CatalogKind;
  name: string;
  spec: string;       // JSON
  visible: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CatalogItem<TSpec = Record<string, unknown>> {
  id: string;
  organizationId: string;
  kind: CatalogKind;
  name: string;
  spec: TSpec;
  visible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function rowToItem<T>(row: CatalogItemRow): CatalogItem<T> {
  return {
    id: row.id,
    organizationId: row.organization_id,
    kind: row.kind,
    name: row.name,
    spec: parseJson(row.spec, {} as T),
    visible: !!row.visible,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const catalogRepo = {
  listForOrg<T = Record<string, unknown>>(orgId: string, kind: CatalogKind): CatalogItem<T>[] {
    const rows = db.prepare(
      `SELECT * FROM catalog_items
       WHERE organization_id = ? AND kind = ?
       ORDER BY sort_order, name`
    ).all(orgId, kind) as CatalogItemRow[];
    return rows.map(rowToItem<T>);
  },

  findById<T = Record<string, unknown>>(id: string): CatalogItem<T> | undefined {
    const row = db.prepare(`SELECT * FROM catalog_items WHERE id = ?`).get(id) as CatalogItemRow | undefined;
    return row ? rowToItem<T>(row) : undefined;
  },

  create<T = Record<string, unknown>>(orgId: string, input: {
    kind: CatalogKind;
    name: string;
    spec?: T;
    visible?: boolean;
    sortOrder?: number;
  }): CatalogItem<T> {
    const id = uuid();
    db.prepare(
      `INSERT INTO catalog_items (id, organization_id, kind, name, spec, visible, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      orgId,
      input.kind,
      input.name,
      stringifyJson(input.spec ?? {}),
      input.visible === false ? 0 : 1,
      input.sortOrder ?? 0,
    );
    return this.findById<T>(id)!;
  },

  update<T = Record<string, unknown>>(id: string, patch: {
    name?: string;
    spec?: T;
    visible?: boolean;
    sortOrder?: number;
  }): CatalogItem<T> | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.name      !== undefined) { fields.push('name = ?');       values.push(patch.name); }
    if (patch.spec      !== undefined) { fields.push('spec = ?');       values.push(stringifyJson(patch.spec)); }
    if (patch.visible   !== undefined) { fields.push('visible = ?');    values.push(patch.visible ? 1 : 0); }
    if (patch.sortOrder !== undefined) { fields.push('sort_order = ?'); values.push(patch.sortOrder); }
    if (fields.length === 0) return this.findById<T>(id);
    values.push(id);
    db.prepare(
      `UPDATE catalog_items SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).run(...values);
    return this.findById<T>(id);
  },

  delete(id: string): boolean {
    const res = db.prepare(`DELETE FROM catalog_items WHERE id = ?`).run(id);
    return res.changes > 0;
  },

  /** Bulk replace: used by admin "save all" flows to atomically set the full list. */
  replaceAll<T = Record<string, unknown>>(orgId: string, kind: CatalogKind, items: Array<{
    id?: string; name: string; spec?: T; visible?: boolean; sortOrder?: number;
  }>): CatalogItem<T>[] {
    const tx = db.transaction(() => {
      db.prepare(`DELETE FROM catalog_items WHERE organization_id = ? AND kind = ?`).run(orgId, kind);
      for (const item of items) {
        const id = item.id ?? uuid();
        db.prepare(
          `INSERT INTO catalog_items (id, organization_id, kind, name, spec, visible, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(
          id, orgId, kind, item.name,
          stringifyJson(item.spec ?? {}),
          item.visible === false ? 0 : 1,
          item.sortOrder ?? 0,
        );
      }
    });
    tx();
    return this.listForOrg<T>(orgId, kind);
  },
};
