import React, { useState, useMemo, useEffect } from 'react';
import { TeamMembers } from './TeamMembers';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Shield, Database, Settings, Activity, Download, Upload, Server,
  Layers, Heart, HelpCircle, Palette, Sliders, CheckSquare,
  AlertCircle, MessageSquare, ClipboardCheck, Bell, FileText, RefreshCcw, Eye, ArchiveRestore, ListChecks, LockKeyhole, Send, BookOpen, UserCog
} from 'lucide-react';
import { PageBody, PageHeader } from '../../../ui/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/Tabs';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { useToast } from '../../../ui/Toast';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { cn } from '../../../ui/lib/cn';
import { ControlPanel } from '../../../components/ControlPanel';
import { EventQuestionsStudio } from '../questions/EventQuestionsStudio';
import { sdk } from '../../../sdk';
import { getToken } from '../../../sdk/client';
import { SYSTEM_DEFAULTS } from '../../../config/defaults';
import type { PartialPlatformConfig } from '../../../config/schema';

// ─── Import unified workspaces from Catalog Screen ───
import {
  CatalogManager,
  VenueManager,
  DecorManager,
  BrandingManager,
  GuestPortalManager,
  AccessControlManager
} from '../../catalog/CatalogScreen';

interface Props {
  orgId: string;
}

type AdminTab =
  | 'team'
  | 'setup'
  | 'venue'
  | 'questions'
  | 'permissions'
  | 'branding'
  | 'guest_portal'
  | 'catalog'
  | 'templates'
  | 'notifications'
  | 'policies'
  | 'approvals'
  | 'safety_calculator'
  | 'system_health'
  | 'backups'
  | 'data_retention'
  | 'diagnostics';

type AdminGroup = 'required' | 'advanced';

const REQUIRED_TABS: Array<{ id: AdminTab; label: string; icon: React.ElementType; description: string }> = [
  { id: 'team', label: 'Team', icon: Users, description: 'Invite owners, planners, and day-of staff.' },
  { id: 'setup', label: 'Setup checklist', icon: ListChecks, description: 'Decide what first-time owners must complete before go-live.' },
  { id: 'venue', label: 'Venue basics', icon: Server, description: 'Spaces, capacities, addresses, and operating details.' },
  { id: 'questions', label: 'Inquiry questions', icon: HelpCircle, description: 'Default questions for couples and planners.' },
  { id: 'permissions', label: 'Roles & permissions', icon: Shield, description: 'Preview access before assigning a teammate.' },
  { id: 'branding', label: 'Branding', icon: Palette, description: 'Logo, venue colors, fonts, and support details.' },
  { id: 'guest_portal', label: 'Guest portal', icon: Sliders, description: 'Portal defaults, access rules, lodging, and RSVP settings.' },
];

const ADVANCED_TABS: Array<{ id: AdminTab; label: string; icon: React.ElementType; description: string }> = [
  { id: 'catalog', label: 'Catalog', icon: Layers, description: 'Tables, inventory, floorplan objects, and structural specs.' },
  { id: 'templates', label: 'Default templates', icon: FileText, description: 'Event, timeline, contract, message, and checklist templates.' },
  { id: 'notifications', label: 'Notifications', icon: Bell, description: 'Owner/team defaults for email, in-app, and urgent alerts.' },
  { id: 'policies', label: 'Venue policies', icon: ClipboardCheck, description: 'Rules for alcohol, noise, insurance, load-in, and cleanup.' },
  { id: 'approvals', label: 'Approvals', icon: CheckSquare, description: 'Review submitted layouts and operational changes.' },
  { id: 'safety_calculator', label: 'Safety calculator', icon: Activity, description: 'Capacity and clearance planning for floorplans.' },
  { id: 'system_health', label: 'System health', icon: Server, description: 'Integration checks and admin readiness diagnostics.' },
  { id: 'backups', label: 'Backup / restore', icon: Database, description: 'Export data and understand restore procedures.' },
  { id: 'data_retention', label: 'Data retention', icon: ArchiveRestore, description: 'Privacy retention defaults for events and portal data.' },
  { id: 'diagnostics', label: 'Diagnostics', icon: Settings, description: 'Developer diagnostics and feature flags.' },
];

