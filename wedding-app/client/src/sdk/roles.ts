import { api } from './client.js';
import type { SdkRole, SdkPermissionDef, PermissionId } from './types.js';

export const rolesSdk = {
  listRoles(orgId: string): Promise<{ roles: SdkRole[] }> {
    return api.get(`/api/orgs/${orgId}/roles`);
  },

  permissionCatalog(orgId: string): Promise<{ catalog: SdkPermissionDef[] }> {
    return api.get(`/api/orgs/${orgId}/roles/permissions`);
  },

  createCustomRole(orgId: string, input: {
    key: string;
    name: string;
    description?: string;
    hierarchy?: number;
    permissions: PermissionId[];
    copyFrom?: string;
  }): Promise<{ role: SdkRole }> {
    return api.post(`/api/orgs/${orgId}/roles`, input);
  },

  updateCustomRole(roleId: string, patch: {
    name?: string;
    description?: string;
    hierarchy?: number;
    permissions?: PermissionId[];
  }): Promise<{ role: SdkRole }> {
    return api.patch(`/api/roles/${roleId}`, patch);
  },

  deleteCustomRole(roleId: string): Promise<void> {
    return api.delete(`/api/roles/${roleId}`);
  },

  // Members
  listMembers(orgId: string) {
    return api.get(`/api/orgs/${orgId}/members`);
  },

  addMember(orgId: string, input: { userEmail: string; roleId: string }) {
    return api.post(`/api/orgs/${orgId}/members`, input);
  },

  updateMemberRole(orgId: string, userId: string, roleId: string) {
    return api.patch(`/api/orgs/${orgId}/members/${userId}`, { roleId });
  },

  removeMember(orgId: string, userId: string): Promise<void> {
    return api.delete(`/api/orgs/${orgId}/members/${userId}`);
  },
};
