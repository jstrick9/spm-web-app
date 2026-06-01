import { api } from './client.js';

export interface SdkBudgetItem {
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
  created_at: string;
}

export interface BudgetTotals {
  planned: number;
  actual: number;
  paid: number;
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

export const budgetSdk = {
  list(eventId: string): Promise<{ items: SdkBudgetItem[]; totals: BudgetTotals }> {
    return api.get(`/api/events/${eventId}/budget`);
  },

  create(eventId: string, input: BudgetItemInput): Promise<{ item: SdkBudgetItem }> {
    return api.post(`/api/events/${eventId}/budget`, input);
  },

  update(id: string, patch: Partial<BudgetItemInput>): Promise<{ item: SdkBudgetItem }> {
    return api.patch(`/api/budget/${id}`, patch);
  },

  delete(id: string): Promise<void> {
    return api.delete(`/api/budget/${id}`);
  },
};
