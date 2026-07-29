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

  inviteMember(orgId: string, input: { email: string; roleId: string }): Promise<{ ok: boolean; status: string; invitation?: any; token?: string }> {
    return api.post(`/api/orgs/${orgId}/team-invitations`, input);
  },

  listCoupleInvitations(eventId: string): Promise<{ invitations: Array<{ id: string; email: string; expiresAt: string; acceptedAt: string | null; revokedAt: string | null; createdAt: string }> }> { return api.get(`/api/events/${eventId}/couple-invitations`); },

  inviteEventMember(eventId: string, input: { email: string; roleId?: string; roleKey?: 'couple' | 'planner' }): Promise<{ ok: boolean; status: string; eventId: string; roleKey: string; invitation?: any; token?: string }> {
    return api.post(`/api/events/${eventId}/couple-invitations`, input);
  },

  listInvitations(orgId: string): Promise<{ invitations: any[] }> {
    return api.get(`/api/orgs/${orgId}/team-invitations`);
  },

  updateMemberRole(orgId: string, userId: string, roleId: string) {
    return api.patch(`/api/orgs/${orgId}/members/${userId}`, { roleId });
  },

  removeMember(orgId: string, userId: string): Promise<void> {
    return api.delete(`/api/orgs/${orgId}/members/${userId}`);
  },
};