export function AdminPanel({ orgId }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>('team');
  const [group, setGroup] = useState<AdminGroup>('required');
  const [previewRoleId, setPreviewRoleId] = useState<string>('');
  const tabs = group === 'required' ? REQUIRED_TABS : ADVANCED_TABS;
  const managerMode = typeof window !== 'undefined' && localStorage.getItem('wvi_registration_role') === 'venue_manager';

  if (managerMode) return <ManagerConfigurationViewer orgId={orgId} />;

  function switchGroup(next: AdminGroup) {
    setGroup(next);
    setActiveTab((next === 'required' ? REQUIRED_TABS : ADVANCED_TABS)[0].id);
  }

  return (
    <>
      <PageHeader
        title="Admin / Platform Studio"
        description="Start with required setup, then move into advanced platform tools when your venue operations are ready."
      />
      <PageBody>
        <div className="space-y-4">
          <Card className="border-border bg-surface">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="success" className="px-2 py-1">Owner-friendly admin</Badge>
                    <Badge variant="outline" className="px-2 py-1">No destructive action without confirmation</Badge>
                    {previewRoleId && <Badge variant="warning" className="px-2 py-1">Safe preview mode active</Badge>}
                  </div>
                  <h2 className="text-lg font-semibold text-fg">Choose what you need to set up right now</h2>
                  <p className="max-w-3xl text-sm text-fg-muted">
                    Required setup contains the settings a first-time venue owner must understand before inviting teams or clients.
                    Advanced tools stay available, but are separated so owners are not forced through technical controls on day one.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[360px]">
                  <Button variant={group === 'required' ? 'default' : 'outline'} onClick={() => switchGroup('required')} className="justify-start">
                    <CheckSquare className="h-4 w-4" /> Required setup
                  </Button>
                  <Button variant={group === 'advanced' ? 'default' : 'outline'} onClick={() => switchGroup('advanced')} className="justify-start">
                    <Settings className="h-4 w-4" /> Advanced tools
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="min-h-[600px] flex flex-col border-border bg-bg shadow-lg">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdminTab)} className="flex-1 flex flex-col">
              <div className="border-b border-border bg-bg/30 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-fg-subtle">
                      {group === 'required' ? 'Required setup' : 'Advanced tools'}
                    </p>
                    <p className="text-xs text-fg-muted">{tabs.find((tab) => tab.id === activeTab)?.description}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('wvi:open-owner-setup'))}>
                    Restart setup wizard
                  </Button>
                </div>
                <TabsList className="grid w-full grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
                  {tabs.map(({ id, label, icon: Icon }) => (
                    <TabsTrigger key={id} value={id} className="justify-start text-xs font-semibold">
                      <Icon className="mr-1.5 h-3.5 w-3.5" /> {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              
              <div className="flex-1 bg-bg p-4 sm:p-6">
                {previewRoleId && (
                  <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm text-fg">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-semibold">Safe preview mode is read-only. You are previewing permissions before assigning access.</span>
                      <Button size="xs" variant="outline" onClick={() => setPreviewRoleId('')}>Exit preview</Button>
                    </div>
                  </div>
                )}

                <TabsContent value="team" className="h-full m-0">
                  <TeamMembers orgId={orgId} />
                </TabsContent>
                
                <TabsContent value="permissions" className="h-full m-0 space-y-4">
                  <RolePermissionPreview orgId={orgId} previewRoleId={previewRoleId} onPreviewRoleId={setPreviewRoleId} />
                  <AccessControlManager orgId={orgId} />
                </TabsContent>

                <TabsContent value="setup" className="h-full m-0">
                  <AdminConfigurationManager orgId={orgId} section="setup" />
                </TabsContent>

                <TabsContent value="policies" className="h-full m-0">
                  <AdminConfigurationManager orgId={orgId} section="policies" />
                </TabsContent>

                <TabsContent value="templates" className="h-full m-0">
                  <AdminConfigurationManager orgId={orgId} section="templates" />
                </TabsContent>

                <TabsContent value="notifications" className="h-full m-0">
                  <AdminConfigurationManager orgId={orgId} section="notifications" />
                </TabsContent>

                <TabsContent value="data_retention" className="h-full m-0">
                  <AdminConfigurationManager orgId={orgId} section="retention" />
                </TabsContent>

                <TabsContent value="catalog" className="h-full m-0">
                  <CatalogManager orgId={orgId} kind="table" />
                </TabsContent>

                <TabsContent value="venue" className="h-full m-0">
                  <VenueManager orgId={orgId} />
                </TabsContent>

                <TabsContent value="questions" className="h-full m-0">
                  <EventQuestionsStudio orgId={orgId} />
                </TabsContent>

                <TabsContent value="branding" className="h-full m-0">
                  <BrandingManager orgId={orgId} />
                </TabsContent>

                <TabsContent value="guest_portal" className="h-full m-0">
                  <GuestPortalManager orgId={orgId} />
                </TabsContent>

                <TabsContent value="approvals" className="h-full m-0">
                  <LayoutApprovalQueue orgId={orgId} />
                </TabsContent>

                <TabsContent value="safety_calculator" className="h-full m-0">
                  <SpacingSafetyCalculator />
                </TabsContent>

                <TabsContent value="system_health" className="h-full m-0">
                  <SystemHealthDashboard orgId={orgId} />
                </TabsContent>

                <TabsContent value="backups" className="h-full m-0">
                  <BackupManager orgId={orgId} />
                </TabsContent>

                <TabsContent value="diagnostics" className="h-full m-0">
                  <ControlPanel />
                </TabsContent>
              </div>
            </Tabs>
          </Card>
        </div>
      </PageBody>
    </>
  );
}



function ManagerConfigurationViewer({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [requestTitle, setRequestTitle] = useState('');
  const [requestArea, setRequestArea] = useState('configuration');
  const [requestReason, setRequestReason] = useState('');
  const configQuery = useQuery({ queryKey: ['platformConfig', orgId, 'manager-view'], queryFn: () => sdk.platformConfig.getOrg(orgId) });
  const rolesQuery = useQuery({ queryKey: ['roles', orgId, 'manager-preview'], queryFn: () => sdk.roles.listRoles(orgId) });
  const membersQuery = useQuery({ queryKey: ['members', orgId, 'manager-admin-contacts'], queryFn: () => sdk.roles.listMembers(orgId) });
  const requestsQuery = useQuery({ queryKey: ['admin-change-requests', orgId], queryFn: () => sdk.platformConfig.listAdminChangeRequests(orgId) });
  const createRequest = useMutation({
    mutationFn: () => sdk.platformConfig.createAdminChangeRequest(orgId, { title: requestTitle, area: requestArea, reason: requestReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-change-requests', orgId] });
      setRequestTitle(''); setRequestReason('');
      toast({ title: 'Admin change requested', description: 'Owner/admin can review this request in Platform Studio.', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Could not request admin change', description: e.message, variant: 'destructive' }),
  });

  const config = configQuery.data?.config || {};
  const adminConfig = mergeAdminConfig(config);
  const roles = rolesQuery.data?.roles || [];
  const managerRole = roles.find((role: any) => role.key === 'manager' || /manager/i.test(role.name));
  const members = (membersQuery.data as any)?.members || [];
  const ownerContacts = members.filter((m: any) => /owner|admin/i.test(`${m.roleName} ${m.roleKey || ''}`)).slice(0, 4);
  const requests = requestsQuery.data?.requests || [];
  const configSummary = [
    ['Brand/theme', (config as any).theme?.brand ? 'Configured' : 'Default'],
    ['Required setup items', String(adminConfig.setupChecklist?.filter((i: any) => i.required).length || 0)],
    ['Venue policies', String(adminConfig.venuePolicies?.length || 0)],
    ['Default templates', `${adminConfig.defaultTemplates?.filter((t: any) => t.enabled).length || 0} enabled`],
    ['Critical notifications', `${adminConfig.notificationPreferences?.filter((n: any) => n.enabled && n.criticalOnly).length || 0} critical-only channel(s)`],
    ['Audit retention', `${adminConfig.dataRetention?.auditLogMonths || 0} months`],
  ];
  const workflowHelp = [
    ['Guest/portal defaults', 'Affect RSVP instructions, access windows, support copy, and guest issue volume.'],
    ['Venue policies', 'Affect alcohol, noise, insurance, load-in, cleanup, and staff/vendor instructions.'],
    ['Default templates', 'Affect new event setup, run-of-show, contracts, staff tasks, and communications.'],
    ['Notifications', 'Affect whether managers receive urgent day-of and health alerts.'],
    ['Roles/permissions', 'Determine what managers can edit versus what must be escalated.'],
  ];
  const sopLibrary = [
    'Opening manager huddle and event-day briefing',
    'Vendor load-in and COI verification SOP',
    'Guest exception and accessibility response SOP',
    'Rain plan activation and communication SOP',
    'Incident severity and owner notification SOP',
    'End-of-night closeout and handoff SOP',
  ];
  const auditSummaries = [
    'Configuration changes are owner/admin controlled and recorded in audit history.',
    'Manager requests are tracked below with open/approved/rejected/resolved status.',
    'Theme, notification, setup, policy, and retention changes can affect manager workflows.',
  ];

  return (
    <>
      <PageHeader title="Admin / Platform Studio" description="Manager read-only view: how this venue is configured and what to request from owner/admin." />
      <PageBody className="space-y-6">
        <Card className="border-brand/20 bg-brand-soft/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-brand" /> Manager configuration viewer</CardTitle>
            <CardDescription>Read-only “How this venue is configured” mode. Admin changes require owner/admin approval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3 text-sm text-warning"><LockKeyhole className="inline h-4 w-4 mr-1" /> Mostly read-only manager mode: request changes instead of editing platform settings directly.</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{configSummary.map(([label, value]) => <div key={label} className="rounded-lg border border-border bg-surface p-3"><div className="text-[10px] uppercase font-bold text-fg-subtle">{label}</div><div className="mt-1 text-lg font-bold text-fg">{value}</div></div>)}</div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Send className="h-4 w-4 text-brand" /> Request admin change</CardTitle><CardDescription>Use this when a setting blocks your workflow or needs owner/admin approval.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2"><Input placeholder="Request title" value={requestTitle} onChange={(e) => setRequestTitle(e.target.value)} /><select value={requestArea} onChange={(e) => setRequestArea(e.target.value)} className="h-10 rounded-md border border-border bg-surface px-3 text-sm"><option value="permissions">Permissions / role</option><option value="notifications">Notifications</option><option value="portal">Guest/vendor portal</option><option value="policies">Venue policies</option><option value="templates">Templates / SOP</option><option value="integrations">Integrations</option><option value="configuration">Other configuration</option></select></div>
              <textarea className="min-h-24 w-full rounded-md border border-border bg-surface p-3 text-sm" placeholder="What needs to change, why, and which event/workflow is affected?" value={requestReason} onChange={(e) => setRequestReason(e.target.value)} />
              <Button disabled={!requestTitle.trim() || createRequest.isPending} onClick={() => createRequest.mutate()}><Send className="h-4 w-4" /> Submit request</Button>
              <div className="space-y-2 pt-2"><h3 className="text-xs font-bold uppercase text-fg-subtle">Admin change request queue</h3>{requests.length ? requests.slice(0, 6).map((request: any) => <div key={request.id} className="rounded-lg border border-border bg-surface-2 p-2 text-xs"><div className="flex justify-between gap-2"><strong>{request.title}</strong><Badge variant={request.status === 'open' ? 'warning' : request.status === 'resolved' ? 'success' : 'outline'}>{request.status}</Badge></div><p className="mt-1 text-fg-muted">{request.area} · {request.reason || 'No reason provided'}</p></div>) : <p className="text-xs text-fg-muted">No admin change requests yet.</p>}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><UserCog className="h-4 w-4 text-brand" /> Venue Manager role policy pack</CardTitle><CardDescription>Preview manager access and escalation boundaries.</CardDescription></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{managerRole?.name || 'Venue Manager'}</strong><p className="mt-1 text-xs text-fg-muted">{managerRole?.permissions?.length || 0} permissions in policy. Managers run operations, staff/vendor/guest workflows, layout review, timeline, and escalations without owner-only admin powers.</p></div>
              <div className="grid gap-2 text-xs"><Badge variant="success">Can run event operations</Badge><Badge variant="outline">Can view configuration</Badge><Badge variant="warning">Must request owner/admin changes</Badge><Badge variant="outline">Finance/admin visibility depends on permissions</Badge></div>
              <div><h3 className="mb-2 text-xs font-bold uppercase text-fg-subtle">Owner/admin escalation contacts</h3>{ownerContacts.length ? ownerContacts.map((m: any) => <div key={m.userId} className="rounded-lg border border-border bg-surface p-2 text-xs"><strong>{m.fullName || m.email}</strong><div className="text-fg-muted">{m.roleName || 'Owner/Admin'} · {m.email}</div></div>) : <p className="text-xs text-fg-muted">No owner/admin contact found. Ask your venue administrator to update team records.</p>}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><HelpCircle className="h-4 w-4 text-brand" /> What settings affect my workflow?</CardTitle></CardHeader><CardContent className="space-y-2">{workflowHelp.map(([title, desc]) => <div key={title} className="rounded-lg border border-border bg-surface p-2 text-xs"><strong>{title}</strong><p className="text-fg-muted">{desc}</p></div>)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4 text-brand" /> Venue SOP library</CardTitle><CardDescription>SOPs tied to Platform Studio rules and templates.</CardDescription></CardHeader><CardContent className="space-y-2">{sopLibrary.map((item) => <div key={item} className="rounded-lg border border-border bg-surface p-2 text-xs font-semibold">{item}</div>)}</CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="h-4 w-4 text-brand" /> Manager-readable audit summaries</CardTitle></CardHeader><CardContent className="space-y-2">{auditSummaries.map((item) => <div key={item} className="rounded-lg border border-border bg-surface p-2 text-xs text-fg-muted">{item}</div>)}</CardContent></Card>
        </div>
      </PageBody>
    </>
  );
}


function RolePermissionPreview({ orgId, previewRoleId, onPreviewRoleId }: {
  orgId: string;
  previewRoleId: string;
  onPreviewRoleId: (roleId: string) => void;
}) {
  const rolesQuery = useQuery({ queryKey: ['roles', orgId, 'preview'], queryFn: () => sdk.roles.listRoles(orgId) });
  const catalogQuery = useQuery({ queryKey: ['permissions-catalog', orgId, 'preview'], queryFn: () => sdk.roles.permissionCatalog(orgId) });
  const roles = rolesQuery.data?.roles ?? [];
  const catalog = catalogQuery.data?.catalog ?? [];
  const selectedRole = roles.find((role: any) => role.id === previewRoleId) ?? roles[0];
  const selectedPermissions = new Set<string>((selectedRole as any)?.permissions ?? []);
  const grouped = catalog.reduce<Record<string, any[]>>((acc, item: any) => {
    const category = item.category || 'General';
    acc[category] = acc[category] || [];
    acc[category].push(item);
    return acc;
  }, {});

  useEffect(() => {
    if (!previewRoleId && roles[0]?.id) onPreviewRoleId(roles[0].id);
  }, [onPreviewRoleId, previewRoleId, roles]);

  return (
    <Card className="border-brand/20 bg-brand/5">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><Eye className="h-4 w-4" /> Role / permission preview</CardTitle>
            <CardDescription>
              Safely preview what a teammate can access before you change their role. This view is read-only and does not impersonate or mutate data.
            </CardDescription>
          </div>
          <div className="min-w-[220px]">
            <Label htmlFor="role-preview" className="text-xs">Preview role</Label>
            <select
              id="role-preview"
              value={selectedRole?.id ?? ''}
              onChange={(event) => onPreviewRoleId(event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs text-fg"
            >
              {roles.map((role: any) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rolesQuery.isLoading || catalogQuery.isLoading ? (
          <p className="text-sm text-fg-muted">Loading permission catalog…</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline">{selectedRole?.name ?? 'Role'} preview</Badge>
              <Badge variant="success">{selectedPermissions.size} granted permissions</Badge>
              <Badge variant="outline">No session switch performed</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(grouped).map(([category, permissions]) => {
                const granted = permissions.filter((permission: any) => selectedPermissions.has(permission.id));
                return (
                  <div key={category} className="rounded-xl border border-border bg-surface p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-fg">{category}</h4>
                      <Badge variant={granted.length ? 'success' : 'outline'} className="text-[10px]">{granted.length}/{permissions.length}</Badge>
                    </div>
                    <div className="space-y-1">
                      {permissions.map((permission: any) => {
                        const hasAccess = selectedPermissions.has(permission.id);
                        return (
                          <div key={permission.id} className="flex items-start gap-2 rounded-lg bg-bg px-2 py-1.5 text-xs">
                            <span className={cn('mt-0.5 h-2 w-2 rounded-full', hasAccess ? 'bg-success' : 'bg-fg-subtle')} aria-hidden="true" />
                            <div>
                              <p className={cn('font-semibold', hasAccess ? 'text-fg' : 'text-fg-muted')}>{permission.label ?? permission.id}</p>
                              {permission.description && <p className="text-[10px] text-fg-subtle">{permission.description}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type AdminConfigSection = 'setup' | 'policies' | 'templates' | 'notifications' | 'retention';

function mergeAdminConfig(config?: PartialPlatformConfig) {
  return {
    ...SYSTEM_DEFAULTS.admin,
    ...((config?.admin ?? {}) as any),
    dataRetention: {
      ...SYSTEM_DEFAULTS.admin.dataRetention,
      ...(((config?.admin as any)?.dataRetention) ?? {}),
    },
  };
}

function summarizeAdminDiff(previousConfig: PartialPlatformConfig | undefined, nextAdmin: any): string[] {
  const previousAdmin = mergeAdminConfig(previousConfig);
  const checks: Array<[string, unknown, unknown]> = [
    ['Setup checklist', previousAdmin.setupChecklist, nextAdmin.setupChecklist],
    ['Venue policies', previousAdmin.venuePolicies, nextAdmin.venuePolicies],
    ['Default templates', previousAdmin.defaultTemplates, nextAdmin.defaultTemplates],
    ['Notification preferences', previousAdmin.notificationPreferences, nextAdmin.notificationPreferences],
    ['Data retention', previousAdmin.dataRetention, nextAdmin.dataRetention],
  ];
  return checks
    .filter(([, before, after]) => JSON.stringify(before) !== JSON.stringify(after))
    .map(([label, before, after]) => `${label}: ${JSON.stringify(before).length} bytes → ${JSON.stringify(after).length} bytes`);
}

function AdminConfigurationManager({ orgId, section }: { orgId: string; section: AdminConfigSection }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const configQuery = useQuery({ queryKey: ['platformConfig', orgId, 'admin'], queryFn: () => sdk.platformConfig.getOrg(orgId) });
  const [draft, setDraft] = useState(() => SYSTEM_DEFAULTS.admin);

  useEffect(() => {
    if (configQuery.data?.config) setDraft(mergeAdminConfig(configQuery.data.config) as any);
  }, [configQuery.data?.config]);

  const diffs = summarizeAdminDiff(configQuery.data?.config, draft);
  const isDirty = diffs.length > 0;

  const saveMutation = useMutation({
    mutationFn: () => {
      if (!window.confirm(`Save admin configuration changes?\n\n${diffs.join('\n') || 'No differences detected.'}`)) {
        return Promise.resolve({ config: configQuery.data?.config ?? {} });
      }
      const nextConfig: PartialPlatformConfig = { ...(configQuery.data?.config ?? {}), admin: draft as any };
      return sdk.platformConfig.putOrg(orgId, nextConfig);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platformConfig', orgId] });
      qc.invalidateQueries({ queryKey: ['platformConfig', orgId, 'admin'] });
      toast({ title: 'Admin configuration saved', description: 'Your Platform Studio settings are now active.', variant: 'success' });
    },
    onError: (error: any) => toast({ title: 'Could not save admin configuration', description: error?.message, variant: 'destructive' }),
  });

  const restoreDefaults = () => {
    if (!window.confirm('Restore admin defaults for setup checklist, policies, templates, notifications, and data retention? Review the diff before saving.')) return;
    setDraft(SYSTEM_DEFAULTS.admin);
    toast({ title: 'Defaults restored in draft', description: 'Review the diff and click Save changes to persist.' });
  };

  if (configQuery.isLoading) return <Card><CardContent className="p-6 text-sm text-fg-muted">Loading admin configuration…</CardContent></Card>;

  return (
    <div className="space-y-4">
      <Card className="border-border bg-surface">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">{adminSectionTitle(section)}</CardTitle>
              <CardDescription>{adminSectionDescription(section)}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={restoreDefaults}><RefreshCcw className="h-4 w-4" /> Restore defaults</Button>
              <Button size="sm" disabled={!isDirty || saveMutation.isPending} isLoading={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                Save changes
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {section === 'setup' && <SetupChecklistEditor draft={draft as any} setDraft={setDraft as any} />}
          {section === 'policies' && <VenuePoliciesEditor draft={draft as any} setDraft={setDraft as any} />}
          {section === 'templates' && <DefaultTemplatesEditor draft={draft as any} setDraft={setDraft as any} />}
          {section === 'notifications' && <NotificationPreferencesEditor draft={draft as any} setDraft={setDraft as any} />}
          {section === 'retention' && <DataRetentionEditor draft={draft as any} setDraft={setDraft as any} />}
        </CardContent>
      </Card>

      <Card className="border-dashed border-border bg-bg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm"><AlertCircle className="h-4 w-4" /> Save diff / confirmation</CardTitle>
          <CardDescription>Every save shows a confirmation diff before updating organization configuration.</CardDescription>
        </CardHeader>
        <CardContent>
          {diffs.length ? (
            <ul className="space-y-1 text-xs text-fg-muted">
              {diffs.map((diff) => <li key={diff}>• {diff}</li>)}
            </ul>
          ) : (
            <p className="text-xs text-fg-subtle">No unsaved changes.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function adminSectionTitle(section: AdminConfigSection) {
  return {
    setup: 'Setup checklist manager',
    policies: 'Venue policy / rules manager',
    templates: 'Default templates manager',
    notifications: 'Notification preferences manager',
    retention: 'Data retention settings',
  }[section];
}

function adminSectionDescription(section: AdminConfigSection) {
  return {
    setup: 'Define what owners must complete before they invite clients, vendors, or guests.',
    policies: 'Maintain operational rules in one owner-friendly place so portals, templates, and staff guidance stay aligned.',
    templates: 'Control which starter templates appear for new events and owner onboarding.',
    notifications: 'Set default channels for operational alerts, health drops, reminders, and urgent day-of issues.',
    retention: 'Document privacy and archive defaults before data is purged or hidden from active workspaces.',
  }[section];
}

function SetupChecklistEditor({ draft, setDraft }: { draft: any; setDraft: (value: any) => void }) {
  return <div className="space-y-3">{draft.setupChecklist.map((item: any, index: number) => (
    <div key={item.id} className="rounded-xl border border-border bg-bg p-3">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          <Label className="text-xs">Checklist item</Label>
          <Input value={item.label} onChange={(event) => updateDraftArray(setDraft, 'setupChecklist', index, { label: event.target.value })} />
          <Input value={item.ownerHelp ?? ''} onChange={(event) => updateDraftArray(setDraft, 'setupChecklist', index, { ownerHelp: event.target.value })} placeholder="Owner-friendly help text" />
        </div>
        <label className="flex items-center gap-2 self-end text-xs font-semibold text-fg"><input type="checkbox" checked={item.required} onChange={(event) => updateDraftArray(setDraft, 'setupChecklist', index, { required: event.target.checked })} className="h-4 w-4 accent-brand" /> Required</label>
      </div>
    </div>
  ))}</div>;
}

function VenuePoliciesEditor({ draft, setDraft }: { draft: any; setDraft: (value: any) => void }) {
  return <div className="space-y-3">{draft.venuePolicies.map((policy: any, index: number) => (
    <div key={policy.key} className="rounded-xl border border-border bg-bg p-3">
      <div className="grid gap-3 md:grid-cols-3">
        <div><Label className="text-xs">Policy label</Label><Input value={policy.label} onChange={(event) => updateDraftArray(setDraft, 'venuePolicies', index, { label: event.target.value })} /></div>
        <div className="md:col-span-2"><Label className="text-xs">Owner-facing rule</Label><Input value={policy.value} onChange={(event) => updateDraftArray(setDraft, 'venuePolicies', index, { value: event.target.value })} /></div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-fg"><input type="checkbox" checked={policy.ownerVisible} onChange={(event) => updateDraftArray(setDraft, 'venuePolicies', index, { ownerVisible: event.target.checked })} className="h-4 w-4 accent-brand" /> Show in owner-facing setup guidance</label>
    </div>
  ))}</div>;
}

function DefaultTemplatesEditor({ draft, setDraft }: { draft: any; setDraft: (value: any) => void }) {
  return <div className="grid gap-3 md:grid-cols-2">{draft.defaultTemplates.map((template: any, index: number) => (
    <label key={template.key} className="flex items-start gap-3 rounded-xl border border-border bg-bg p-3">
      <input type="checkbox" checked={template.enabled} onChange={(event) => updateDraftArray(setDraft, 'defaultTemplates', index, { enabled: event.target.checked })} className="mt-1 h-4 w-4 accent-brand" />
      <span><span className="block text-sm font-semibold text-fg">{template.label}</span><span className="text-xs text-fg-subtle">{template.category} template</span></span>
    </label>
  ))}</div>;
}

function NotificationPreferencesEditor({ draft, setDraft }: { draft: any; setDraft: (value: any) => void }) {
  return <div className="grid gap-3 md:grid-cols-2">{draft.notificationPreferences.map((preference: any, index: number) => (
    <div key={preference.channel} className="rounded-xl border border-border bg-bg p-3">
      <div className="mb-2 text-sm font-semibold capitalize text-fg">{preference.channel.replace('_', ' ')}</div>
      <label className="mb-2 flex items-center gap-2 text-xs text-fg"><input type="checkbox" checked={preference.enabled} onChange={(event) => updateDraftArray(setDraft, 'notificationPreferences', index, { enabled: event.target.checked })} className="h-4 w-4 accent-brand" /> Enabled</label>
      <label className="flex items-center gap-2 text-xs text-fg"><input type="checkbox" checked={preference.criticalOnly} onChange={(event) => updateDraftArray(setDraft, 'notificationPreferences', index, { criticalOnly: event.target.checked })} className="h-4 w-4 accent-brand" /> Critical alerts only</label>
    </div>
  ))}</div>;
}

function DataRetentionEditor({ draft, setDraft }: { draft: any; setDraft: (value: any) => void }) {
  const retention = draft.dataRetention;
  const update = (patch: Record<string, unknown>) => setDraft((current: any) => ({ ...current, dataRetention: { ...current.dataRetention, ...patch } }));
  return <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-3">
      <div><Label className="text-xs">Event archive (months)</Label><Input type="number" value={retention.eventArchiveMonths} onChange={(event) => update({ eventArchiveMonths: Number(event.target.value) || 1 })} /></div>
      <div><Label className="text-xs">Guest portal data (months)</Label><Input type="number" value={retention.guestPortalDataMonths} onChange={(event) => update({ guestPortalDataMonths: Number(event.target.value) || 1 })} /></div>
      <div><Label className="text-xs">Audit log (months)</Label><Input type="number" value={retention.auditLogMonths} onChange={(event) => update({ auditLogMonths: Number(event.target.value) || 1 })} /></div>
    </div>
    <label className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm font-semibold text-fg"><input type="checkbox" checked={retention.autoDeleteInactiveLeads} onChange={(event) => update({ autoDeleteInactiveLeads: event.target.checked })} className="h-4 w-4 accent-brand" /> Automatically delete inactive leads after retention window</label>
  </div>;
}

function updateDraftArray(setDraft: (value: any) => void, key: string, index: number, patch: Record<string, unknown>) {
  setDraft((current: any) => ({
    ...current,
    [key]: current[key].map((item: any, itemIndex: number) => itemIndex === index ? { ...item, ...patch } : item),
  }));
}

function SystemHealthDashboard({ orgId }: { orgId: string }) {
  const rolesQuery = useQuery({ queryKey: ['roles', orgId, 'health'], queryFn: () => sdk.roles.listRoles(orgId) });
  const configQuery = useQuery({ queryKey: ['platformConfig', orgId, 'health'], queryFn: () => sdk.platformConfig.getOrg(orgId) });
  const adminConfig = mergeAdminConfig(configQuery.data?.config);
  const checks = [
    { label: 'Configuration storage', ok: !configQuery.isError, detail: configQuery.isLoading ? 'Checking organization config…' : 'Org Platform Studio config is reachable.' },
    { label: 'Role catalog', ok: !rolesQuery.isError && (rolesQuery.data?.roles?.length ?? 0) > 0, detail: `${rolesQuery.data?.roles?.length ?? 0} roles available for preview and assignment.` },
    { label: 'Critical notification path', ok: adminConfig.notificationPreferences.some((pref: any) => pref.enabled && pref.criticalOnly), detail: 'At least one channel should carry critical-only alerts for health drops.' },
    { label: 'Owner setup requirements', ok: adminConfig.setupChecklist.some((item: any) => item.required), detail: `${adminConfig.setupChecklist.filter((item: any) => item.required).length} required setup steps configured.` },
    { label: 'Data retention policy', ok: adminConfig.dataRetention.auditLogMonths >= 12, detail: `${adminConfig.dataRetention.auditLogMonths} months audit log retention configured.` },
  ];
  const healthy = checks.filter((check) => check.ok).length;

  return (
    <div className="space-y-4 max-w-5xl">
      <Card className="border-border bg-surface">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" /> System health dashboard</CardTitle>
          <CardDescription>Owner-friendly health checks for integrations, configuration, permissions, and retention readiness.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-bg p-4"><p className="text-xs text-fg-subtle">Checks passing</p><p className="text-2xl font-black text-fg">{healthy}/{checks.length}</p></div>
            <div className="rounded-xl border border-border bg-bg p-4"><p className="text-xs text-fg-subtle">Integration status</p><p className="text-2xl font-black text-fg">{healthy === checks.length ? 'Ready' : 'Review'}</p></div>
            <div className="rounded-xl border border-border bg-bg p-4"><p className="text-xs text-fg-subtle">Last checked</p><p className="text-sm font-semibold text-fg">{new Date().toLocaleString()}</p></div>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {checks.map((check) => (
          <Card key={check.label} className={cn('border-border bg-surface', check.ok ? 'border-success/30' : 'border-warning/30')}>
            <CardContent className="flex items-start gap-3 p-4">
              <span className={cn('mt-1 h-3 w-3 rounded-full', check.ok ? 'bg-success' : 'bg-warning')} aria-hidden="true" />
              <div><h3 className="font-semibold text-fg">{check.label}</h3><p className="text-sm text-fg-muted">{check.detail}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── 4. Layout Approval Submission Queue (The User-Requested Step 4) ─────────
function LayoutApprovalQueue({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});

  // Fetch all layouts in organization
  const { data: layoutsData, isLoading } = useQuery({
    queryKey: ['all-layouts-approvals', orgId],
    queryFn: () => sdk.layouts.list(orgId),
  });

  const layouts = layoutsData?.layouts || [];
  // Filter for real layouts associated with events
  const approvalLayouts = layouts.filter(l => l.event_id && !l.is_template);

  const pendingLayouts = approvalLayouts.filter(l => l.approval_status === 'pending');

  const reviewMutation = useMutation({
    mutationFn: ({ id, payload, status, comment }: { id: string; payload: any; status: string; comment?: string }) =>
      sdk.layouts.save(id, payload, { approvalStatus: status, changeDescription: comment }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-layouts-approvals', orgId] });
      toast({ title: 'Layout reviewed successfully', variant: 'success' });
    },
    onError: () => {
      toast({ title: 'Could not submit review', variant: 'destructive' });
    }
  });

  if (isLoading) return <div className="p-8 text-center text-fg-subtle">Analyzing layout approvals...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-center pb-2 border-b border-border/60">
        <div>
          <h3 className="text-sm font-bold text-fg uppercase tracking-wider">Layout Submissions Queue</h3>
          <p className="text-xs text-fg-subtle">Review, approve, or request layout changes submitted by planners and couples.</p>
        </div>
        <Badge variant={pendingLayouts.length > 0 ? 'warning' : 'outline'} className="text-xs tracking-wider font-bold">
          {pendingLayouts.length} Pending Approvals
        </Badge>
      </div>

      <div className="space-y-4">
        {approvalLayouts.length === 0 ? (
          <div className="text-center text-xs text-fg-subtle py-12 border border-dashed rounded-xl bg-surface">
            No layout submissions logged yet.
          </div>
        ) : (
          approvalLayouts.map((l: any) => {
            const payload = typeof l.payload === 'string' ? JSON.parse(l.payload) : (l.payload || {});
            const items = Array.isArray(payload.items) ? payload.items : [];
            const itemsCount = items.length;
            const tablesCount = items.filter((i: any) => i.type?.includes('table')).length;
            const chairsCount = items.filter((i: any) => i.type === 'chair').length;
            const wallsCount = items.filter((i: any) => i.type === 'custom_wall').length;
            const decorCount = items.filter((i: any) => i.type === 'decor').length;
            const currentComment = reviewComments[l.id] || '';

            return (
              <div key={l.id} className="bg-surface p-5 rounded-xl border border-border shadow-sm flex flex-col md:flex-row gap-5 items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-serif font-bold text-fg text-sm sm:text-base">{l.name || 'Structural Layout'}</span>
                    <Badge variant={l.approval_status === 'approved' ? 'success' : l.approval_status === 'pending' ? 'warning' : 'outline'} className="text-[10px] uppercase font-bold tracking-tight">
                      {l.approval_status || 'draft'}
                    </Badge>
                  </div>
                  <div className="text-xs text-fg-subtle space-y-1.5 font-semibold">
                    <p>Revision: <strong className="text-fg">{l.revision}</strong> · Total: <strong className="text-fg">{itemsCount} items on stage</strong></p>
                    <div className="flex flex-wrap gap-2 text-[10px] text-fg-muted uppercase pt-1">
                       <span className="bg-bg px-2 py-0.5 rounded border border-border shadow-xs">⭕ {tablesCount} Tables</span>
                       <span className="bg-bg px-2 py-0.5 rounded border border-border shadow-xs">🪑 {chairsCount} Seats</span>
                       <span className="bg-bg px-2 py-0.5 rounded border border-border shadow-xs">🧱 {wallsCount} Node Walls</span>
                       <span className="bg-bg px-2 py-0.5 rounded border border-border shadow-xs">🌸 {decorCount} Florals</span>
                    </div>
                    <p className="text-[10px] pt-1">Last modified: {new Date(l.updated_at).toLocaleString()}</p>
                  </div>

                  <div className="pt-2">
                    <input
                      type="text"
                      placeholder="Add review comment or changes requested..."
                      value={currentComment}
                      onChange={(e) => setReviewComments({ ...reviewComments, [l.id]: e.target.value })}
                      className="w-full text-xs px-3 py-2 bg-bg border border-border rounded-lg outline-none focus:border-brand/40 font-semibold"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 self-end md:self-auto shrink-0">
                  <Button
                    size="xs"
                    className="bg-success hover:bg-success/90 text-brand-fg font-bold"
                    onClick={() => reviewMutation.mutate({ id: l.id, payload, status: 'approved', comment: currentComment })}
                  >
                    Approve Layout
                  </Button>
                  <Button
                    size="xs"
                    className="bg-brand/10 border border-brand/20 text-brand font-bold"
                    onClick={() => reviewMutation.mutate({ id: l.id, payload, status: 'draft', comment: currentComment })}
                  >
                    Request Changes
                  </Button>
                  <Button
                    size="xs"
                    variant="destructive"
                    className="font-bold text-xs"
                    onClick={() => reviewMutation.mutate({ id: l.id, payload, status: 'rejected', comment: currentComment })}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Backup Snapshot Archiver ────────────────────────────────────────────────
function BackupManager({ orgId }: { orgId: string }) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const handleExport = async () => {
    setDownloading(true);
    toast({ title: 'Preparing Backup', description: 'Downloading your organization data...' });
    try {
      const token = getToken();
      const response = await fetch(`/api/orgs/${orgId}/export/backup.json`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error('backup-export-failed');
      const url = URL.createObjectURL(await response.blob()); const link = document.createElement('a');
      link.href = url; link.download = `backup_${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(url);
      toast({ title: 'Backup Downloaded', variant: 'success' });
    } catch { toast({ title: 'Backup export failed', description: 'Please verify your access and try again.', variant: 'destructive' }); }
    finally { setDownloading(false); }
  };

  const handleImport = () => {
    toast({ title: 'Import restricted', description: 'Contact system administrator to restore from snapshot.', variant: 'destructive' });
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-brand-soft/30 border border-brand/20 p-5 rounded-xl flex items-start gap-4">
        <Server className="w-6 h-6 text-brand shrink-0 mt-1" />
        <div>
           <h3 className="font-semibold text-fg font-serif">Database Snapshots</h3>
           <p className="text-xs text-fg-muted mt-1 leading-relaxed">
             Full operational data including Guests, Layouts, Configurations, and Chat threads are stored in isolated encrypted tenants. You can request a physical local backup of your environment for archival purposes.
           </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-6">
        <Card className="bg-surface border-border/80">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Download className="w-4 h-4 text-brand"/> Export Data</CardTitle>
            <CardDescription className="text-xs text-fg-subtle">Download a complete JSON backup of all events, guests, vendors, and budget data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled={downloading} onClick={handleExport}>
               {downloading ? 'Generating...' : 'Download Snapshot'}
            </Button>
            <p className="text-[10px] text-center text-fg-subtle mt-3">Includes events, guests, vendors, budget, timeline, and platform configuration data.</p>
          </CardContent>
        </Card>

        <Card className="border-danger/20 bg-surface">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-danger"><Upload className="w-4 h-4"/> Restore Backup</CardTitle>
            <CardDescription className="text-xs text-fg-subtle">Restore is restricted and requires an administrator-reviewed maintenance window.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" className="w-full" onClick={handleImport}>
               Upload & Restore
            </Button>
            <p className="text-[10px] text-center text-danger/70 mt-3 font-semibold">Destructive restore is disabled in self-service mode.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed border-border bg-bg">
        <CardHeader>
          <CardTitle className="text-base">Backup / restore runbook</CardTitle>
          <CardDescription className="text-xs text-fg-subtle">Use this documentation before exporting data or requesting a restore.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-xs text-fg-muted md:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-3">
            <h4 className="mb-1 font-bold text-fg">1. Export</h4>
            <p>Download the JSON snapshot before major configuration changes, imports, or end-of-season archival work.</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <h4 className="mb-1 font-bold text-fg">2. Validate</h4>
            <p>Store the file securely, verify the date, and document who requested the backup for audit purposes.</p>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <h4 className="mb-1 font-bold text-fg">3. Restore</h4>
            <p>Contact an administrator. Restores should be tested, scheduled, and confirmed because active records may be overwritten.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── 5. Spacing Safety & Capacity Calculator ───
export function SpacingSafetyCalculator() {
  // Inputs
  const [roomWidth, setRoomWidth] = useState(60);
  const [roomHeight, setRoomHeight] = useState(40);
  const [tableShape, setTableShape] = useState<'round' | 'rect'>('round');
  const [tableSizeInches, setTableSizeInches] = useState(60); // 60" round or 60" length
  const [capacityPerTable, setCapacityPerTable] = useState(8);
  const [corridorBuffer, setCorridorBuffer] = useState(5); // 5ft ADA / 6ft fire exit

  // Derived calculations
  const totalArea = roomWidth * roomHeight;
  
  // Standard fire code: 15 sq ft per person in a banquet/dining seating setup
  const fireOccupancyLimit = Math.floor(totalArea / 15);

  const calculations = useMemo(() => {
    // Usable width and length after corridor buffers on all sides
    const usableWidth = Math.max(0, roomWidth - (2 * corridorBuffer));
    const usableHeight = Math.max(0, roomHeight - (2 * corridorBuffer));

    // Footprint diameter in feet
    const tableSizeFeet = tableSizeInches / 12;
    
    // Seating extends 2.5ft around table, plus 1.5ft half-clearance between adjacent tables (total 4ft clearance spacing)
    const tableSpacingUnit = tableSizeFeet + 4.0;

    const cols = Math.floor(usableWidth / tableSpacingUnit);
    const rows = Math.floor(usableHeight / tableSpacingUnit);
    const maxTables = Math.max(0, cols * rows);
    const safeSeatingCapacity = maxTables * capacityPerTable;

    // Safety Standing Score
    const safetyScore = Math.max(0, Math.min(100, Math.round((1 - (safeSeatingCapacity > fireOccupancyLimit ? (safeSeatingCapacity - fireOccupancyLimit)/fireOccupancyLimit : 0)) * 100)));

    return {
      usableWidth,
      usableHeight,
      maxTables,
      safeSeatingCapacity,
      safetyScore
    };
  }, [roomWidth, roomHeight, tableShape, tableSizeInches, capacityPerTable, corridorBuffer, fireOccupancyLimit]);

  return (
    <div className="space-y-6 max-w-4xl animate-in fade-in duration-200">
      <div className="flex justify-between items-center pb-2 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-fg uppercase tracking-wider">Spacing Safety &amp; Capacity Calculator</h3>
          <p className="text-xs text-fg-subtle">Audit floorplan safety thresholds, ADA clearance buffers, and theoretical max occupancy limits.</p>
        </div>
        <Badge variant={calculations.safeSeatingCapacity > fireOccupancyLimit ? 'danger' : 'success'} className="text-xs tracking-wider font-bold">
          {calculations.safeSeatingCapacity > fireOccupancyLimit ? '🚨 High Risk Layout' : '🛡️ Verified Safe'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Input Form */}
        <div className="lg:col-span-1 bg-surface p-5 rounded-2xl border border-border space-y-4 font-semibold text-xs text-fg">
          <h4 className="text-xs font-bold text-fg uppercase tracking-wider font-serif border-b pb-1.5 flex items-center gap-1.5 text-brand">
             📐 Room Dimensions
          </h4>

          <div className="grid grid-cols-2 gap-3">
             <div>
                <Label className="text-[10px]">Room Width (ft)</Label>
                <Input type="number" value={roomWidth} onChange={e => setRoomWidth(parseInt(e.target.value) || 0)} className="h-9 mt-1 text-xs" />
             </div>
             <div>
                <Label className="text-[10px]">Room Length (ft)</Label>
                <Input type="number" value={roomHeight} onChange={e => setRoomHeight(parseInt(e.target.value) || 0)} className="h-9 mt-1 text-xs" />
             </div>
          </div>

          <h4 className="text-xs font-bold text-fg uppercase tracking-wider font-serif border-b pb-1.5 pt-2 flex items-center gap-1.5 text-brand">
             ⭕ Seating specs
          </h4>

          <div className="space-y-3">
             <div>
                <Label className="text-[10px]">Table Format</Label>
                <select 
                   value={tableShape} 
                   onChange={e => setTableShape(e.target.value as any)}
                   className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
                >
                   <option value="round">Round Banquet Table</option>
                   <option value="rect">Rectangular Banquet Table</option>
                </select>
             </div>

             <div className="grid grid-cols-2 gap-3">
                <div>
                   <Label className="text-[10px]">Size (inches)</Label>
                   <Input type="number" value={tableSizeInches} onChange={e => setTableSizeInches(parseInt(e.target.value) || 0)} className="h-9 mt-1 text-xs" />
                </div>
                <div>
                   <Label className="text-[10px]">Seats per Table</Label>
                   <Input type="number" value={capacityPerTable} onChange={e => setCapacityPerTable(parseInt(e.target.value) || 0)} className="h-9 mt-1 text-xs" />
                </div>
             </div>
          </div>

          <h4 className="text-xs font-bold text-fg uppercase tracking-wider font-serif border-b pb-1.5 pt-2 flex items-center gap-1.5 text-brand">
             🚒 Fire &amp; ADA Clearance
          </h4>

          <div>
             <Label className="text-[10px]">Corridor Safety Buffer (ft)</Label>
             <select 
                value={corridorBuffer} 
                onChange={e => setCorridorBuffer(parseInt(e.target.value))}
                className="h-9 w-full rounded-lg border border-border bg-surface px-2 text-xs mt-1"
             >
                <option value={3}>3 ft (Snug standard)</option>
                <option value={5}>5 ft (ADA compliant corridor)</option>
                <option value={6}>6 ft (Critical fire exit escape)</option>
             </select>
             <p className="text-[9px] text-fg-subtle font-normal mt-1">Defines clear perimeter space required around walls.</p>
          </div>
        </div>

        {/* Right Column: Calculations & Analysis Charts */}
        <div className="lg:col-span-2 space-y-4">
           
           {/* KPI Stats cards */}
           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="bg-surface border-border">
                 <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-[10px] uppercase font-bold text-fg-subtle">Total Usable Area</CardTitle>
                 </CardHeader>
                 <CardContent className="p-3 pt-0">
                    <div className="text-xl font-black text-fg">{totalArea.toLocaleString()} <span className="text-xs font-normal">sq. ft.</span></div>
                 </CardContent>
              </Card>

              <Card className="bg-surface border-border">
                 <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-[10px] uppercase font-bold text-fg-subtle">Theoretical Max Tables</CardTitle>
                 </CardHeader>
                 <CardContent className="p-3 pt-0">
                    <div className="text-xl font-black text-brand">{calculations.maxTables} <span className="text-xs font-normal">Tables</span></div>
                 </CardContent>
              </Card>

              <Card className="bg-surface border-border">
                 <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-[10px] uppercase font-bold text-fg-subtle">Fire Code Occupancy Limit</CardTitle>
                 </CardHeader>
                 <CardContent className="p-3 pt-0">
                    <div className="text-xl font-black text-fg">{fireOccupancyLimit} <span className="text-xs font-normal">guests</span></div>
                 </CardContent>
              </Card>
           </div>

           {/* Safety scoring card */}
           <Card className={cn("border bg-surface shadow-sm", calculations.safeSeatingCapacity > fireOccupancyLimit ? "border-danger/30" : "border-success/30")}>
              <CardContent className="p-5 flex flex-col sm:flex-row gap-5 items-center justify-between">
                 <div className="space-y-1.5 flex-1 text-center sm:text-left">
                    <div className="text-[10px] uppercase font-bold text-fg-subtle">Calculated Seating Capacity</div>
                    <div className="text-3xl font-black text-fg flex items-baseline justify-center sm:justify-start gap-1">
                       {calculations.safeSeatingCapacity} <span className="text-sm font-normal text-fg-subtle">guests max capacity</span>
                    </div>
                    <p className="text-xs text-fg-subtle leading-relaxed">
                       {calculations.safeSeatingCapacity > fireOccupancyLimit ? (
                         <span className="text-danger font-bold">⚠️ OVER FIRE CODE CAPACITY! Setting up {calculations.maxTables} tables exceeds the standard {fireOccupancyLimit} guest dining fire safety threshold. Raise safety buffers or decrease table counts.</span>
                       ) : (
                         <span className="text-success font-bold">✓ SAFE SEATING CODE: Your floorplan layout remains well within fire regulations ({fireOccupancyLimit} guests) and preserves ADA clearance corridor guidelines.</span>
                       )}
                    </p>
                 </div>
                 <div className="shrink-0 flex flex-col items-center justify-center p-4 rounded-full border border-border bg-bg h-24 w-24">
                    <span className="text-xs font-bold text-fg-subtle uppercase">Safety Score</span>
                    <span className={cn("text-2xl font-black mt-0.5", calculations.safetyScore === 100 ? "text-success" : calculations.safetyScore >= 70 ? "text-warning" : "text-danger")}>
                       {calculations.safetyScore}%
                    </span>
                 </div>
              </CardContent>
           </Card>

           {/* Visual comparison progress bar */}
           <Card className="bg-surface border-border p-5 space-y-4">
              <h4 className="text-xs font-bold text-fg uppercase tracking-wider font-serif">Capacity Analysis Visualizer</h4>
              
              <div className="space-y-3">
                 <div>
                    <div className="flex justify-between items-center text-xs font-bold text-fg mb-1">
                       <span>Safe Seating Capacity</span>
                       <span>{calculations.safeSeatingCapacity} guests</span>
                    </div>
                    <div className="h-3.5 w-full bg-surface-2 rounded-full overflow-hidden border border-border p-0.5">
                       <div className={cn("h-full rounded-full transition-all duration-300", calculations.safeSeatingCapacity > fireOccupancyLimit ? "bg-danger" : "bg-brand")} style={{ width: `${Math.min(100, (calculations.safeSeatingCapacity / fireOccupancyLimit) * 100)}%` }}></div>
                    </div>
                 </div>

                 <div>
                    <div className="flex justify-between items-center text-xs font-bold text-fg mb-1">
                       <span>Local Fire Occupancy limit</span>
                       <span>{fireOccupancyLimit} guests limit</span>
                    </div>
                    <div className="h-3.5 w-full bg-surface-2 rounded-full overflow-hidden border border-border p-0.5">
                       <div className="h-full rounded-full bg-success transition-all duration-300" style={{ width: '100%' }}></div>
                    </div>
                 </div>
              </div>
           </Card>

           {/* Operations Advice */}
           <div className="rounded-xl bg-brand/5 border border-brand/20 p-4 flex gap-3 text-xs">
              <span className="text-xl">💡</span>
              <div className="space-y-1 text-fg-muted leading-relaxed font-semibold">
                 <h5 className="font-bold text-brand">Eleanor's Spacing Intelligence Guide:</h5>
                 <p>1. Local safety rules require a minimum of **3 feet** of clearance behind seated guests for comfortable passage.</p>
                 <p>2. ADA regulations mandate at least **5 feet** of unobstructed path clearance on primary corridor walkways.</p>
                 <p>3. If using round tables, diagonal staggered rows (Hexagonal layout) save up to **12% more usable area** than simple grid alignments.</p>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
