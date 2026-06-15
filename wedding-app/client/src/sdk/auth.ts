/** Auth SDK. Wraps /api/auth/*. */
import { api, setToken } from './client.js';
import type { SdkAuthResponse, SdkMembership, SdkUser } from './types.js';

export const authSdk = {
  async register(input: {
    email: string;
    password: string;
    fullName: string;
    orgName?: string;
    accountRole?: 'venue_owner' | 'venue_manager' | 'planner' | 'vendor' | 'couple';
    inviteToken?: string;
  }): Promise<SdkAuthResponse> {
    const res = await api.post<SdkAuthResponse>('/api/auth/register', input, { auth: false });
    setToken(res.token);
    return res;
  },

  invitation(token: string): Promise<{ invitation: { email: string; type?: 'organization' | 'event'; organizationId: string; organizationName: string; venueName?: string; eventId?: string | null; eventTitle?: string | null; eventDate?: string | null; roleId: string; roleKey: string; roleName: string; roleDescription: string; supportEmail?: string; accessSummary?: { can: string[]; cannot: string[] }; expiresAt: string } }> {
    return api.get(`/api/auth/invitations/${encodeURIComponent(token)}`, { auth: false });
  },

  async login(email: string, password: string): Promise<SdkAuthResponse> {
    const res = await api.post<SdkAuthResponse>('/api/auth/login', { email, password }, { auth: false });
    setToken(res.token);
    return res;
  },

  async me(): Promise<{ user: SdkUser; memberships: SdkMembership[] }> {
    return api.get('/api/auth/me');
  },

  async requestPasswordReset(email: string): Promise<{ ok: boolean; message: string; resetToken?: string; expiresAt?: string }> {
    return api.post('/api/auth/password-reset/request', { email }, { auth: false });
  },

  async requestMagicLink(email: string): Promise<{ ok: boolean; message: string; magicToken?: string; expiresAt?: string }> {
    return api.post('/api/auth/magic-link/request', { email }, { auth: false });
  },

  async completeMagicLink(token: string): Promise<SdkAuthResponse> {
    const res = await api.post<SdkAuthResponse>('/api/auth/magic-link/complete', { token }, { auth: false });
    setToken(res.token);
    return res;
  },

  async completePasswordReset(token: string, newPassword: string): Promise<{ ok: boolean }> {
    return api.post('/api/auth/password-reset/complete', { token, newPassword }, { auth: false });
  },

  async logout(): Promise<void> {
    try { await api.post('/api/auth/logout'); }
    catch { /* if the token was already invalid, that's fine */ }
    setToken(null);
  },
};

// ── Phase 27: password change + profile update ──────────
export const profileSdk = {
  changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean }> {
    return api.post('/api/auth/change-password', { currentPassword, newPassword });
  },

  updateProfile(patch: { fullName?: string; phone?: string }): Promise<{ user: SdkUser }> {
    return api.patch('/api/auth/profile', patch);
  },
};
