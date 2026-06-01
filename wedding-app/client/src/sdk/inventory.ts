import { api } from './client.js';

export interface SdkInventoryItem {
  id: string;
  organization_id: string;
  sku: string;
  name: string;
  category: string;
  total_count: number;
  available_count: number;
  condition: string;
  owner_type: string;
  notes: string | null;
  created_at: string;
}

export interface InventoryStats {
  total: number;
  lowStock: number;
  maintenance: number;
}

export const inventorySdk = {
  list(orgId: string): Promise<{ items: SdkInventoryItem[]; stats: InventoryStats }> {
    return api.get(`/api/orgs/${orgId}/inventory`);
  },
  create(orgId: string, input: {
    sku?: string; name: string; category?: string;
    totalCount?: number; availableCount?: number;
    condition?: string; ownerType?: string; notes?: string;
  }): Promise<{ item: SdkInventoryItem }> {
    return api.post(`/api/orgs/${orgId}/inventory`, input);
  },
  update(id: string, patch: Partial<{
    sku: string; name: string; category: string;
    totalCount: number; availableCount: number;
    condition: string; notes: string;
  }>): Promise<{ item: SdkInventoryItem }> {
    return api.patch(`/api/inventory/${id}`, patch);
  },
  delete(id: string): Promise<void> {
    return api.delete(`/api/inventory/${id}`);
  },
};
