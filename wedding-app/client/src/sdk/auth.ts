/** Auth SDK. Wraps /api/auth/*. */
import { api, setToken } from './client.js';
import type { SdkAuthResponse, SdkMembership, SdkUser } from './types.js';

export const authSdk = {
  async register(input: {
    email: string;
    password: string;
    fullName: string;
    orgName: string;
  }): Promise<SdkAuthResponse> {
    const res = await api.post<SdkAuthResponse>('/api/auth/register', input, { auth: false });
    setToken(res.token);
    return res;
  },

  async login(email: string, password: string): Promise<SdkAuthResponse> {
    const res = await api.post<SdkAuthResponse>('/api/auth/login', { email, password }, { auth: false });
    setToken(res.token);
    return res;
  },

  async me(): Promise<{ user: SdkUser; memberships: SdkMembership[] }> {
    return api.get('/api/auth/me');
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
