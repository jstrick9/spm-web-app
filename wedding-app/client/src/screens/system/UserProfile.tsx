/**
 * UserProfile — user settings: profile info + password change.
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { User, Lock, Save, CheckCircle2 } from 'lucide-react';
import { sdk } from '../../sdk';
import { profileSdk } from '../../sdk/auth';
import type { SdkUser } from '../../sdk/types';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Label } from '../../ui/Label';
import { useToast } from '../../ui/Toast';

interface Props { user: SdkUser; onUpdated?: (user: SdkUser) => void }

export function UserProfile({ user, onUpdated }: Props) {
  const { toast } = useToast();

  // ─── Profile form ─────────────────────────────────────
  const [fullName, setFullName] = useState(user.fullName ?? '');
  const [phone, setPhone] = useState('');

  const profileMutation = useMutation({
    mutationFn: () => profileSdk.updateProfile({ fullName: fullName || undefined, phone: phone || undefined }),
    onSuccess: (res) => {
      toast({ title: 'Profile updated', variant: 'success' });
      onUpdated?.(res.user);
    },
    onError: () => toast({ title: 'Could not update profile', variant: 'destructive' }),
  });

  // ─── Password change ─────────────────────────────────
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdChanged, setPwdChanged] = useState(false);

  const pwdMutation = useMutation({
    mutationFn: () => profileSdk.changePassword(currentPwd, newPwd),
    onSuccess: (res) => {
      if ((res as any).error === 'invalid-current-password') {
        toast({ title: 'Current password is incorrect', variant: 'destructive' });
        return;
      }
      toast({ title: 'Password changed', description: 'Please log in again with your new password.', variant: 'success' });
      setPwdChanged(true);
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
    },
    onError: () => toast({ title: 'Could not change password', variant: 'destructive' }),
  });

  const pwdValid = currentPwd.length >= 1 && newPwd.length >= 8 && newPwd === confirmPwd;

  return (
    <>
      <PageHeader title="Account Settings" description="Manage your profile and security." />
      <PageBody className="max-w-2xl space-y-4 sm:space-y-6">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Profile</CardTitle>
            <CardDescription>Your name and contact information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input value={user.email} disabled className="mt-1 bg-surface-2" />
              <p className="text-[11px] text-fg-subtle mt-1">Email cannot be changed.</p>
            </div>
            <div>
              <Label htmlFor="fn">Full Name</Label>
              <Input id="fn" value={fullName} onChange={e => setFullName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="ph">Phone (optional)</Label>
              <Input id="ph" value={phone} onChange={e => setPhone(e.target.value)} className="mt-1" type="tel" />
            </div>
            <Button onClick={() => profileMutation.mutate()} isLoading={profileMutation.isPending} disabled={!fullName.trim()}>
              <Save className="h-3.5 w-3.5 mr-1" /> Save Profile
            </Button>
          </CardContent>
        </Card>

        {/* Password */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Lock className="h-4 w-4" /> Change Password</CardTitle>
            <CardDescription>Update your login credentials.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {pwdChanged && (
              <div className="flex items-center gap-2 p-3 rounded bg-success/10 text-success text-sm">
                <CheckCircle2 className="h-4 w-4" /> Password changed successfully.
              </div>
            )}
            <div>
              <Label htmlFor="cp">Current Password</Label>
              <Input id="cp" type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="np">New Password</Label>
              <Input id="np" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="mt-1" minLength={8} />
              {newPwd.length > 0 && newPwd.length < 8 && (
                <p className="text-xs text-danger mt-1">Must be at least 8 characters.</p>
              )}
            </div>
            <div>
              <Label htmlFor="cpw">Confirm New Password</Label>
              <Input id="cpw" type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} className="mt-1" />
              {confirmPwd && newPwd !== confirmPwd && (
                <p className="text-xs text-danger mt-1">Passwords don't match.</p>
              )}
            </div>
            <Button onClick={() => pwdMutation.mutate()} isLoading={pwdMutation.isPending} disabled={!pwdValid}>
              Change Password
            </Button>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
