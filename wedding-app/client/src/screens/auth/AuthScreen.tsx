import React, { useState, useRef, useEffect } from 'react';
import { ApiError, sdk } from '../../sdk';
import type { SdkUser, SdkMembership } from '../../sdk/types';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { useToast } from '../../ui/Toast';
import { Lock, Eye, EyeOff, Sparkles, Shield, User, HelpCircle, Layout, Music } from 'lucide-react';

export function AuthScreen({ onAuth }: { onAuth: (u: SdkUser, m?: SdkMembership[]) => void }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('owner@demo.local');
  const [password, setPassword] = useState('wedding123');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') {
        await sdk.auth.login(email, password);
      } else {
        await sdk.auth.register({ email, password, fullName, orgName });
      }
      const me = await sdk.auth.me();
      onAuth(me.user, me.memberships);
      toast({
        title: mode === 'login' ? 'Successfully Signed In' : 'Account Created Successfully',
        description: `Welcome back to Seven Paths Manor!`,
        variant: 'success',
      });
    } catch (err) {
      const e = err as ApiError;
      toast({
        title: 'Sign-in failed',
        description:
          e.code === 'invalid-credentials' ? 'Email or password is incorrect.' :
          e.code === 'email-already-registered' ? 'That email is already registered.' :
          e.kind === 'offline' ? 'Server unreachable. Check your connection.' :
          e.message,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  }

  const handleGuestContinue = async () => {
    setBusy(true);
    try {
      // Automatic login as guest / demo user
      await sdk.auth.login('owner@demo.local', 'wedding123');
      const me = await sdk.auth.me();
      onAuth(me.user, me.memberships);
      toast({
        title: 'Logged in as Planner Guest',
        description: 'You are viewing the space with standard planning privileges.',
        variant: 'success',
      });
    } catch {
      toast({ title: 'Demo server offline', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f8f5f7] to-[#efe7ee] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-2xl">
        
        {/* Banner with original venue-brand styling (#4A1942) */}
        <div className="bg-[#4A1942] px-6 py-8 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1)_0%,transparent_100%)] pointer-events-none" />
          <div className="mx-auto mb-4 flex justify-center h-12 w-12 items-center rounded-full bg-white/10 shadow-inner">
            <span className="text-2xl">💒</span>
          </div>
          <h1 className="text-2xl font-serif font-bold tracking-tight">Seven Paths Manor</h1>
          <p className="mt-2 text-xs font-serif text-white/85 italic">Where Your Love Story Unfolds</p>
          <p className="mt-1.5 text-[10px] uppercase tracking-wider text-white/60 font-semibold">Wedding Layout Planner</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Entry description box */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-800 space-y-2">
            <p className="font-bold flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-brand-strong animate-pulse" /> Choose your entry point
            </p>
            <ul className="space-y-1.5 text-amber-900/90 leading-relaxed">
              <li>• <strong>Venue teams & couples:</strong> sign in below to manage layouts, floral packages, questions, and guest lists.</li>
              <li>• <strong>Planner guests:</strong> continue as a guest planner to view layout templates.</li>
              <li>• <strong>Wedding guests:</strong> use the designated Guest Portal for RSVPs, songs, and lodging details.</li>
            </ul>
          </div>

          <div className="flex rounded-lg bg-surface-2 p-1 border border-border">
            <button
              onClick={() => setMode('login')}
              className={[
                'flex-1 py-1.5 text-xs font-semibold rounded-md transition-all',
                mode === 'login' ? 'bg-white shadow-sm text-brand-strong font-bold' : 'text-fg-muted hover:text-fg'
              ].join(' ')}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('register')}
              className={[
                'flex-1 py-1.5 text-xs font-semibold rounded-md transition-all',
                mode === 'register' ? 'bg-white shadow-sm text-brand-strong font-bold' : 'text-fg-muted hover:text-fg'
              ].join(' ')}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-3 animate-in fade-in-50 duration-200">
                <div>
                  <Label htmlFor="fn" className="text-[11px] font-bold text-fg-subtle uppercase">Your Full Name</Label>
                  <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="h-9 mt-1 text-xs" placeholder="Jane Smith" />
                </div>
                <div>
                  <Label htmlFor="on" className="text-[11px] font-bold text-fg-subtle uppercase">Venue / Organization Name</Label>
                  <Input id="on" value={orgName} onChange={(e) => setOrgName(e.target.value)} required className="h-9 mt-1 text-xs" placeholder="My Wedding Co." />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="em" className="text-[11px] font-bold text-fg-subtle uppercase">Email Address</Label>
              <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-9 mt-1 text-xs" placeholder="owner@demo.local" />
            </div>

            <div>
              <Label htmlFor="pw" className="text-[11px] font-bold text-fg-subtle uppercase">Password</Label>
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
                  placeholder="Enter secret passcode"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-fg-subtle hover:text-fg"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {capsLockOn && (
                <p className="mt-1 text-[10px] text-amber-700 font-semibold">⚠️ Caps Lock is on</p>
              )}
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-1.5 text-fg-subtle cursor-pointer font-medium">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-border accent-brand"
                />
                Remember me
              </label>
              <button type="button" className="text-brand hover:underline font-semibold">Forgot password?</button>
            </div>

            <Button type="submit" className="w-full h-10 tracking-wide font-semibold text-xs" isLoading={busy}>
              {mode === 'login' ? 'Sign In Securely' : 'Construct Account'}
            </Button>
          </form>

          {/* Quick-links alternative paths panel */}
          <div className="relative flex items-center justify-center my-4">
            <div className="absolute w-full border-t border-border" />
            <span className="relative px-3 bg-white text-[10px] uppercase tracking-wider text-fg-subtle font-bold">or</span>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleGuestContinue}
              className="w-full text-left p-3 rounded-xl border border-border bg-surface-2 hover:bg-surface-3 transition-colors flex items-start gap-3"
            >
              <span className="text-lg mt-0.5">📂</span>
              <div>
                <span className="block text-xs font-bold text-fg">Continue as Planner Guest</span>
                <span className="block text-[10px] text-fg-subtle mt-0.5">Explore template designs instantly without signing up.</span>
              </div>
            </button>

            <button
              onClick={() => { window.location.hash = '#/portal/demo'; }}
              className="w-full text-left p-3 rounded-xl border border-brand/20 bg-brand-soft/30 hover:bg-brand-soft/50 transition-colors flex items-start gap-3"
            >
              <span className="text-lg mt-0.5">💍</span>
              <div>
                <span className="block text-xs font-bold text-brand-strong">Open Wedding Guest Portal</span>
                <span className="block text-[10px] text-brand/80 mt-0.5">Submit RSVPs, dining preferences, and request lodging rooms.</span>
              </div>
            </button>
          </div>

          <div className="text-[10px] text-center text-fg-subtle space-y-1 pt-2">
            <p>© {new Date().getFullYear()} Seven Paths Manor • Self-Hosted Local Workspace</p>
            <p>Demo Admin: <code>owner@demo.local</code> / <code>wedding123</code></p>
          </div>
        </div>

      </div>
    </div>
  );
}
