import React, { useEffect, useState } from 'react';
import { ApiError, sdk } from '../../sdk';
import type { SdkUser, SdkMembership } from '../../sdk/types';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { useToast } from '../../ui/Toast';
import { ArrowRight, Eye, EyeOff, HelpCircle, Shield, Sparkles, Upload, UserCog, UserPlus } from 'lucide-react';

type AuthMode = 'login' | 'register' | 'reset' | 'completeReset';
type AccountRole = 'venue_owner' | 'venue_manager' | 'planner' | 'vendor' | 'couple';

const DEMO_EMAIL = 'owner@demo.local';
const DEMO_PASSWORD = 'wedding123';

const ROLE_OPTIONS: Array<{ value: AccountRole; label: string; description: string; who: string; summary: { can: string[]; cannot: string[] } }> = [
  {
    value: 'venue_owner',
    label: 'I’m a venue owner',
    description: 'Own setup, brand, pricing, finance, legal, and final operating decisions.',
    who: 'Use this if you own or administratively control the venue workspace.',
    summary: { can: ['Configure venue setup and branding', 'Invite team members', 'Access finance/admin settings'], cannot: ['Delegate owner accountability without transferring ownership'] },
  },
  {
    value: 'venue_manager',
    label: 'I’m a venue manager',
    description: 'Run operations, coordinate events, staff, guests, vendors, layouts, and escalate admin/finance issues.',
    who: 'Use this if you manage event operations but do not own platform, billing, or legal settings.',
    summary: { can: ['Run event operations and day-of workflows', 'Coordinate vendors, staff, guests, timelines, and layouts', 'View operational health and escalate issues'], cannot: ['Change owner/admin settings', 'Own billing/legal configuration', 'Bypass owner approval for restricted finance/admin actions'] },
  },
  {
    value: 'planner',
    label: 'I’m a planner',
    description: 'Coordinate planning deliverables, timelines, guests, vendors, layouts, and client communication.',
    who: 'Use this for internal or external planners coordinating event details.',
    summary: { can: ['Plan event details', 'Coordinate guests/vendors/timeline', 'Collaborate with venue team'], cannot: ['Manage venue-level admin settings'] },
  },
  {
    value: 'vendor',
    label: 'I’m a vendor',
    description: 'Learn how vendor questionnaires, COIs, logistics, and messaging work.',
    who: 'Use this if you provide services for an event and mainly use the vendor portal.',
    summary: { can: ['Submit questionnaires/COIs', 'Message venue team', 'View assigned logistics'], cannot: ['Access internal venue operations'] },
  },
  {
    value: 'couple',
    label: 'I’m a couple/client',
    description: 'Preview the planning and guest experience from the client side.',
    who: 'Use this if you are the event client/couple with portal-style access.',
    summary: { can: ['Preview guest/client experience', 'Coordinate client-visible details'], cannot: ['Access internal venue management tools'] },
  },
];

