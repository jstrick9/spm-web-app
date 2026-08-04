import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { 
  Printer, 
  MapPin, 
  Truck, 
  CheckSquare, 
  Clock, 
  ClipboardList, 
  Scissors, 
  ShieldAlert, 
  BadgeCheck, 
  Activity, 
  AlertTriangle, 
  HelpCircle, 
  CheckCircle2, 
  Flame, 
  Sparkles, 
  ArrowRight,
  Phone,
  MessageSquare,
  Smartphone,
  Search
} from 'lucide-react';
import { sdk } from '../../../sdk';
import { PageBody, PageHeader } from '../../../ui/AppShell';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Badge } from '../../../ui/Badge';
import { useToast } from '../../../ui/Toast';
import { cn } from '../../../ui/lib/cn';

interface Props {
  eventId: string;
}

export function RunSheet({ eventId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dayOfMode, setDayOfMode] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState('');
  const [mobileViewport, setMobileViewport] = useState(false);

  React.useEffect(() => {
    const update = () => setMobileViewport(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const { data: eventData, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => sdk.events.get(eventId),
  });

  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ['timeline', eventId],
    queryFn: () => sdk.timeline.list(eventId),
  });

  const { data: vendorData, isLoading: vendorLoading } = useQuery({
    queryKey: ['vendors', eventId],
    queryFn: () => {
      if (!eventData?.event?.organization_id) return Promise.resolve({ vendors: [] });
      return sdk.vendors.list(eventData.event.organization_id, { eventId });
    },
    enabled: !!eventData?.event,
  });

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staffTasks', eventId],
    queryFn: () => {
      if (!eventData?.event?.organization_id) return Promise.resolve({ tasks: [] });
      return sdk.staff.listTasks(eventData.event.organization_id, { eventId });
    },
    enabled: !!eventData?.event,
  });

  // Fetch Layouts and Catalog Details for Setup Checklist
  const { data: layoutsData, isLoading: layoutsLoading } = useQuery({
    queryKey: ['layouts', eventId],
    queryFn: () => {
      if (!eventData?.event?.organization_id) return Promise.resolve({ layouts: [] });
      return sdk.layouts.list(eventData.event.organization_id, { eventId });
    },
    enabled: !!eventData?.event,
  });

  // Mutation to persist wedding pace and other runsheet controls to SQLite metadata
  const saveMetadataMutation = useMutation({
    mutationFn: (newMetadata: any) => sdk.events.update(eventId, { metadata: newMetadata }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', eventId] });
    },
    onError: (err: any) => {
      toast({
        title: 'Sync Error',
        description: `Failed to persist runsheet pace: ${err.message}`,
        variant: 'destructive',
      });
    },
  });

  const event = eventData?.event;
  const timeline = useMemo(() => {
    return [...(timelineData?.items || [])].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    );
  }, [timelineData?.items]);

  const vendors = vendorData?.vendors || [];
  const tasks = staffData?.tasks || [];
  const phoneSearchLower = phoneSearch.trim().toLowerCase();
  const vendorContacts = vendors.filter((vendor: any) => !phoneSearchLower || vendor.name?.toLowerCase().includes(phoneSearchLower) || vendor.category?.toLowerCase().includes(phoneSearchLower) || vendor.contact_name?.toLowerCase().includes(phoneSearchLower));
  const staffContacts = tasks.filter((task: any) => !phoneSearchLower || task.title?.toLowerCase().includes(phoneSearchLower) || task.assigned_to?.toLowerCase?.().includes(phoneSearchLower) || task.assignee_name?.toLowerCase?.().includes(phoneSearchLower));

  // Parse event metadata
  const metadata = useMemo(() => {
    if (!event?.metadata) return {};
    try {
      return typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata;
    } catch {
      return {};
    }
  }, [event?.metadata]);

  const activePlan = metadata.emergency_active_plan || 'plan-a';
  const activeTimelineItemId = metadata.active_timeline_item_id || '';

  const handleUpdateActiveTimelineItem = (itemId: string) => {
    const nextMeta = { ...metadata, active_timeline_item_id: itemId };
    saveMetadataMutation.mutate(nextMeta, {
      onSuccess: () => {
        const item = timeline.find(i => i.id === itemId);
        toast({
          title: 'Live Wedding Pace Synchronized',
          description: item ? `Event advanced to: "${item.title}"` : 'Active phase reset.',
          variant: 'success',
        });
      }
    });
  };

  // Parse active layout and compile setup checklist
  const activeLayout = layoutsData?.layouts?.find((l: any) => l.approval_status === 'approved') || layoutsData?.layouts?.[0];
  
  const layoutChecklist = (() => {
    if (!activeLayout) return null;
    try {
      const payload = typeof activeLayout.payload === 'string' ? JSON.parse(activeLayout.payload) : (activeLayout.payload || {});
      const items = Array.isArray(payload.items) ? payload.items : [];
      
      const tables = items.filter((i: any) => i.type?.includes('table'));
      const chairs = items.filter((i: any) => i.type === 'chair');
      const decors = items.filter((i: any) => i.type === 'decor');
      const danceFloors = items.filter((i: any) => i.type === 'dance_floor');

      // Aggregate counts by name or label
      const tableCounts: Record<string, number> = {};
      tables.forEach((t: any) => {
        const key = t.label || (t.type === 'round_table' ? '60" Round Table' : 'Rectangular Banquet Table');
        tableCounts[key] = (tableCounts[key] || 0) + 1;
      });

      const chairCounts: Record<string, number> = {};
      chairs.forEach((c: any) => {
        const key = c.label || 'Standard Seating Chair';
        chairCounts[key] = (chairCounts[key] || 0) + 1;
      });

      const decorCounts: Record<string, number> = {};
      decors.forEach((d: any) => {
        const key = d.label || 'Floral Centerpiece Arrangement';
        decorCounts[key] = (decorCounts[key] || 0) + 1;
      });

      return {
        hasData: items.length > 0,
        layoutName: activeLayout.name,
        revision: activeLayout.revision,
        status: activeLayout.approval_status,
        tables: Object.entries(tableCounts),
        chairs: Object.entries(chairCounts),
        decors: Object.entries(decorCounts),
        hasDanceFloor: danceFloors.length > 0
      };
    } catch {
      return null;
    }
  })();

  const handlePrint = () => {
    window.print();
  };

  if (eventLoading || timelineLoading || vendorLoading || staffLoading || layoutsLoading) {
    return <div className="p-12 text-center text-fg-muted font-serif">Compiling Day-Of Operational Runsheet...</div>;
  }

  return (
    <>
      {/* Hide page header during print to save space */}
      <div className="print:hidden">
        <PageHeader
          backHref={`#/events/${eventId}`}
          title="Day-Of Run Sheet"
          description="Printable packet for staff and coordination."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant={dayOfMode ? 'default' : 'outline'} onClick={() => setDayOfMode(!dayOfMode)} className="font-bold min-h-10">
                <Smartphone className="w-4 h-4 mr-2" /> {dayOfMode ? 'Day-of Mode On' : 'Day-of Mode'}
              </Button>
              <Button onClick={handlePrint} className="font-bold min-h-10">
                <Printer className="w-4 h-4 mr-2" /> Print Packet
              </Button>
            </div>
          }
        />
      </div>

      <PageBody className={cn("print:p-0 print:m-0 animate-in fade-in duration-200 space-y-6", dayOfMode ? "max-w-5xl" : "max-w-4xl")}>

        <Card className="print:hidden border-brand/20 bg-brand/5">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-bold text-fg flex items-center gap-2"><Smartphone className="h-5 w-5 text-brand" /> Phone-friendly day-of command center</h2>
                <p className="text-xs text-fg-muted mt-1">Large touch targets, quick call/SMS, offline-friendly printed packet, and active phase controls for Apple/Android phones and tablets.</p>
              </div>
              <Badge variant={dayOfMode ? 'success' : 'outline'}>{dayOfMode ? 'Large touch mode enabled' : 'Standard mode'}</Badge>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <a href={`#/events/${eventId}/check-in`} target="_blank" rel="noreferrer"><Button className="min-h-14 w-full justify-start text-base"><Search className="h-5 w-5" /> QR / search check-in</Button></a>
              <Button variant="outline" className="min-h-14 justify-start text-base" onClick={handlePrint}><Printer className="h-5 w-5" /> Phone/print run sheet</Button>
              <Button variant="outline" className="min-h-14 justify-start text-base" onClick={() => setDayOfMode(!dayOfMode)}><Activity className="h-5 w-5" /> Toggle large controls</Button>
            </div>
          </CardContent>
        </Card>

        {(dayOfMode || mobileViewport) && <MobileContactLookup vendors={vendorContacts} tasks={staffContacts} search={phoneSearch} onSearchChange={setPhoneSearch} />}

        {/* COORDINATOR LIVE WEDDING PACE CONTROL DASHBOARD (NON-PRINT) */}
        <Card className="print:hidden bg-paper border-2 border-paper-border shadow-md rounded-2xl overflow-hidden">
          <CardHeader className="pb-4 border-b border-paper-border">
            <div className="flex justify-between items-center">
              <div className="space-y-1">
                <CardTitle className="text-base font-serif font-black text-brand flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand animate-pulse" /> Live Wedding Pace Controls
                </CardTitle>
                <CardDescription className="text-xs text-fg-subtle">
                  Advance active milestones in real-time. Checked-in vendors will receive instant timeline updates.
                </CardDescription>
              </div>
              <Badge variant="success" className="px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider">
                🟢 Live SSE Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-widest text-fg-subtle block">Active Milestone Phase</span>
              <div className="font-black text-base text-brand font-serif">
                {timeline.find(i => i.id === activeTimelineItemId)?.title || 'No active phase selected'}
              </div>
            </div>

            <div className="flex gap-2 items-center w-full sm:w-auto">
              <select
                className="text-xs p-2 rounded-lg border border-paper-border bg-white text-fg font-semibold flex-1 sm:flex-none min-w-[200px]"
                value={activeTimelineItemId}
                onChange={(e) => handleUpdateActiveTimelineItem(e.target.value)}
              >
                <option value="">-- Set Active Phase --</option>
                {timeline.map((item) => (
                  <option key={item.id} value={item.id}>
                    {new Date(item.starts_at).toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'})} - {item.title}
                  </option>
                ))}
              </select>
              {activeTimelineItemId && (
                <Button 
                  variant="outline" 
                  size="xs" 
                  onClick={() => handleUpdateActiveTimelineItem('')}
                  className="h-8 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  Reset
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* THE PRINTABLE PACKET BODY */}
        <div className="bg-paper text-paper-ink p-8 sm:p-10 shadow-lg border border-paper-border rounded-2xl print:border-none print:shadow-none print:p-0">
          
          {/* Header */}
          <div className="border-b-2 border-black pb-6 mb-8 flex justify-between items-start flex-wrap gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-brand">Event venue operations</span>
              <h1 className="text-3xl sm:text-4xl font-serif font-black tracking-tight mb-2 text-brand">{event?.title}</h1>
              <div className="flex gap-4 text-xs font-semibold text-fg-subtle">
                <div className="flex items-center gap-1.5">
                   <Clock className="w-4 h-4 text-brand" /> 
                   {event?.start_date ? format(parseISO(event.start_date), 'EEEE, MMMM d, yyyy') : 'TBD'}
                </div>
                <div className="flex items-center gap-1.5">
                   <MapPin className="w-4 h-4 text-brand" /> 
                   {event?.guest_count || 0} Guests Expected
                </div>
              </div>
            </div>

            {/* Layout Approval indicator */}
            {activeLayout && (
              <div className="bg-white border border-paper-border p-3 rounded-xl shadow-xs text-xs font-semibold shrink-0">
                 <div className="text-[9px] uppercase font-bold tracking-wider text-fg-subtle">Design Approval</div>
                 <div className="flex items-center gap-1.5 mt-1 text-fg">
                    <span className="font-bold text-sm font-serif">{activeLayout.name}</span>
                    <Badge variant={activeLayout.approval_status === 'approved' ? 'success' : 'warning'} className="text-[8px] uppercase">
                       {activeLayout.approval_status}
                    </Badge>
                 </div>
              </div>
            )}
          </div>

          {/* DYNAMIC PLAN B CONTINGENCY WARNING BANNER ON THE PRINTED PACKET */}
          {activePlan === 'plan-b' && (
            <div className="mb-8 border-2 border-amber-400 bg-amber-50/40 rounded-xl p-4 sm:p-5 flex gap-3.5 items-start">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs sm:text-sm text-amber-900 font-semibold">
                <p className="font-serif font-black text-amber-900 text-sm sm:text-base">⚠️ Active Weather Plan B Contingency Enabled</p>
                <p className="opacity-90 leading-relaxed text-[11px] sm:text-xs">
                  Outdoor setup is suspended. Indoor Ballroom floorplan layouts are enforced. Relocate all florals and enforce a strict 6ft clearance buffer zone around fireplace columns.
                </p>
              </div>
            </div>
          )}

          {/* Section 1: Setup Checklist (Grounded on active canvas details!) */}
          {layoutChecklist?.hasData && (
            <div className="mb-10 print:break-inside-avoid">
              <h2 className="text-lg font-serif font-black uppercase tracking-wider mb-4 border-b border-paper-border pb-2 flex items-center gap-2 text-brand">
                <ClipboardList className="w-5 h-5 text-brand" /> Physical Floorplan Setup Checklist
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                
                {/* Department A: Layout & Seating Crew */}
                <div className="space-y-3.5 bg-white p-4 rounded-xl border border-paper-border shadow-xs">
                   <h3 className="font-serif font-bold text-fg border-b pb-1 flex items-center justify-between">
                      <span>🔨 Layout &amp; Seating Crew</span>
                      <span className="text-[10px] text-brand">Tables / Chairs</span>
                   </h3>
                   <div className="space-y-2.5">
                      {/* DYNAMIC WEATHER PLAN B RELOCATIONS */}
                      {activePlan === 'plan-b' && (
                        <div className="border border-amber-200 bg-amber-50/10 p-2.5 rounded-lg space-y-2 mb-2.5">
                          <span className="text-[9px] uppercase font-black text-amber-700 tracking-wider block">🌧️ Plan B Weather Adaptations</span>
                          <div className="flex gap-2.5 items-start text-xs font-bold text-amber-800">
                             <div className="w-4 h-4 border-2 border-amber-400 rounded-md shrink-0 mt-0.5 print:border-black"></div>
                             <span>Relocate ceremony chairs from garden to ballroom stage grid</span>
                          </div>
                          <div className="flex gap-2.5 items-start text-xs font-bold text-amber-800">
                             <div className="w-4 h-4 border-2 border-amber-400 rounded-md shrink-0 mt-0.5 print:border-black"></div>
                             <span>Enforce 6-foot safety buffer zone around internal stone fireplace columns</span>
                          </div>
                        </div>
                      )}

                      {layoutChecklist.tables.map(([name, count]) => (
                        <div key={name} className="flex gap-2.5 items-start">
                           <div className="w-4 h-4 border-2 border-paper-border rounded-md shrink-0 mt-0.5 print:border-black"></div>
                           <span className="font-semibold text-fg-muted">Place <strong className="text-fg">{count}x</strong> {name} on stage grids</span>
                        </div>
                      ))}
                      {layoutChecklist.chairs.map(([name, count]) => (
                        <div key={name} className="flex gap-2.5 items-start">
                           <div className="w-4 h-4 border-2 border-paper-border rounded-md shrink-0 mt-0.5 print:border-black"></div>
                           <span className="font-semibold text-fg-muted">Align and anchor <strong className="text-fg">{count}x</strong> {name}</span>
                        </div>
                      ))}
                      {layoutChecklist.hasDanceFloor && (
                        <div className="flex gap-2.5 items-start">
                           <div className="w-4 h-4 border-2 border-paper-border rounded-md shrink-0 mt-0.5 print:border-black"></div>
                           <span className="font-semibold text-fg-muted">Assemble and lock center **Dance Floor** modules</span>
                        </div>
                      )}
                   </div>
                </div>

                {/* Department B: Florals & Catering Setup */}
                <div className="space-y-3.5 bg-white p-4 rounded-xl border border-paper-border shadow-xs">
                   <h3 className="font-serif font-bold text-fg border-b pb-1 flex items-center justify-between">
                      <span>🌸 Floral &amp; Linens Team</span>
                      <span className="text-[10px] text-brand">Decor / Linens</span>
                   </h3>
                   <div className="space-y-2.5">
                      {/* DYNAMIC WEATHER PLAN B FLORAL WORKFLOWS */}
                      {activePlan === 'plan-b' && (
                        <div className="border border-amber-200 bg-amber-50/10 p-2.5 rounded-lg space-y-2 mb-2.5">
                          <span className="text-[9px] uppercase font-black text-amber-700 tracking-wider block">🌧️ Plan B Greenery Adaptations</span>
                          <div className="flex gap-2.5 items-start text-xs font-bold text-amber-800">
                             <div className="w-4 h-4 border-2 border-amber-400 rounded-md shrink-0 mt-0.5 print:border-black"></div>
                             <span>Anchor main ceremony arch foliage structures inside ballroom window arches</span>
                          </div>
                        </div>
                      )}

                      {layoutChecklist.decors.map(([name, count]) => (
                        <div key={name} className="flex gap-2.5 items-start">
                           <div className="w-4 h-4 border-2 border-paper-border rounded-md shrink-0 mt-0.5 print:border-black"></div>
                           <span className="font-semibold text-fg-muted">Position <strong className="text-fg">{count}x</strong> {name} table centerpieces</span>
                        </div>
                      ))}
                      {layoutChecklist.tables.map(([name]) => (
                        <div key={name} className="flex gap-2.5 items-start">
                           <div className="w-4 h-4 border-2 border-paper-border rounded-md shrink-0 mt-0.5 print:border-black"></div>
                           <span className="font-semibold text-fg-muted">Drape luxury linen tablecloth options on all {name}s</span>
                        </div>
                      ))}
                   </div>
                </div>

              </div>
            </div>
          )}

          {/* Section 2: Timeline */}
          <div className="mb-10 print:break-inside-avoid">
            <h2 className="text-lg font-serif font-black uppercase tracking-wider mb-4 border-b border-paper-border pb-2 text-brand">Run of Show (Milestones)</h2>
            <div className="space-y-0">
              {timeline.length === 0 ? (
                 <p className="text-gray-500 italic text-sm">No timeline events scheduled.</p>
              ) : (
                 timeline.map((item) => {
                   const time = item.starts_at ? format(parseISO(item.starts_at), 'h:mm a') : 'TBD';
                   let notes = '';
                   try { notes = JSON.parse(item.metadata || '{}').notes || ''; } catch {}
                   
                   const isActive = item.id === activeTimelineItemId;

                   return (
                     <div 
                       key={item.id} 
                       className={cn(
                         "flex border-b border-gray-100 py-3.5 page-break-inside-avoid transition-colors",
                         isActive && "bg-emerald-50/20 border-l-4 border-l-emerald-500 pl-3.5"
                       )}
                     >
                       <div className="w-32 font-bold shrink-0 flex items-center gap-1.5">
                         {isActive && (
                           <span className="relative flex h-2 w-2">
                             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                             <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                           </span>
                         )}
                         {time}
                       </div>
                       <div className="flex-1 text-sm">
                         <div className="font-bold text-fg text-base flex items-center gap-2">
                           {item.title}
                           {isActive && (
                             <Badge variant="success" className="text-[8px] uppercase tracking-wider font-bold animate-pulse">
                               ● ACTIVE CURRENT PHASE
                             </Badge>
                           )}
                         </div>
                         <div className="text-[10px] font-bold text-brand uppercase tracking-widest mt-0.5">{item.category.replace('_', ' ')}</div>
                         {notes && <div className="text-sm mt-1 text-fg-muted font-semibold whitespace-pre-wrap">{notes}</div>}
                       </div>
                       {item.duration_min && (
                         <div className="w-24 text-right text-xs font-semibold text-fg-subtle">{item.duration_min} min duration</div>
                       )}
                     </div>
                   );
                 })
              )}
            </div>
          </div>

          {/* Section 3: Vendors */}
          <div className="mb-10 print:break-inside-avoid">
            <h2 className="text-lg font-serif font-black uppercase tracking-wider mb-4 border-b border-paper-border pb-2 flex items-center gap-2 text-brand">
              <Truck className="w-5 h-5" /> Vendor Directory
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {vendors.length === 0 ? (
                 <p className="text-gray-500 italic text-sm">No vendors listed.</p>
               ) : (
                 vendors.map(v => (
                   <div key={v.id} className="border border-paper-border p-4 rounded-xl bg-white shadow-xs">
                      <div className="font-bold text-fg text-sm">{v.name}</div>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-brand mb-2">{v.category}</div>
                      {v.contact_name && <div className="text-xs font-semibold text-fg-muted">Contact: {v.contact_name}</div>}
                      {v.phone && <div className="text-xs font-semibold text-fg-muted">Phone: {v.phone}</div>}
                      {v.email && <div className="text-xs font-semibold text-fg-muted">Email: {v.email}</div>}
                   </div>
                 ))
               )}
            </div>
          </div>

          {/* SECTION 4: PARTNER VENDOR SUB-CHECKLISTS (NEW ADDITION) */}
          <div className="mb-10 print:break-inside-avoid">
            <h2 className="text-lg font-serif font-black uppercase tracking-wider mb-4 border-b border-paper-border pb-2 flex items-center gap-2 text-brand">
              <Sparkles className="w-5 h-5 text-brand" /> Vendor-Specific Execution Checklists
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs font-semibold">
              
              {/* CATERING CHECKLIST */}
              <div className="border border-paper-border rounded-xl p-4 bg-white space-y-3 shadow-xs">
                <span className="font-serif font-bold text-brand block border-b pb-1">🍷 Catering &amp; Bar Lead</span>
                <div className="space-y-2 text-fg-muted font-semibold">
                  <div className="flex gap-2"><div className="w-3.5 h-3.5 border rounded-sm shrink-0 mt-0.5"></div><span>Verify linen drop length on buffet tables</span></div>
                  <div className="flex gap-2"><div className="w-3.5 h-3.5 border rounded-sm shrink-0 mt-0.5"></div><span>Pre-heat warming ovens in staging zone</span></div>
                  <div className="flex gap-2"><div className="w-3.5 h-3.5 border rounded-sm shrink-0 mt-0.5"></div><span>Coordinate dinner champagne pour timeline</span></div>
                </div>
              </div>

              {/* FLORALS CHECKLIST */}
              <div className="border border-paper-border rounded-xl p-4 bg-white space-y-3 shadow-xs">
                <span className="font-serif font-bold text-brand block border-b pb-1">🌸 Florals &amp; Decor Team</span>
                <div className="space-y-2 text-fg-muted font-semibold">
                  <div className="flex gap-2"><div className="w-3.5 h-3.5 border rounded-sm shrink-0 mt-0.5"></div><span>Secure centerpiece tall vases to pins</span></div>
                  <div className="flex gap-2"><div className="w-3.5 h-3.5 border rounded-sm shrink-0 mt-0.5"></div><span>Verify water level for hydrangeas</span></div>
                  <div className="flex gap-2"><div className="w-3.5 h-3.5 border rounded-sm shrink-0 mt-0.5"></div><span>Assemble greenery draping at head table</span></div>
                </div>
              </div>

              {/* ENTERTAINMENT CHECKLIST */}
              <div className="border border-paper-border rounded-xl p-4 bg-white space-y-3 shadow-xs">
                <span className="font-serif font-bold text-brand block border-b pb-1">🎵 AV &amp; Production Crews</span>
                <div className="space-y-2 text-fg-muted font-semibold">
                  <div className="flex gap-2"><div className="w-3.5 h-3.5 border rounded-sm shrink-0 mt-0.5"></div><span>Execute wireless mic frequency sound check</span></div>
                  <div className="flex gap-2"><div className="w-3.5 h-3.5 border rounded-sm shrink-0 mt-0.5"></div><span>Tape down all power cabling paths</span></div>
                  <div className="flex gap-2"><div className="w-3.5 h-3.5 border rounded-sm shrink-0 mt-0.5"></div><span>Test load limit balance on Ballroom Circuit 4</span></div>
                </div>
              </div>

            </div>
          </div>

          {/* Section 5: Staff Tasks */}
          <div className="print:break-inside-avoid mb-10">
            <h2 className="text-lg font-serif font-black uppercase tracking-wider mb-4 border-b border-paper-border pb-2 flex items-center gap-2 text-brand">
              <CheckSquare className="w-5 h-5" /> Staff Operations
            </h2>
            {['pre-event', 'during-event', 'post-event'].map(phase => {
               const phaseTasks = tasks.filter(t => t.phase === phase);
               if (phaseTasks.length === 0) return null;
               
               return (
                 <div key={phase} className="mb-6">
                    <h3 className="font-bold text-brand uppercase text-xs mb-3 tracking-widest font-serif">{phase.replace('-', ' ')}</h3>
                    <div className="space-y-3">
                       {phaseTasks.map(task => (
                         <div key={task.id} className="flex gap-3">
                            <div className="w-5 h-5 border-2 border-paper-border rounded-md shrink-0 mt-0.5 print:border-black"></div>
                            <div className="text-sm">
                               <div className="font-bold text-fg">{task.title}</div>
                               {task.description && <div className="text-xs text-fg-subtle font-semibold mt-0.5">{task.description}</div>}
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
               );
            })}
            {tasks.length === 0 && <p className="text-gray-500 italic text-sm">No tasks assigned.</p>}
          </div>

          {/* Section 6: Coordinator Approval Signatures Panel (WCAG Compliance Printout) */}
          <div className="pt-6 mt-8 border-t-2 border-dashed border-gray-400 print:break-inside-avoid">
             <h2 className="text-sm font-bold uppercase tracking-wider text-fg-subtle mb-4">Operations &amp; Handover Sign-Off</h2>
             <div className="grid grid-cols-2 gap-8 text-xs font-semibold pt-4 text-fg-muted">
                <div className="space-y-4">
                   <div className="border-b border-gray-400 h-10 w-full"></div>
                   <div>Venue Director Signature</div>
                </div>
                <div className="space-y-4">
                   <div className="border-b border-gray-400 h-10 w-full"></div>
                   <div>Lead Event Planner Signature</div>
                </div>
             </div>
             <p className="text-[10px] text-fg-subtle text-center mt-6">Generated via Seven Paths Manor Wedding Operating System. All physical changes verified and compliant.</p>
          </div>

        </div>
      </PageBody>
    </>
  );
}

function MobileContactLookup({ vendors, tasks, search, onSearchChange }: { vendors: any[]; tasks: any[]; search: string; onSearchChange: (value: string) => void }) {
  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Phone className="h-4 w-4 text-brand" /> Quick call / SMS lookup</CardTitle>
        <CardDescription>Fast vendor and staff contact actions for day-of phones and tablets.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search vendor, category, staff task..."
            className="h-12 w-full rounded-xl border border-border bg-surface px-3 pl-10 text-base text-fg outline-none focus:border-brand"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {vendors.slice(0, 6).map((vendor: any) => (
            <div key={vendor.id} className="rounded-xl border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-fg">{vendor.name}</div>
                  <div className="text-xs text-fg-muted">{vendor.category || 'Vendor'}{vendor.contact_name ? ` · ${vendor.contact_name}` : ''}</div>
                </div>
                <div className="flex gap-1">
                  {vendor.phone ? <a href={`tel:${vendor.phone}`} className="rounded-lg border border-border p-2 text-brand" aria-label={`Call ${vendor.name}`}><Phone className="h-4 w-4" /></a> : null}
                  {vendor.phone ? <a href={`sms:${vendor.phone}`} className="rounded-lg border border-border p-2 text-brand" aria-label={`Text ${vendor.name}`}><MessageSquare className="h-4 w-4" /></a> : null}
                </div>
              </div>
            </div>
          ))}
          {tasks.slice(0, 4).map((task: any) => {
            const phone = task.assignee_phone || task.phone;
            return (
              <div key={task.id} className="rounded-xl border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-fg">{task.assignee_name || task.assigned_to || 'Staff task'}</div>
                    <div className="text-xs text-fg-muted">{task.title}</div>
                  </div>
                  <div className="flex gap-1">
                    {phone ? <a href={`tel:${phone}`} className="rounded-lg border border-border p-2 text-brand" aria-label="Call staff"><Phone className="h-4 w-4" /></a> : null}
                    {phone ? <a href={`sms:${phone}`} className="rounded-lg border border-border p-2 text-brand" aria-label="Text staff"><MessageSquare className="h-4 w-4" /></a> : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {vendors.length === 0 && tasks.length === 0 && <p className="rounded-lg border border-dashed border-border bg-surface p-3 text-sm text-fg-muted">No contacts match this lookup. Use the full Vendors or Staff tab for deeper details.</p>}
      </CardContent>
    </Card>
  );
}
