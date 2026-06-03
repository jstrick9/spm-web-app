import { api } from './client.js';

export interface SdkDecorItem {
  id: string;
  organization_id: string;
  category_id: string | null;
  name: string;
  spec: Record<string, unknown>;
  image_path: string | null;
  visible: boolean;
  created_at: string;
}

export interface SdkDecorCategory {
  id: string;
  organization_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
}

export const decorSdk = {
  listItems(orgId: string): Promise<{ items: SdkDecorItem[] }> {
    return api.get(`/api/orgs/${orgId}/decor/items`);
  },
  createItem(orgId: string, input: { categoryId?: string; name: string; spec?: Record<string, unknown>; imagePath?: string; visible?: boolean }): Promise<{ item: SdkDecorItem }> {
    return api.post(`/api/orgs/${orgId}/decor/items`, input);
  },
  deleteItem(id: string): Promise<void> {
    return api.delete(`/api/decor/items/${id}`);
  },
  listCategories(orgId: string): Promise<{ categories: SdkDecorCategory[] }> {
    return api.get(`/api/orgs/${orgId}/decor/categories`);
  },
  createCategory(orgId: string, input: { name: string; icon?: string; sortOrder?: number }): Promise<{ category: SdkDecorCategory }> {
    return api.post(`/api/orgs/${orgId}/decor/categories`, input);
  },
  deleteCategory(id: string): Promise<void> {
    return api.delete(`/api/decor/categories/${id}`);
  }
};
