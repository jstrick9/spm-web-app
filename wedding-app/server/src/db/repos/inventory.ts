import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';

export interface InventoryItemRow {
  id: string;
  organization_id: string;
  sku: string;
  name: string;
  category: 'chair' | 'linen' | 'centerpiece' | 'av' | 'lighting' | 'tableware' | 'other';
  total_count: number;
  available_count: number;
  condition: 'good' | 'fair' | 'poor' | 'maintenance';
  owner_type: 'venue' | 'vendor_rental';
  notes: string | null;
  spec: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const inventoryRepo = {
  listForOrg(orgId: string): InventoryItemRow[] {
    return db.prepare(
      `SELECT * FROM inventory_items WHERE organization_id = ? ORDER BY category, name`
    ).all(orgId) as InventoryItemRow[];
  },

  findById(id: string): InventoryItemRow | undefined {
    return db.prepare(`SELECT * FROM inventory_items WHERE id = ?`).get(id) as InventoryItemRow | undefined;
  },

  create(orgId: string, input: {
    sku?: string; name: string; category?: string;
    totalCount?: number; availableCount?: number;
    condition?: string; ownerType?: string; notes?: string; spec?: Record<string, unknown>; createdBy: string;
  }): InventoryItemRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO inventory_items (id, organization_id, sku, name, category, total_count, available_count, condition, owner_type, notes, spec, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, orgId, input.sku ?? '', input.name,
      input.category ?? 'other', input.totalCount ?? 0, input.availableCount ?? 0,
      input.condition ?? 'good', input.ownerType ?? 'venue',
      input.notes ?? null, JSON.stringify(input.spec ?? {}), input.createdBy);
    return this.findById(id)!;
  },

  update(id: string, patch: Partial<{
    sku: string; name: string; category: string;
    totalCount: number; availableCount: number;
    condition: string; ownerType: string; notes: string; spec: Record<string, unknown>;
  }>): InventoryItemRow | undefined {
    const map: Record<string, string> = {
      sku: 'sku', name: 'name', category: 'category',
      totalCount: 'total_count', availableCount: 'available_count',
      condition: 'condition', ownerType: 'owner_type', notes: 'notes', spec: 'spec',
    };
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      const col = map[k]; if (!col) continue;
      fields.push(`${col} = ?`); values.push(k === 'spec' ? JSON.stringify(v ?? {}) : v ?? null);
    }
    if (!fields.length) return this.findById(id);
    values.push(id);
    db.prepare(`UPDATE inventory_items SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  delete(id: string): boolean {
    return db.prepare(`DELETE FROM inventory_items WHERE id = ?`).run(id).changes > 0;
  },

  stats(orgId: string): { total: number; lowStock: number; maintenance: number } {
    const rows = db.prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN available_count < 10 THEN 1 ELSE 0 END) AS low_stock,
         SUM(CASE WHEN condition IN ('maintenance','poor') THEN 1 ELSE 0 END) AS maint
       FROM inventory_items WHERE organization_id = ?`
    ).get(orgId) as { total: number; low_stock: number; maint: number };
    return { total: rows.total, lowStock: rows.low_stock, maintenance: rows.maint };
  },
};
