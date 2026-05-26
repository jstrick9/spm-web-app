import { api } from './client.js';
import type { SdkCatalogItem } from './types.js';

export type CatalogKind = SdkCatalogItem['kind'];

export const catalogSdk = {
  list(orgId: string, kind: CatalogKind): Promise<{ items: SdkCatalogItem[] }> {
    return api.get(`/api/orgs/${orgId}/catalog/${kind}`);
  },
  create(orgId: string, kind: CatalogKind, input: {
    name: string; spec?: Record<string, unknown>; visible?: boolean; sortOrder?: number;
  }): Promise<{ item: SdkCatalogItem }> {
    return api.post(`/api/orgs/${orgId}/catalog/${kind}`, input);
  },
  replaceAll(orgId: string, kind: CatalogKind, items: Array<{
    id?: string; name: string; spec?: Record<string, unknown>; visible?: boolean; sortOrder?: number;
  }>): Promise<{ items: SdkCatalogItem[] }> {
    return api.put(`/api/orgs/${orgId}/catalog/${kind}`, { items });
  },
  update(itemId: string, patch: {
    name?: string; spec?: Record<string, unknown>; visible?: boolean; sortOrder?: number;
  }): Promise<{ item: SdkCatalogItem }> {
    return api.patch(`/api/catalog/${itemId}`, patch);
  },
  delete(itemId: string): Promise<void> {
    return api.delete(`/api/catalog/${itemId}`);
  },
};
