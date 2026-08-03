import React, { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers, Plus, Save, Trash2, Heart, Shield, Palette, Settings, Sparkles,
  Check, Upload, Image as ImageIcon, Trash, Sliders, Info, Eye, Lock,
  Music, Utensils, Link as LinkIcon, Compass, Users, CheckSquare, XSquare,
  HelpCircle, ChevronRight, Activity, Calendar, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import { sdk } from '../../../sdk';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { useToast } from '../../../ui/Toast';

export function AccessControlManager({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  
  // Local state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');

  // Custom role creator state
  const [roleCreatorOpen, setRoleCreatorOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleKey, setNewRoleKey] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  // Load backend data
  const membersQuery = useQuery({
    queryKey: ['members-access', orgId],
    queryFn: () => sdk.roles.listMembers(orgId),
  });

  const rolesQuery = useQuery({
    queryKey: ['roles-access', orgId],
    queryFn: () => sdk.roles.listRoles(orgId),
  });

  const permQuery = useQuery({
    queryKey: ['permissions-access', orgId],
    queryFn: () => sdk.roles.permissionCatalog(orgId),
  });

  // Mutations
  const inviteMutation = useMutation({
    mutationFn: () => sdk.roles.addMember(orgId, { userEmail: email, roleId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members-access', orgId] });
      toast({ title: 'Team member invited successfully', variant: 'success' });
      setEmail('');
      setRoleId('');
      setInviteOpen(false);
    },
    onError: (e: any) => toast({ title: 'Could not invite member', description: e.message, variant: 'destructive' }),
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({ userId, targetRoleId }: { userId: string; targetRoleId: string }) =>
      sdk.roles.updateMemberRole(orgId, userId, targetRoleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members-access', orgId] });
      toast({ title: 'Staff account role updated successfully', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Failed to update member role', description: e.message, variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => sdk.roles.removeMember(orgId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members-access', orgId] });
      toast({ title: 'Team member removed', variant: 'success' });
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: () =>
      sdk.roles.createCustomRole(orgId, {
        key: newRoleKey.toLowerCase().replace(/\s+/g, '-'),
        name: newRoleName,
        description: newRoleDesc,
        permissions: selectedPerms as any,
        hierarchy: 10,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles-access', orgId] });
      setNewRoleName('');
      setNewRoleKey('');
      setNewRoleDesc('');
      setSelectedPerms([]);
      setRoleCreatorOpen(false);
      toast({ title: 'Custom operational role created successfully', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Could not create role', description: e.message, variant: 'destructive' }),
  });

  const handleLoadDefaults = async () => {
    try {
      // 1. Create Coordinator Preset Role
      await sdk.roles.createCustomRole(orgId, {
        key: 'coordinator',
        name: 'Day-of Coordinator',
        description: 'Assigned staff responsible for checking rsvps and designing event floorplans.',
        permissions: ['events.view', 'events.edit', 'layouts.view', 'rsvp.view'] as any,
        hierarchy: 10,
      });

      // 2. Create Florist Designer Preset Role
      await sdk.roles.createCustomRole(orgId, {
        key: 'designer',
        name: 'Floral & Decor Designer',
        description: 'Specialist managing decoration catalogs and setting up layouts arch styles.',
        permissions: ['events.view', 'decor.manage', 'layouts.view'] as any,
        hierarchy: 12,
      });

      qc.invalidateQueries({ queryKey: ['roles-access', orgId] });
      toast({ title: 'Standard operational roles presets loaded successfully', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Could not load defaults', description: e.message, variant: 'destructive' });
    }
  };

  const handleQuickAdd = async (presetType: string) => {
    try {
      let rolePayload: any = {};
      if (presetType === 'coordinator') {
        rolePayload = {
          key: 'coord-' + Date.now(),
          name: 'Junior Coordinator',
          description: 'Assistant planner with restricted view-only layout access.',
          permissions: ['events.view', 'layouts.view'] as any,
          hierarchy: 8
        };
      } else {
        rolePayload = {
          key: 'steward-' + Date.now(),
          name: 'Catering Lead',
          description: 'Dining supervisor overseeing meal questionnaires and seating.',
          permissions: ['events.view', 'rsvp.view'] as any,
          hierarchy: 15
        };
      }
      await sdk.roles.createCustomRole(orgId, rolePayload);
      qc.invalidateQueries({ queryKey: ['roles-access', orgId] });
      toast({ title: 'Operational role preset created successfully', variant: 'success' });
    } catch (e: any) {
      toast({ title: 'Failed to create role preset', description: e.message, variant: 'destructive' });
    }
  };

  const members = (membersQuery.data as any)?.members ?? [];
  const roles = rolesQuery.data?.roles ?? [];
  const permissions = permQuery.data?.catalog ?? [];

  const togglePermissionCheckbox = (permId: string) => {
    setSelectedPerms((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Quick Add Presets Panel */}
      <div className="bg-surface-2/60 p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif">
            <Sparkles className="h-4 w-4 text-brand animate-pulse" /> Load Custom Role Presets
          </h4>
          <p className="text-[10px] text-fg-subtle">Instantly pre-configure specialized administrative user privileges and credentials.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="outline" onClick={() => handleQuickAdd('coordinator')}>📋 Day-Of Assistant</Button>
          <Button size="xs" variant="outline" onClick={() => handleQuickAdd('catering')}>🍽️ Catering Lead</Button>
          <Button size="xs" variant="outline" className="border-brand/30 text-brand bg-brand-soft/20" onClick={handleLoadDefaults}>💾 Load Role Defaults</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Staff Accounts */}
        <div className="lg:col-span-1 bg-surface-2/30 p-4 rounded-xl border border-border space-y-4 font-semibold">
          <div className="flex justify-between items-center border-b border-border/40 pb-2">
            <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif">
              <Users className="h-4 w-4 text-brand" /> Staff Accounts
            </h4>
            <Button size="xs" variant="outline" onClick={() => setInviteOpen(!inviteOpen)}>
              {inviteOpen ? 'Close' : 'Invite Staff'}
            </Button>
          </div>

          {inviteOpen && (
            <div className="bg-white p-4 rounded-xl border border-border space-y-3 shadow-xs">
              <h5 className="text-[11px] font-bold text-fg uppercase tracking-wider">Send Team Invite</h5>
              <div>
                <Label htmlFor="inv-email" className="text-[10px] text-fg-subtle">Email Address</Label>
                <Input id="inv-email" type="email" placeholder="planner@venue.com" value={email} onChange={e => setEmail(e.target.value)} className="h-9 text-xs mt-1" />
              </div>
              <div>
                <Label htmlFor="inv-role" className="text-[10px] text-fg-subtle">Privilege Level (Role)</Label>
                <select
                  id="inv-role"
                  value={roleId}
                  onChange={e => setRoleId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                >
                  <option value="">Select role</option>
                  {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
              <Button size="sm" onClick={() => inviteMutation.mutate()} className="w-full" disabled={!email || !roleId}>Send Invite</Button>
            </div>
          )}

          <div className="space-y-2 max-h-[350px] overflow-y-auto">
            {members.length === 0 ? (
              <p className="text-[11px] text-fg-subtle py-4 text-center">No staff found.</p>
            ) : (
              members.map((m: any) => (
                <div key={m.userId} className="flex justify-between items-center bg-white p-3 rounded-xl border border-border shadow-sm">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs font-bold text-fg truncate">{m.fullName || m.email}</div>
                    <div className="text-[9px] text-fg-subtle truncate">{m.email}</div>
                    
                    {/* Editable staff role dropdown select (dynamic sync!) */}
                    <div className="mt-1.5">
                      <select
                        className="h-7 rounded border border-border bg-surface-2 px-1 text-[10px] font-semibold text-fg cursor-pointer max-w-[130px]"
                        value={m.roleId}
                        onChange={(e) => updateMemberRoleMutation.mutate({ userId: m.userId, targetRoleId: e.target.value })}
                      >
                        {roles.map((r: any) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-danger hover:bg-danger/10 shrink-0" onClick={() => {
                     if (window.confirm(`Revoke staff access for ${m.fullName || m.email}?`)) {
                       removeMutation.mutate(m.userId);
                     }
                  }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Interactive Matrix Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center border-b border-border/40 pb-2">
            <h4 className="text-xs font-bold text-fg flex items-center gap-1.5 font-serif">
              <Shield className="h-4 w-4 text-brand" /> Interactive Privileges Matrix
            </h4>
            <Button size="xs" variant="outline" onClick={() => setRoleCreatorOpen(!roleCreatorOpen)}>
              {roleCreatorOpen ? 'Close Form' : 'Create Custom Role'}
            </Button>
          </div>

          {/* Interactive Role Creator Form */}
          {roleCreatorOpen && (
            <div className="bg-white p-5 rounded-xl border border-border space-y-4 shadow-md font-semibold animate-in slide-in-from-top-4">
              <h5 className="text-[11px] font-bold text-fg uppercase tracking-wider border-b pb-2">Define Custom Operational Role</h5>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="role-name" className="text-[10px]">Role Display Name</Label>
                  <Input id="role-name" placeholder="Day-of Coordinator" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} className="h-9 text-xs mt-1" />
                </div>
                <div>
                  <Label htmlFor="role-key" className="text-[10px]">Identifier Code Key (Lowercase, no spaces)</Label>
                  <Input id="role-key" placeholder="coordinator" value={newRoleKey} onChange={e => setNewRoleKey(e.target.value)} className="h-9 text-xs mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="role-desc" className="text-[10px]">Role Description</Label>
                  <Input id="role-desc" placeholder="Assigned personnel with restricted operational and coordinator access..." value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)} className="h-9 text-xs mt-1" />
                </div>
              </div>

              {/* Checkboxes of privileges */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-[10px] text-fg-subtle">Check Privileges to grant:</Label>
                <div className="grid grid-cols-2 gap-2 text-[11px] max-h-[150px] overflow-y-auto p-2 bg-surface-2/40 border rounded-lg">
                  {permissions.map((p: any) => (
                    <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:text-brand transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedPerms.includes(p.id)}
                        onChange={() => togglePermissionCheckbox(p.id)}
                        className="rounded border-border text-brand accent-brand h-3.5 w-3.5"
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button size="sm" onClick={() => createRoleMutation.mutate()} className="w-full" disabled={!newRoleName || !newRoleKey || selectedPerms.length === 0}>
                Create Custom Role
              </Button>
            </div>
          )}

          <div className="overflow-x-auto border border-border rounded-xl bg-white shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-2/60 border-b border-border text-[10px] uppercase font-bold tracking-wider text-fg-subtle">
                  <th className="p-3 border-r">Capability</th>
                  {roles.map((r: any) => (
                    <th key={r.id} className="p-3 text-center min-w-[80px]">{r.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {permissions.length === 0 ? (
                  <tr>
                    <td colSpan={roles.length + 1} className="p-4 text-center text-fg-subtle">No permission policies mapped.</td>
                  </tr>
                ) : (
                  permissions.map((p: any) => (
                    <tr key={p.id} className="hover:bg-surface-2/20 transition-colors">
                      <td className="p-3 border-r">
                        <div className="font-semibold text-fg">{p.label}</div>
                        <div className="text-[9px] text-fg-subtle mt-0.5">{p.description}</div>
                      </td>
                      {roles.map((r: any) => {
                        const hasPerm = r.permissions?.includes(p.id) ?? false;
                        return (
                          <td key={r.id} className="p-3 text-center">
                            {hasPerm ? (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-success-soft text-success text-xs font-bold">✓</span>
                            ) : (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-fg-subtle text-xs">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
