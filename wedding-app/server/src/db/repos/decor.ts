import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { parseJson, stringifyJson } from '../../lib/json.js';

export interface DecorItemRow {
  id: string;
  organization_id: string;
  category_id: string | null;
  name: string;
  spec: string;        // JSON
  image_path: string | null;
  visible: number;
  created_at: string;
  updated_at: string;
}

export interface DecorCategoryRow {
  id: string;
  organization_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
}

export interface DecorArrangementRow {
  id: string;
  organization_id: string;
  name: string;
  payload: string;     // JSON
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DecorPackageRow {
  id: string;
  organization_id: string;
  name: string;
  style: string | null;
  description: string | null;
  arrangements: string;  // JSON array
}

export const decorRepo = {
  // ─── Items ──────────────────────────────────────────────
  listItems(orgId: string): DecorItemRow[] {
    return db.prepare(
      `SELECT * FROM decor_items WHERE organization_id = ? ORDER BY name`
    ).all(orgId) as DecorItemRow[];
  },

  createItem(orgId: string, input: { categoryId?: string; name: string; spec?: Record<string, unknown>; imagePath?: string; visible?: boolean }): DecorItemRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO decor_items (id, organization_id, category_id, name, spec, image_path, visible)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, orgId, input.categoryId ?? null, input.name,
          stringifyJson(input.spec ?? {}), input.imagePath ?? null,
          input.visible === false ? 0 : 1);
    return db.prepare(`SELECT * FROM decor_items WHERE id = ?`).get(id) as DecorItemRow;
  },

  updateItem(id: string, patch: { categoryId?: string | null; name?: string; spec?: Record<string, unknown>; imagePath?: string | null; visible?: boolean }): DecorItemRow | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.categoryId !== undefined) { fields.push('category_id = ?'); values.push(patch.categoryId); }
    if (patch.name       !== undefined) { fields.push('name = ?');        values.push(patch.name); }
    if (patch.spec       !== undefined) { fields.push('spec = ?');        values.push(stringifyJson(patch.spec)); }
    if (patch.imagePath  !== undefined) { fields.push('image_path = ?');  values.push(patch.imagePath); }
    if (patch.visible    !== undefined) { fields.push('visible = ?');     values.push(patch.visible ? 1 : 0); }
    if (fields.length === 0) return db.prepare(`SELECT * FROM decor_items WHERE id = ?`).get(id) as DecorItemRow | undefined;
    values.push(id);
    db.prepare(`UPDATE decor_items SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    return db.prepare(`SELECT * FROM decor_items WHERE id = ?`).get(id) as DecorItemRow | undefined;
  },

  deleteItem(id: string): boolean {
    return db.prepare(`DELETE FROM decor_items WHERE id = ?`).run(id).changes > 0;
  },

  // ─── Categories ─────────────────────────────────────────
  listCategories(orgId: string): DecorCategoryRow[] {
    return db.prepare(
      `SELECT * FROM decor_categories WHERE organization_id = ? ORDER BY sort_order, name`
    ).all(orgId) as DecorCategoryRow[];
  },

  createCategory(orgId: string, input: { name: string; icon?: string; sortOrder?: number }): DecorCategoryRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO decor_categories (id, organization_id, name, icon, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, orgId, input.name, input.icon ?? null, input.sortOrder ?? 0);
    return db.prepare(`SELECT * FROM decor_categories WHERE id = ?`).get(id) as DecorCategoryRow;
  },

  deleteCategory(id: string): boolean {
    return db.prepare(`DELETE FROM decor_categories WHERE id = ?`).run(id).changes > 0;
  },

  // ─── Arrangements ───────────────────────────────────────
  listArrangements(orgId: string): DecorArrangementRow[] {
    return db.prepare(
      `SELECT * FROM decor_arrangements WHERE organization_id = ? ORDER BY name`
    ).all(orgId) as DecorArrangementRow[];
  },

  upsertArrangement(orgId: string, input: { id?: string; name: string; payload: Record<string, unknown>; createdBy?: string }): DecorArrangementRow {
    const id = input.id ?? uuid();
    const existing = input.id ? db.prepare(`SELECT id FROM decor_arrangements WHERE id = ?`).get(id) : undefined;
    if (existing) {
      db.prepare(
        `UPDATE decor_arrangements SET name = ?, payload = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(input.name, stringifyJson(input.payload), id);
    } else {
      db.prepare(
        `INSERT INTO decor_arrangements (id, organization_id, name, payload, created_by)
         VALUES (?, ?, ?, ?, ?)`
      ).run(id, orgId, input.name, stringifyJson(input.payload), input.createdBy ?? null);
    }
    return db.prepare(`SELECT * FROM decor_arrangements WHERE id = ?`).get(id) as DecorArrangementRow;
  },

  deleteArrangement(id: string): boolean {
    return db.prepare(`DELETE FROM decor_arrangements WHERE id = ?`).run(id).changes > 0;
  },

  // ─── Packages ───────────────────────────────────────────
  listPackages(orgId: string): DecorPackageRow[] {
    return db.prepare(
      `SELECT * FROM decor_packages WHERE organization_id = ? ORDER BY name`
    ).all(orgId) as DecorPackageRow[];
  },

  upsertPackage(orgId: string, input: { id?: string; name: string; style?: string; description?: string; arrangements: unknown[] }): DecorPackageRow {
    const id = input.id ?? uuid();
    const existing = input.id ? db.prepare(`SELECT id FROM decor_packages WHERE id = ?`).get(id) : undefined;
    if (existing) {
      db.prepare(
        `UPDATE decor_packages SET name = ?, style = ?, description = ?, arrangements = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(input.name, input.style ?? null, input.description ?? null, stringifyJson(input.arrangements), id);
    } else {
      db.prepare(
        `INSERT INTO decor_packages (id, organization_id, name, style, description, arrangements)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(id, orgId, input.name, input.style ?? null, input.description ?? null, stringifyJson(input.arrangements));
    }
    return db.prepare(`SELECT * FROM decor_packages WHERE id = ?`).get(id) as DecorPackageRow;
  },

  deletePackage(id: string): boolean {
    return db.prepare(`DELETE FROM decor_packages WHERE id = ?`).run(id).changes > 0;
  },
};