export function AuthScreen({ onAuth }: { onAuth: (u: SdkUser, m?: SdkMembership[]) => void }) {
  const { toast } = useToast();
  const [resetToken] = useState(() => window.location.hash.includes('/reset-password') ? new URLSearchParams((window.location.hash.split('?')[1] ?? '')).get('token') ?? '' : '');
  const [magicToken] = useState(() => window.location.hash.includes('/magic-link') ? new URLSearchParams((window.location.hash.split('?')[1] ?? '')).get('token') ?? '' : '');
  const [inviteToken] = useState(() => new URLSearchParams((window.location.hash.split('?')[1] ?? '')).get('inviteToken') ?? '');
  const [mode, setMode] = useState<AuthMode>(resetToken ? 'completeReset' : inviteToken ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [accountRole, setAccountRole] = useState<AccountRole>('venue_owner');
  const [inviteTeamAfterSetup, setInviteTeamAfterSetup] = useState(false);
  const [importSpreadsheet, setImportSpreadsheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);
  const [magicRequested, setMagicRequested] = useState(false);
  const [roleQuizOpen, setRoleQuizOpen] = useState(false);
  const [inviteSummary, setInviteSummary] = useState<{ organizationName: string; venueName?: string; eventId?: string | null; eventTitle?: string | null; eventDate?: string | null; roleName: string; roleKey: string; roleDescription: string; supportEmail?: string; accessSummary?: { can: string[]; cannot: string[] }; expiresAt: string } | null>(null);
  const selectedRole = ROLE_OPTIONS.find((role) => role.value === accountRole) ?? ROLE_OPTIONS[0];

  useEffect(() => {
    if (!magicToken) return;
    let cancelled = false;
    setBusy(true);
    sdk.auth.completeMagicLink(magicToken).then(async (res) => {
      if (cancelled) return;
      if (res.redirectTo) localStorage.setItem('wvi_post_auth_redirect', res.redirectTo);
      const me = await sdk.auth.me();
      onAuth(me.user, me.memberships);
      toast({ title: 'Signed in with magic link', description: 'Opening your private wedding hub.', variant: 'success' });
    }).catch((err: ApiError) => {
      if (!cancelled) toast({ title: 'Magic link failed', description: err.message, variant: 'destructive' });
    }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [magicToken, onAuth, toast]);

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    sdk.auth.invitation(inviteToken).then((res) => {
      if (cancelled) return;
      setInviteSummary(res.invitation);
      setEmail(res.invitation.email);
      if (res.invitation.roleKey === 'manager') setAccountRole('venue_manager');
      else if (res.invitation.roleKey === 'planner') setAccountRole('planner');
      else if (res.invitation.roleKey === 'vendor') setAccountRole('vendor');
      else if (res.invitation.roleKey === 'couple') setAccountRole('couple');
    }).catch(() => { /* invalid invite is handled at submit; keep form usable */ });
    return () => { cancelled = true; };
  }, [inviteToken]);

  const resetForm = () => {
    setPassword('');
    setFullName('');
    setOrgName('');
    setResetRequested(false);
    setMagicRequested(false);
  };

  const setEntryMode = (next: AuthMode) => {
    setMode(next);
    resetForm();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'reset') {
        await sdk.auth.requestPasswordReset(email);
        setResetRequested(true);
        toast({
          title: 'Password reset requested',
          description: 'If an account exists for that email, a reset link will be sent.',
          variant: 'success',
        });
        return;
      }

      if (mode === 'completeReset') {
        await sdk.auth.completePasswordReset(resetToken, password);
        window.location.hash = '#/';
        setEntryMode('login');
        toast({ title: 'Password reset complete', description: 'Sign in with your new password.', variant: 'success' });
        return;
      }

      if (mode === 'login') {
        await sdk.auth.login(email, password);
      } else {
        const registered = await sdk.auth.register({ email, password, fullName, orgName: inviteToken ? undefined : orgName, accountRole, inviteToken: inviteToken || undefined });
        if (!inviteToken) localStorage.setItem('wvi_show_owner_setup', accountRole === 'venue_manager' ? 'false' : accountRole === 'couple' ? 'false' : 'true');
        localStorage.setItem('wvi_registration_role', accountRole);
        if (accountRole === 'venue_manager') {
          localStorage.setItem('wvi_manager_onboarding_checklist', 'true');
          localStorage.setItem('wvi_manager_resume_enabled', 'true');
        }
        if (accountRole === 'couple') {
          localStorage.setItem('wvi_show_owner_setup', 'false');
          localStorage.setItem('wvi_couple_onboarding_checklist', 'true');
          if (registered.eventId) localStorage.setItem('wvi_couple_event_id', registered.eventId);
          if (registered.redirectTo) localStorage.setItem('wvi_post_auth_redirect', registered.redirectTo);
        }
        localStorage.setItem('wvi_post_setup_invite_team', inviteTeamAfterSetup ? 'true' : 'false');
        localStorage.setItem('wvi_onboarding_import_spreadsheet', importSpreadsheet ? 'true' : 'false');
      }
      const me = await sdk.auth.me();
      onAuth(me.user, me.memberships);
      toast({
        title: mode === 'login' ? 'Successfully signed in' : accountRole === 'couple' ? 'Wedding hub ready' : 'Venue account created',
        description: mode === 'login'
          ? 'Welcome back to your workspace.'
          : accountRole === 'couple'
            ? 'Opening your private wedding hub with your first-time couple checklist.'
            : 'Next, the setup wizard will help you add your venue brand, spaces, capacity, rules, and first event.',
        variant: 'success',
      });
    } catch (err) {
      const e = err as ApiError;
      toast({
        title: mode === 'reset' ? 'Reset request failed' : 'Sign-in failed',
        description:
          e.code === 'invalid-credentials' ? 'Email or password is incorrect.' :
          e.code === 'email-already-registered' ? 'That email is already registered.' :
          e.code === 'couple-invite-required' ? 'Booked couples should use the invitation link sent by the venue. If you need a new link, contact your venue coordinator.' :
          e.kind === 'offline' ? 'Server unreachable. Check your connection.' :
          e.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  const requestCoupleMagicLink = async () => {
    if (!email) {
      toast({ title: 'Enter your email first', description: 'Use the email from your venue invitation.', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const res = await sdk.auth.requestMagicLink(email);
      setMagicRequested(true);
      if (res.magicToken) console.info('Development couple magic link token:', res.magicToken);
      toast({ title: 'Couple sign-in link requested', description: res.message, variant: 'success' });
    } catch (err) {
      const e = err as ApiError;
      toast({ title: 'Magic link failed', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleExploreDemo = async (managerMode = false) => {
    setBusy(true);
    try {
      localStorage.setItem('wvi_demo_mode', 'true');
      localStorage.setItem('wvi_guided_demo_checklist', 'true');
      if (managerMode) {
        localStorage.setItem('wvi_manager_training_sandbox', 'true');
        localStorage.setItem('wvi_registration_role', 'venue_manager');
        localStorage.setItem('wvi_manager_onboarding_checklist', 'true');
      }
      // Explicit demo/trial mode is the only path that uses seeded demo credentials.
      await sdk.auth.login(DEMO_EMAIL, DEMO_PASSWORD);
      const me = await sdk.auth.me();
      onAuth(me.user, me.memberships);
      toast({
        title: managerMode ? 'Exploring manager training sandbox' : 'Exploring demo workspace',
        description: managerMode ? 'Manager training mode is on. Practice today queue, event operations, check-in, and escalations with sample data.' : 'Demo learning mode is on. Use sample events to learn before entering real operations.',
        variant: 'success',
      });
    } catch {
      toast({ title: 'Demo workspace unavailable', description: 'Seed the demo account or try creating your venue account.', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const isRegister = mode === 'register';
  const isReset = mode === 'reset';
  const isCompleteReset = mode === 'completeReset';

  return (
    <div className="min-h-screen bg-hero-editorial flex items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-2xl border border-border bg-surface shadow-xl overflow-hidden">
          <div className="bg-brand px-6 py-8 text-brand-fg text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_100%)] pointer-events-none" />
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-fg/10 shadow-inner">
              <span className="text-2xl">💒</span>
            </div>
            <h1 className="text-2xl font-serif font-bold tracking-tight">Wedding Venue Intelligence</h1>
            <p className="mt-2 text-xs font-serif text-brand-fg/85 italic">Your venue operating system for every wedding detail</p>
            <p className="mt-1.5 text-[10px] uppercase tracking-wider text-brand-fg/60 font-semibold">Venue Intelligence Platform</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900 space-y-2">
              <p className="font-bold flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-brand-strong" /> Choose how you want to start
              </p>
              <ul className="space-y-1.5 leading-relaxed">
                <li>• <strong>Sign in</strong> if your venue workspace already exists.</li>
                <li>• <strong>Create my venue account</strong> to launch the first-run setup wizard.</li>
                <li>• <strong>Explore demo</strong> to learn with sample data before entering real operations.</li>
              </ul>
            </div>

            <div className="grid grid-cols-3 rounded-lg bg-surface-2 p-1 border border-border" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                onClick={() => setEntryMode('login')}
                className={['py-2 text-xs font-semibold rounded-md transition-all', mode === 'login' ? 'bg-surface shadow-sm text-brand-strong font-bold' : 'text-fg-muted hover:text-fg'].join(' ')}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('register')}
                className={['py-2 text-xs font-semibold rounded-md transition-all', mode === 'register' ? 'bg-surface shadow-sm text-brand-strong font-bold' : 'text-fg-muted hover:text-fg'].join(' ')}
              >
                Create my venue account
              </button>
              <button
                type="button"
onClick={() => handleExploreDemo(false)}
                disabled={busy}
                className="py-2 text-xs font-semibold rounded-md transition-all text-fg-muted hover:text-fg disabled:opacity-60"
              >
                Explore demo
              </button>
            </div>

            {isReset && resetRequested ? (
              <div className="rounded-xl border border-success/20 bg-success-soft p-4 text-sm text-success space-y-3">
                <p className="font-bold">Check your email for the password reset link.</p>
                <p className="text-xs opacity-90">For security, we show the same message whether or not the email exists.</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setEntryMode('login')}>Back to sign in</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {isRegister && (
                  <div className="space-y-4 animate-in fade-in-50 duration-200">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="fn" className="text-[11px] font-bold text-fg-subtle uppercase">Your full name</Label>
                        <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="h-9 mt-1 text-xs" placeholder="Jane Smith" />
                      </div>
                      {!inviteToken && accountRole !== 'couple' && <div>
                        <Label htmlFor="on" className="text-[11px] font-bold text-fg-subtle uppercase">Venue / organization name</Label>
                        <Input id="on" value={orgName} onChange={(e) => setOrgName(e.target.value)} required className="h-9 mt-1 text-xs" placeholder="Willow Creek Estate" />
                      </div>}
                      {!inviteToken && accountRole === 'couple' && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><strong>Booked couples do not create a venue account.</strong><br />Use the private invitation link from your venue so we can open only your wedding hub. If you are a guest trying to RSVP, use the RSVP portal link from your invitation.</div>}
                      {inviteToken && <div className="rounded-lg border border-brand/20 bg-brand-soft/30 p-3 text-xs text-brand/90"><strong>{inviteSummary?.roleKey === 'couple' ? 'Wedding invitation detected.' : 'Team invitation detected.'}</strong><br />{inviteSummary ? <><span>You are joining <strong>{inviteSummary.venueName || inviteSummary.organizationName}</strong>{inviteSummary.eventTitle ? <> for <strong>{inviteSummary.eventTitle}</strong></> : null}{inviteSummary.eventDate ? <> on <strong>{inviteSummary.eventDate}</strong></> : null} as <strong>{inviteSummary.roleName}</strong>.</span><div className="mt-2 grid gap-2 sm:grid-cols-2"><div><strong>Can:</strong><ul className="list-disc pl-4">{(inviteSummary.accessSummary?.can || [inviteSummary.roleDescription]).map((item) => <li key={item}>{item}</li>)}</ul></div><div><strong>Cannot:</strong><ul className="list-disc pl-4">{(inviteSummary.accessSummary?.cannot || ['Access areas outside your assigned permissions.']).map((item) => <li key={item}>{item}</li>)}</ul></div></div>{inviteSummary.supportEmail && <p className="mt-2">Support: <a className="underline" href={`mailto:${inviteSummary.supportEmail}`}>{inviteSummary.supportEmail}</a></p>}</> : 'Create your user account to join the workspace you were invited to.'}</div>}
                    </div>

                    <fieldset className="space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <legend className="text-[11px] font-bold text-fg-subtle uppercase">What best describes you?</legend>
                        <button type="button" onClick={() => setRoleQuizOpen(!roleQuizOpen)} className="text-[11px] font-bold text-brand hover:underline">Not sure? Take role quiz</button>
                      </div>
                      {roleQuizOpen && (
                        <div className="rounded-xl border border-brand/20 bg-brand-soft/20 p-3 text-xs text-fg-muted space-y-2">
                          <p className="font-bold text-fg">Role-based onboarding quiz</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <button type="button" onClick={() => setAccountRole('venue_owner')} className="rounded-lg border border-border bg-surface p-2 text-left hover:border-brand">I own/administer the venue and approve finance/legal settings.</button>
                            <button type="button" onClick={() => setAccountRole('venue_manager')} className="rounded-lg border border-border bg-surface p-2 text-left hover:border-brand">I run daily operations, event week, staff, vendors, and escalations.</button>
                            <button type="button" onClick={() => setAccountRole('planner')} className="rounded-lg border border-border bg-surface p-2 text-left hover:border-brand">I plan timelines, guests, and client-facing event details.</button>
                            <button type="button" onClick={() => setAccountRole('vendor')} className="rounded-lg border border-border bg-surface p-2 text-left hover:border-brand">I provide services and need portal/logistics access.</button>
                            <button type="button" onClick={() => setAccountRole('couple')} className="rounded-lg border border-border bg-surface p-2 text-left hover:border-brand">I am the booked couple/client and have a venue invitation link.</button>
                          </div>
                        </div>
                      )}
                      <div className="grid gap-2 sm:grid-cols-2">
                        {ROLE_OPTIONS.map((role) => (
                          <label key={role.value} className={['rounded-lg border p-3 text-left cursor-pointer transition-colors', accountRole === role.value ? 'border-brand bg-brand-soft/50' : 'border-border bg-surface-2 hover:bg-surface-3'].join(' ')}>
                            <input
                              type="radio"
                              name="accountRole"
                              value={role.value}
                              checked={accountRole === role.value}
                              onChange={() => setAccountRole(role.value)}
                              className="sr-only"
                            />
                            <span className="block text-xs font-bold text-fg">{role.label}</span>
                            <span className="mt-1 block text-[10px] leading-relaxed text-fg-muted">{role.description}</span>
                            <span className="mt-1 block text-[10px] leading-relaxed text-brand">Who should use this role? {role.who}</span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    <div className="rounded-xl border border-border bg-surface-2 p-3 text-xs text-fg-muted space-y-2">
                      <div className="flex items-start gap-2">
                        <UserCog className="h-4 w-4 text-brand mt-0.5" />
                        <div>
                          <p className="font-bold text-fg">{accountRole === 'venue_manager' ? 'Venue manager first-login summary' : 'Permission summary'}</p>
                          {accountRole === 'venue_manager' && <p className="mt-1 text-brand">You are here to run operations, coordinate events, and escalate admin/finance issues.</p>}
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div><strong className="text-success">Can do:</strong><ul className="mt-1 list-disc pl-4 space-y-0.5">{selectedRole.summary.can.map((item) => <li key={item}>{item}</li>)}</ul></div>
                        <div><strong className="text-warning">Escalate / cannot do:</strong><ul className="mt-1 list-disc pl-4 space-y-0.5">{selectedRole.summary.cannot.map((item) => <li key={item}>{item}</li>)}</ul></div>
                      </div>
                    </div>
                  </div>
                )}

                {!isCompleteReset && <div>
                  <Label htmlFor="em" className="text-[11px] font-bold text-fg-subtle uppercase">Email address</Label>
                  <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-9 mt-1 text-xs" placeholder="you@yourvenue.com" autoComplete="email" />
                </div>}

                {!isReset && (
                  <div>
                    <Label htmlFor="pw" className="text-[11px] font-bold text-fg-subtle uppercase">{isCompleteReset ? 'New password' : 'Password'}</Label>
                    <div className="relative mt-1">
                      <Input
                        id="pw"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        required
                        minLength={8}
                        className="h-9 pr-10 text-xs"
                        placeholder={isRegister || isCompleteReset ? 'Create at least 8 characters' : 'Enter your password'}
                        autoComplete={isRegister || isCompleteReset ? 'new-password' : 'current-password'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 px-3 flex items-center text-fg-subtle hover:text-fg"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {capsLockOn && <p className="mt-1 text-[10px] text-amber-700 font-semibold">⚠️ Caps Lock is on</p>}
                  </div>
                )}

                {isRegister && (
                  <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3 text-xs text-fg-muted">
                    <p className="font-bold text-fg">After account creation</p>
                    {accountRole === 'venue_manager' ? (
                      <ol className="list-decimal pl-4 space-y-1">
                        <li>Your manager onboarding checklist opens independently from owner setup.</li>
                        <li>Start with the Manager Command Center, sample event operations, run sheet, vendor check-in, and escalation guidance.</li>
                        <li>Admin/finance changes show owner/admin escalation guidance when your role cannot perform them.</li>
                      </ol>
                    ) : accountRole === 'couple' ? (
                      <ol className="list-decimal pl-4 space-y-1">
                        <li>Your owner setup wizard stays off; you will not create or administer a venue workspace.</li>
                        <li>Your private wedding hub opens directly from the venue invitation.</li>
                        <li>Your first-login checklist focuses on guest list, RSVP portal, documents, timeline, floorplan review, and venue messages.</li>
                      </ol>
                    ) : (
                      <ol className="list-decimal pl-4 space-y-1">
                        <li>The setup wizard opens automatically for venue identity, spaces, rules, catalog basics, and first event.</li>
                        <li>You can choose a sample wedding, create a real event, or import from spreadsheet during onboarding.</li>
                        <li>Team invites are optional and can be completed after setup from Admin → Team Members.</li>
                      </ol>
                    )}
                    {accountRole !== 'couple' && <>
                    <label className="flex items-center gap-2 pt-1">
                      <input type="checkbox" checked={importSpreadsheet} onChange={(e) => setImportSpreadsheet(e.target.checked)} className="accent-brand" />
                      I want to import guests, vendors, or events from a spreadsheet during onboarding.
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={inviteTeamAfterSetup} onChange={(e) => setInviteTeamAfterSetup(e.target.checked)} className="accent-brand" />
                      Remind me to invite my team after setup.
                    </label>
                    </>}
                  </div>
                )}

                {mode === 'login' && (
                  <div className="space-y-2 pt-1 text-xs">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-1.5 text-fg-subtle cursor-pointer font-medium">
                        <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="rounded border-border accent-brand" />
                        Remember me
                      </label>
                      <button type="button" onClick={() => setEntryMode('reset')} className="text-brand hover:underline font-semibold">Forgot password?</button>
                    </div>
                    <button type="button" onClick={requestCoupleMagicLink} disabled={busy} className="w-full rounded-md border border-brand/20 bg-brand-soft/20 px-3 py-2 text-left font-semibold text-brand hover:bg-brand-soft/40 disabled:opacity-60">
                      Email me a booked-couple sign-in link
                    </button>
                    {magicRequested && <p className="rounded-md border border-success/20 bg-success-soft p-2 text-success">If a booked-couple account exists for this email, a one-time sign-in link has been sent.</p>}
                  </div>
                )}

                {isReset && (
                  <p className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-fg-muted">
                    Enter your account email. If it exists, we’ll send a reset link. This avoids revealing whether a venue account exists for a given email.
                  </p>
                )}
                {isCompleteReset && (
                  <p className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-fg-muted">
                    Enter a new password for your venue workspace. Reset links are one-time use and expire automatically.
                  </p>
                )}

                <Button type="submit" className="w-full h-10 tracking-wide font-semibold text-xs" isLoading={busy}>
                  {mode === 'login' ? 'Sign in securely' : mode === 'register' ? (accountRole === 'venue_manager' ? 'Create my manager workspace' : accountRole === 'couple' ? 'Create my wedding hub account' : 'Create my venue account') : mode === 'completeReset' ? 'Reset password' : 'Send password reset link'}
                </Button>

                {isRegister && accountRole === 'venue_manager' && (
                  <Button type="button" variant="outline" className="w-full" onClick={() => handleExploreDemo(true)} disabled={busy}>
                    Start with demo manager workspace <ArrowRight className="h-4 w-4" />
                  </Button>
                )}

                {isReset && (
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setEntryMode('login')}>Back to sign in</Button>
                )}
              </form>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <a href="mailto:support@example.com?subject=Wedding%20Venue%20Intelligence%20setup%20help" className="rounded-xl border border-border bg-surface-2 p-3 text-xs text-fg hover:bg-surface-3 transition-colors flex items-start gap-3">
                <HelpCircle className="h-4 w-4 mt-0.5 text-brand" />
                <span><strong>Need help?</strong><br /><span className="text-fg-muted">Email support or book a setup call with your deployment team.</span></span>
              </a>
              <button type="button" onClick={() => setEntryMode('register')} className="rounded-xl border border-brand/20 bg-brand-soft/30 p-3 text-xs text-brand-strong hover:bg-brand-soft/50 transition-colors flex items-start gap-3 text-left">
                <UserPlus className="h-4 w-4 mt-0.5" />
                <span><strong>Start with my real venue</strong><br /><span className="text-brand/80">Create your workspace and follow the guided setup checklist.</span></span>
              </button>
              <button type="button" onClick={() => { setEntryMode('register'); setAccountRole('couple'); }} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 hover:bg-amber-100 transition-colors flex items-start gap-3 text-left">
                <UserPlus className="h-4 w-4 mt-0.5" />
                <span><strong>I have a venue invitation link</strong><br /><span>Booked couples should open the private link from the venue email/text. This option explains what to do if you are on the wrong page.</span></span>
              </button>
              <a href="#/portal/your-event-id" className="rounded-xl border border-border bg-surface-2 p-3 text-xs text-fg hover:bg-surface-3 transition-colors flex items-start gap-3">
                <HelpCircle className="h-4 w-4 mt-0.5 text-brand" />
                <span><strong>I’m a guest trying to RSVP</strong><br /><span className="text-fg-muted">Use the RSVP portal link from your invitation; guests do not need a venue account.</span></span>
              </a>
            </div>

            <div className="text-[10px] text-center text-fg-subtle space-y-1 pt-2">
              <p>© {new Date().getFullYear()} Wedding Venue Intelligence • Venue Operations Workspace</p>
              <p>Deployment options: self-hosted local workspace or managed cloud. Use your deployment’s privacy policy, data retention, and security controls before storing real guest or payment data.</p>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-surface shadow-xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-brand-soft p-2 text-brand"><Shield className="h-5 w-5" /></div>
              <div>
                <h2 className="font-display text-xl text-brand-strong">{accountRole === 'venue_manager' ? 'First-time manager success path' : 'First-time owner success path'}</h2>
                <p className="mt-1 text-sm text-fg-muted">{accountRole === 'venue_manager' ? 'A guided start for venue managers learning event operations, day-of tools, and escalation paths.' : 'A guided start designed for venue owners who are learning the platform without a trainer.'}</p>
              </div>
            </div>
            <ol className="space-y-3 text-sm text-fg">
              {(accountRole === 'venue_manager' ? [
                'Confirm your manager role and assigned venue workspace.',
                'Review the Manager Command Center and today queue.',
                'Practice with a demo event before touching live event-week operations.',
                'Use escalation prompts when owner/admin permission is required.',
              ] : [
                'Create your venue account and identify your role.',
                'Complete the setup wizard for branding, spaces, capacities, rules, and catalog basics.',
                'Choose a sample wedding for practice or import real spreadsheets when ready.',
                'Invite planners, coordinators, and staff after setup if you want team access now.',
              ]).map((item, index) => (
                <li key={item} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-brand-fg text-xs font-bold">{index + 1}</span><span>{item}</span></li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-brand/20 bg-brand-soft/30 p-5 space-y-3">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-brand-strong mt-0.5" />
              <div>
                <h3 className="font-bold text-brand-strong">Explore demo workspace</h3>
                <p className="text-xs text-brand/80 mt-1">Trial mode uses sample data only and turns on a guided demo checklist so you can learn safely.</p>
              </div>
            </div>
            <ul className="space-y-1.5 text-xs text-brand/90">
              <li>✓ Review a sample event dashboard</li>
              <li>✓ Practice guest, vendor, timeline, layout, and intelligence workflows</li>
              <li>✓ Demo mode is visually labeled to avoid mixing sample data with real operations</li>
            </ul>
            <Button type="button" variant="accent" className="w-full" onClick={() => handleExploreDemo(false)} isLoading={busy}>Explore demo</Button>
          </div>

          <div className="rounded-2xl border border-border bg-surface p-5 text-sm text-fg-muted space-y-2">
            <div className="flex items-center gap-2 font-bold text-fg"><Upload className="h-4 w-4 text-brand" /> Spreadsheet import ready</div>
            <p>During onboarding, mark that you want to import guests, vendors, or event lists. The setup checklist will preserve that preference so your first real data entry path is clear.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
