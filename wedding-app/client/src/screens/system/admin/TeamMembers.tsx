/**
 * TeamMembers — manage org members: invite, change roles, remove.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, Trash2, Shield } from 'lucide-react';
import { sdk } from '../../../sdk';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Badge } from '../../../ui/Badge';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { useToast } from '../../../ui/Toast';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '../../../ui/Dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../../ui/Select';

interface Props { orgId: string }

export function TeamMembers({ orgId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);

  const membersQuery = useQuery({
    queryKey: ['members', orgId],
    queryFn: () => sdk.roles.listMembers(orgId),
  });

  const rolesQuery = useQuery({
    queryKey: ['roles', orgId],
    queryFn: () => sdk.roles.listRoles(orgId),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => sdk.roles.removeMember(orgId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', orgId] });
      toast({ title: 'Member removed', variant: 'success' });
    },
    onError: () => toast({ title: 'Cannot remove this member', variant: 'destructive' }),
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({ userId, targetRoleId }: { userId: string; targetRoleId: string }) =>
      sdk.roles.updateMemberRole(orgId, userId, targetRoleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', orgId] });
      toast({ title: 'Role updated successfully', variant: 'success' });
    },
    onError: (e: any) => {
      toast({ title: 'Could not update role', description: e?.message || 'Error occurred', variant: 'destructive' });
    }
  });

  interface OrgMember {
    userId: string; user_id?: string; email: string;
    fullName?: string; full_name?: string;
    roleName?: string; role_name?: string; roleKey?: string;
    roleId?: string; role_id?: string;
  }
  const members: OrgMember[] = (membersQuery.data as { members?: OrgMember[] })?.members ?? [];
  const roles = rolesQuery.data?.roles ?? [];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-fg">Team Members</h3>
          <p className="text-sm text-fg-muted">Invite planners, coordinators, and staff to your organization.</p>
        </div>
        <InviteDialog orgId={orgId} roles={roles} open={inviteOpen} onOpenChange={setInviteOpen} />
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-fg-muted text-sm">
            <Shield className="h-8 w-8 mx-auto mb-2 text-fg-subtle" />
            No team members yet. Click "Invite Member" to add your first.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {members.map((m: OrgMember) => (
            <Card key={m.userId ?? m.user_id}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-fg">{m.fullName ?? m.full_name ?? m.email}</div>
                  <div className="text-sm text-fg-muted">{m.email}</div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Badge variant="default" className="text-[10px] self-end">
                    {m.roleName ?? m.role_name ?? m.roleKey ?? 'member'}
                  </Badge>
                  <select
                    className="h-7 rounded border border-border bg-surface-2 px-1 text-[10px] font-semibold text-fg cursor-pointer max-w-[130px] mt-1"
                    value={(m.roleId ?? m.role_id ?? roles.find(r => r.name === m.roleName)?.id) || ''}
                    onChange={(e) => updateMemberRoleMutation.mutate({ userId: m.userId ?? m.user_id ?? '', targetRoleId: e.target.value })}
                  >
                    {roles.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Remove ${m.fullName ?? m.email} from the organization?`)) {
                      removeMutation.mutate(m.userId ?? m.user_id);
                    }
                  }}
                  className="p-1 text-fg-subtle hover:text-danger rounded shrink-0"
                  title="Remove member"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Invite Dialog ──────────────────────────────────────
function InviteDialog({ orgId, roles, open, onOpenChange }: {
  orgId: string; roles: any[]; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');

  const inviteMutation = useMutation({
    mutationFn: () => sdk.roles.addMember(orgId, { userEmail: email, roleId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members', orgId] });
      toast({ title: 'Member invited!', description: `${email} has been added.`, variant: 'success' });
      onOpenChange(false);
      setEmail(''); setRoleId('');
    },
    onError: (e: any) => {
      const msg = e?.message?.includes('not-found') ? 'User not found. They need to register first.' : 'Could not invite member.';
      toast({ title: msg, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm"><UserPlus className="h-3.5 w-3.5 mr-1" /> Invite Member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Email Address</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="planner@example.com" className="mt-1" type="email" />
            <p className="text-[11px] text-fg-subtle mt-1">The user must have a registered account.</p>
          </div>
          <div>
            <Label>Role</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select a role" /></SelectTrigger>
              <SelectContent>
                {roles.filter(r => r.key !== 'owner').map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} — <span className="text-fg-subtle">{r.description?.slice(0, 50)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => inviteMutation.mutate()} disabled={!email || !roleId || inviteMutation.isPending} isLoading={inviteMutation.isPending}>
            Send Invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
