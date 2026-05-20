import type { User, UserRole } from '../../types';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';

export interface BackendAuthSession {
  user: User;
  accessToken: string;
}

function mapRole(rawRole: unknown): UserRole {
  if (rawRole === 'admin' || rawRole === 'staff' || rawRole === 'guest') return rawRole;
  return 'basic';
}

function mapProfileToUser(profile: any, authUserId: string, authEmail: string): User {
  const email = String(profile?.email || authEmail || '');
  return {
    id: authUserId,
    username: email,
    email,
    password: '',
    role: mapRole(profile?.app_role || profile?.role),
    name: profile?.full_name || email || 'User',
    phone: profile?.phone || '',
    contactPhoneNumber: profile?.phone || '',
    phoneType: 'Mobile',
    preferredCommunication: ['email'],
    userStatus: 'active',
    isActive: true,
    createdAt: profile?.created_at || new Date().toISOString(),
    updatedAt: profile?.updated_at,
    assignedRoles: profile?.app_role ? [profile.app_role] : undefined,
    sessionVersion: 1,
  };
}

export function shouldUseSupabaseAuth(): boolean {
  return import.meta.env.VITE_BACKEND_PROVIDER === 'supabase' && isSupabaseConfigured();
}

export async function signInWithSupabase(
  email: string,
  password: string,
): Promise<BackendAuthSession | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  const { data: membership } = await supabase
    .from('organization_memberships')
    .select('role,status')
    .eq('user_id', data.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  const user = mapProfileToUser(
    { ...profile, app_role: membership?.role },
    data.user.id,
    data.user.email || email,
  );

  return { user, accessToken: data.session.access_token };
}

export async function restoreSupabaseSession(): Promise<BackendAuthSession | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session?.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  const { data: membership } = await supabase
    .from('organization_memberships')
    .select('role,status')
    .eq('user_id', session.user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  return {
    user: mapProfileToUser(
      { ...profile, app_role: membership?.role },
      session.user.id,
      session.user.email || '',
    ),
    accessToken: session.access_token,
  };
}

export async function signOutSupabase(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await getSupabaseClient().auth.signOut();
}

export async function requestSupabasePasswordReset(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}${window.location.pathname}#/password-reset`;
  const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
}
