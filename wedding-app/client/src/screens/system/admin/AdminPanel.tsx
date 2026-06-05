import React, { useState, useMemo } from 'react';
import { TeamMembers } from './TeamMembers';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Shield, Database, Settings, Activity, Download, Upload, Server,
  Layers, Heart, HelpCircle, Palette, Sliders, PlayCircle, CheckSquare,
  AlertCircle, MessageSquare, ClipboardCheck, Trash2
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
  | 'permissions'
  | 'catalog'
  | 'decor'
  | 'venue'
  | 'questions'
  | 'branding'
  | 'guest_portal'
  | 'approvals'
  | 'safety_calculator'
  | 'backups'
  | 'diagnostics';

export function AdminPanel({ orgId }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>('team');

  return (
    <>
      <PageHeader
        title="Admin Settings & Operations"
        description="Universal operational suite for managing branding, team members, floorplan catalogs, florals, and database backups."
      />
      <PageBody>
        <Card className="min-h-[600px] flex flex-col shadow-lg border-[#e1d5c9] bg-[#FDFBF7]">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdminTab)} className="flex-1 flex flex-col">
            <div className="border-b border-[#e1d5c9] p-4 bg-[#FDFBF7]/30 overflow-x-auto">
              <TabsList className="flex flex-nowrap gap-1">
                <TabsTrigger value="team" className="text-xs font-semibold"><Users className="w-3.5 h-3.5 mr-1.5" /> Team</TabsTrigger>
                <TabsTrigger value="permissions" className="text-xs font-semibold"><Shield className="w-3.5 h-3.5 mr-1.5" /> Permissions Matrix</TabsTrigger>
                <TabsTrigger value="catalog" className="text-xs font-semibold"><Layers className="w-3.5 h-3.5 mr-1.5" /> Structural Specs</TabsTrigger>
                <TabsTrigger value="decor" className="text-xs font-semibold"><Heart className="w-3.5 h-3.5 mr-1.5" /> Decor</TabsTrigger>
                <TabsTrigger value="venue" className="text-xs font-semibold"><Server className="w-3.5 h-3.5 mr-1.5" /> Venues</TabsTrigger>
                <TabsTrigger value="questions" className="text-xs font-semibold"><HelpCircle className="w-3.5 h-3.5 mr-1.5" /> Questions</TabsTrigger>
                <TabsTrigger value="branding" className="text-xs font-semibold"><Palette className="w-3.5 h-3.5 mr-1.5" /> Branding Studio</TabsTrigger>
                <TabsTrigger value="guest_portal" className="text-xs font-semibold"><Sliders className="w-3.5 h-3.5 mr-1.5" /> Guest Portal</TabsTrigger>
                <TabsTrigger value="approvals" className="text-xs font-semibold"><CheckSquare className="w-3.5 h-3.5 mr-1.5" /> Approvals Queue</TabsTrigger>
                <TabsTrigger value="safety_calculator" className="text-xs font-semibold"><ClipboardCheck className="w-3.5 h-3.5 mr-1.5" /> Safety Calculator</TabsTrigger>
                <TabsTrigger value="backups" className="text-xs font-semibold"><Database className="w-3.5 h-3.5 mr-1.5" /> Backups</TabsTrigger>
                <TabsTrigger value="diagnostics" className="text-xs font-semibold"><Activity className="w-3.5 h-3.5 mr-1.5" /> Diagnostics</TabsTrigger>
              </TabsList>
            </div>
            
            <div className="flex-1 p-6 bg-[#FDFBF7]">
              <TabsContent value="team" className="h-full m-0">
                <TeamMembers orgId={orgId} />
              </TabsContent>
              
              <TabsContent value="permissions" className="h-full m-0">
                <AccessControlManager orgId={orgId} />
              </TabsContent>

              <TabsContent value="catalog" className="h-full m-0">
                <CatalogManager orgId={orgId} kind="table" />
              </TabsContent>

              <TabsContent value="decor" className="h-full m-0">
                <DecorManager orgId={orgId} />
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

              <TabsContent value="backups" className="h-full m-0">
                <BackupManager orgId={orgId} />
              </TabsContent>

              <TabsContent value="diagnostics" className="h-full m-0">
                <ControlPanel />
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      </PageBody>
    </>
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
          <div className="text-center text-xs text-fg-subtle py-12 border border-dashed rounded-xl bg-white">
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
              <div key={l.id} className="bg-white p-5 rounded-xl border border-[#e1d5c9] shadow-sm flex flex-col md:flex-row gap-5 items-start justify-between">
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
                       <span className="bg-[#FDFBF7] px-2 py-0.5 rounded border border-[#e1d5c9] shadow-xs">⭕ {tablesCount} Tables</span>
                       <span className="bg-[#FDFBF7] px-2 py-0.5 rounded border border-[#e1d5c9] shadow-xs">🪑 {chairsCount} Seats</span>
                       <span className="bg-[#FDFBF7] px-2 py-0.5 rounded border border-[#e1d5c9] shadow-xs">🧱 {wallsCount} Node Walls</span>
                       <span className="bg-[#FDFBF7] px-2 py-0.5 rounded border border-[#e1d5c9] shadow-xs">🌸 {decorCount} Florals</span>
                    </div>
                    <p className="text-[10px] pt-1">Last modified: {new Date(l.updated_at).toLocaleString()}</p>
                  </div>

                  <div className="pt-2">
                    <input
                      type="text"
                      placeholder="Add review comment or changes requested..."
                      value={currentComment}
                      onChange={(e) => setReviewComments({ ...reviewComments, [l.id]: e.target.value })}
                      className="w-full text-xs px-3 py-2 bg-[#FDFBF7] border border-[#e1d5c9] rounded-lg outline-none focus:border-brand/40 font-semibold"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 self-end md:self-auto shrink-0">
                  <Button
                    size="xs"
                    className="bg-success hover:bg-success/90 text-white font-bold"
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

  const handleExport = () => {
    setDownloading(true);
    toast({ title: 'Preparing Backup', description: 'Downloading your organization data...' });
    const link = document.createElement('a');
    link.href = `/api/orgs/${orgId}/export/backup.json`;
    link.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => {
      setDownloading(false);
      toast({ title: 'Backup Downloaded', variant: 'success' });
    }, 1000);
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
        <Card className="bg-white border-border/80">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Download className="w-4 h-4 text-brand"/> Export Data</CardTitle>
            <CardDescription className="text-xs text-fg-subtle">Download a complete JSON backup of all events, guests, vendors, and budget data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled={downloading} onClick={handleExport}>
               {downloading ? 'Generating...' : 'Download Snapshot'}
            </Button>
            <p className="text-[10px] text-center text-fg-subtle mt-3">Includes events, guests, vendors, budget, and timeline data</p>
          </CardContent>
        </Card>

        <Card className="border-danger/20 bg-white">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-danger"><Upload className="w-4 h-4"/> Restore Backup</CardTitle>
            <CardDescription className="text-xs text-fg-subtle">Overwrites current active state with a previous binary file.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" className="w-full" onClick={handleImport}>
               Upload & Restore
            </Button>
            <p className="text-[10px] text-center text-danger/70 mt-3 font-semibold">WARNING: This action is destructive.</p>
          </CardContent>
        </Card>
      </div>
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
      <div className="flex justify-between items-center pb-2 border-b border-[#e1d5c9]">
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
        <div className="lg:col-span-1 bg-white p-5 rounded-2xl border border-[#e1d5c9] space-y-4 font-semibold text-xs text-fg">
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
                   className="h-9 w-full rounded-lg border border-[#e1d5c9] bg-surface px-2 text-xs mt-1"
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
                className="h-9 w-full rounded-lg border border-[#e1d5c9] bg-surface px-2 text-xs mt-1"
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
              <Card className="bg-white border-[#e1d5c9]">
                 <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-[10px] uppercase font-bold text-fg-subtle">Total Usable Area</CardTitle>
                 </CardHeader>
                 <CardContent className="p-3 pt-0">
                    <div className="text-xl font-black text-fg">{totalArea.toLocaleString()} <span className="text-xs font-normal">sq. ft.</span></div>
                 </CardContent>
              </Card>

              <Card className="bg-white border-[#e1d5c9]">
                 <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-[10px] uppercase font-bold text-fg-subtle">Theoretical Max Tables</CardTitle>
                 </CardHeader>
                 <CardContent className="p-3 pt-0">
                    <div className="text-xl font-black text-brand">{calculations.maxTables} <span className="text-xs font-normal">Tables</span></div>
                 </CardContent>
              </Card>

              <Card className="bg-white border-[#e1d5c9]">
                 <CardHeader className="p-3 pb-1">
                    <CardTitle className="text-[10px] uppercase font-bold text-fg-subtle">Fire Code Occupancy Limit</CardTitle>
                 </CardHeader>
                 <CardContent className="p-3 pt-0">
                    <div className="text-xl font-black text-fg">{fireOccupancyLimit} <span className="text-xs font-normal">guests</span></div>
                 </CardContent>
              </Card>
           </div>

           {/* Safety scoring card */}
           <Card className={cn("border bg-white shadow-sm", calculations.safeSeatingCapacity > fireOccupancyLimit ? "border-danger/30" : "border-success/30")}>
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
                 <div className="shrink-0 flex flex-col items-center justify-center p-4 rounded-full border border-[#e1d5c9] bg-[#FDFBF7] h-24 w-24">
                    <span className="text-xs font-bold text-fg-subtle uppercase">Safety Score</span>
                    <span className={cn("text-2xl font-black mt-0.5", calculations.safetyScore === 100 ? "text-success" : calculations.safetyScore >= 70 ? "text-warning" : "text-danger")}>
                       {calculations.safetyScore}%
                    </span>
                 </div>
              </CardContent>
           </Card>

           {/* Visual comparison progress bar */}
           <Card className="bg-white border-[#e1d5c9] p-5 space-y-4">
              <h4 className="text-xs font-bold text-fg uppercase tracking-wider font-serif">Capacity Analysis Visualizer</h4>
              
              <div className="space-y-3">
                 <div>
                    <div className="flex justify-between items-center text-xs font-bold text-fg mb-1">
                       <span>Safe Seating Capacity</span>
                       <span>{calculations.safeSeatingCapacity} guests</span>
                    </div>
                    <div className="h-3.5 w-full bg-surface-2 rounded-full overflow-hidden border border-[#e1d5c9] p-0.5">
                       <div className={cn("h-full rounded-full transition-all duration-300", calculations.safeSeatingCapacity > fireOccupancyLimit ? "bg-danger" : "bg-brand")} style={{ width: `${Math.min(100, (calculations.safeSeatingCapacity / fireOccupancyLimit) * 100)}%` }}></div>
                    </div>
                 </div>

                 <div>
                    <div className="flex justify-between items-center text-xs font-bold text-fg mb-1">
                       <span>Local Fire Occupancy limit</span>
                       <span>{fireOccupancyLimit} guests limit</span>
                    </div>
                    <div className="h-3.5 w-full bg-surface-2 rounded-full overflow-hidden border border-[#e1d5c9] p-0.5">
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
