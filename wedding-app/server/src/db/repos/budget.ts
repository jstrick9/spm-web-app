import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';

export interface BudgetItemRow {
  id: string;
  organization_id: string;
  event_id: string;
  category: string;
  title: string;
  planned_cents: number;
  actual_cents: number | null;
  paid_cents: number;
  vendor_id: string | null;
  notes: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BudgetItemInput {
  category: string;
  title: string;
  plannedCents: number;
  actualCents?: number | null;
  paidCents?: number;
  vendorId?: string | null;
  notes?: string;
  sortOrder?: number;
}

export const budgetRepo = {
  listForEvent(eventId: string): BudgetItemRow[] {
    return db.prepare(
      `SELECT * FROM budget_items WHERE event_id = ? ORDER BY sort_order, category, title`
    ).all(eventId) as BudgetItemRow[];
  },

  findById(id: string): BudgetItemRow | undefined {
    return db.prepare(`SELECT * FROM budget_items WHERE id = ?`).get(id) as BudgetItemRow | undefined;
  },

  create(orgId: string, eventId: string, input: BudgetItemInput, createdBy: string): BudgetItemRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO budget_items
         (id, organization_id, event_id, category, title, planned_cents, actual_cents, paid_cents, vendor_id, notes, sort_order, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, orgId, eventId,
      input.category, input.title,
      input.plannedCents,
      input.actualCents ?? null,
      input.paidCents ?? 0,
      input.vendorId ?? null,
      input.notes ?? null,
      input.sortOrder ?? 0,
      createdBy
    );
    return this.findById(id)!;
  },

  update(id: string, patch: Partial<BudgetItemInput>): BudgetItemRow | undefined {
    const map: Record<string, string> = {
      category: 'category', title: 'title',
      plannedCents: 'planned_cents', actualCents: 'actual_cents',
      paidCents: 'paid_cents', vendorId: 'vendor_id',
      notes: 'notes', sortOrder: 'sort_order',
    };
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      const col = map[k];
      if (!col) continue;
      fields.push(`${col} = ?`);
      values.push(v ?? null);
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    db.prepare(
      `UPDATE budget_items SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).run(...values);
    return this.findById(id);
  },

  delete(id: string): boolean {
    return db.prepare(`DELETE FROM budget_items WHERE id = ?`).run(id).changes > 0;
  },

  totalsForEvent(eventId: string): { planned: number; actual: number; paid: number } {
    const row = db.prepare(
      `SELECT
         COALESCE(SUM(planned_cents), 0) AS planned,
         COALESCE(SUM(actual_cents), 0)  AS actual,
         COALESCE(SUM(paid_cents), 0)    AS paid
       FROM budget_items WHERE event_id = ?`
    ).get(eventId) as { planned: number; actual: number; paid: number };
    return row;
  },

  /** Bulk list all budget items for an org (avoids N+1 in export). */
  listForOrg(orgId: string): BudgetItemRow[] {
    return db.prepare(
      `SELECT * FROM budget_items WHERE organization_id = ? ORDER BY event_id, sort_order`
    ).all(orgId) as BudgetItemRow[];
  },
};
