/**
 * AuthScreen — login and registration forms.
 */
import { useState } from 'react';
import { ApiError, sdk } from '../../sdk';
import type { SdkUser, SdkMembership } from '../../sdk/types';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { useToast } from '../../ui/Toast';

export function AuthScreen({ onAuth }: { onAuth: (u: SdkUser, m?: SdkMembership[]) => void }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('owner@demo.local');
  const [password, setPassword] = useState('wedding123');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = mode === 'login'
        ? await sdk.auth.login(email, password)
        : await sdk.auth.register({ email, password, fullName, orgName });
      // In auth screen, we need to fetch memberships after login
      const me = await sdk.auth.me();
      onAuth(me.user, me.memberships);
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
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-hero-editorial flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display text-3xl">Wedding Venue Intelligence</CardTitle>
          <p className="text-sm text-fg-muted">
            Self-hosted backend. Configurable everything.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            <Button variant={mode === 'login' ? 'default' : 'secondary'} onClick={() => setMode('login')}>Log in</Button>
            <Button variant={mode === 'register' ? 'default' : 'secondary'} onClick={() => setMode('register')}>Create account</Button>
          </div>
          <form onSubmit={submit} className="space-y-3">
            {mode === 'register' && (
              <>
                <div>
                  <Label htmlFor="fn">Your name</Label>
                  <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="on">Venue / organization name</Label>
                  <Input id="on" value={orgName} onChange={(e) => setOrgName(e.target.value)} required className="mt-1.5" />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="em">Email</Label>
              <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="pw">Password</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="mt-1.5" />
            </div>
            <Button type="submit" className="w-full" isLoading={busy}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>
          <p className="text-xs text-fg-subtle mt-4">
            Demo seed: <code>owner@demo.local</code> / <code>wedding123</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
