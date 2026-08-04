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
import { usePermission } from '../../../lib/usePermission';
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
  const currentUserQuery = useQuery({ queryKey: ['me', 'admin-panel-role'], queryFn: () => sdk.auth.me(), staleTime: 60_000 });
  // PA-01: the FULL platform studio belongs to owner/admin (platform.manage).
  // Managers (and any role without it) get the read-only configuration viewer.
  const managerMode = !usePermission('platform.manage');
  // PA-04: only the venue owner may approve change requests.
  const isOwner = usePermission('org.manage');

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

          <OwnerChangeRequestQueue orgId={orgId} canDecide={isOwner} />

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




// Decomposed panels (see adminPanels.tsx).
import { ManagerConfigurationViewer, RolePermissionPreview, AdminConfigurationManager, SetupChecklistEditor, VenuePoliciesEditor, DefaultTemplatesEditor, NotificationPreferencesEditor, DataRetentionEditor, SystemHealthDashboard, LayoutApprovalQueue, OwnerChangeRequestQueue, BackupManager } from './adminPanels';

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

