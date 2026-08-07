import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../../sdk';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Badge } from '../../../ui/Badge';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';
import { useToast } from '../../../ui/Toast';
import { Skeleton } from '../../../ui/Skeleton';
import { Button } from '../../../ui/Button';
import { 
  ShieldAlert, 
  Flame, 
  Phone, 
  MessageSquare, 
  Check, 
  Plus, 
  Clock, 
  CloudRain, 
  Activity, 
  Sparkles, 
  HeartPulse, 
  Siren, 
  User, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Megaphone,
  CheckSquare,
  ShieldCheck
} from 'lucide-react';
import { cn } from '../../../ui/lib/cn';

interface Props {
  eventId: string;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'info' | 'minor' | 'major' | 'critical';
  status: 'reported' | 'in-progress' | 'resolved';
  assignedTo: string;
  createdAt: string;
}

interface KitItem {
  id: string;
  label: string;
  status: 'stocked' | 'low' | 'out';
}

const DEFAULT_KIT_ITEMS: KitItem[] = [
  { id: 'bobby-pins', label: 'Bobby Pins & Hair Ties', status: 'stocked' },
  { id: 'safety-pins', label: 'Safety Pins (multi-size)', status: 'stocked' },
  { id: 'stain-remover', label: 'Instant Stain Remover Wipes', status: 'stocked' },
  { id: 'pain-relievers', label: 'Pain Relievers (Advil/Tylenol)', status: 'stocked' },
  { id: 'sewing-kit', label: 'Mini Sewing Kit & Needles', status: 'stocked' },
  { id: 'bandaids', label: 'Blister Band-Aids & First Aid', status: 'stocked' },
  { id: 'mints', label: 'Breath Mints & Antacids', status: 'stocked' },
  { id: 'clear-umbrellas', label: 'Clear Umbrellas (x10)', status: 'stocked' },
  { id: 'scissors', label: 'Fabric Scissors', status: 'stocked' },
];

const EMERGENCY_CONTACTS = [
  { role: 'Lead Planner', name: 'Jane Doe', phone: '555-019-2834', email: 'jane@sevenpathsmanor.com' },
  { role: 'Venue Director', name: 'Marcus Vance', phone: '555-014-9982', email: 'marcus@sevenpathsmanor.com' },
  { role: 'Security Desk', name: 'Station 4 Guard', phone: '555-011-2233', email: 'security@sevenpathsmanor.com' },
  { role: 'On-site EMT', name: 'First Aid Office', phone: '555-012-3456', email: 'medical@sevenpathsmanor.com' },
  { role: 'Catering Captain', name: 'Enzo Rossi', phone: '555-018-7711', email: 'enzo@rossicatering.com' },
];

const PLAN_B_COMPLIANCE_CHECKS = [
  { id: 'fire-exits', label: 'Fire exit corridors fully clear of decorative drapery' },
  { id: 'occupancy', label: 'Indoor Ballroom maximum occupancy threshold not exceeded' },
  { id: 'cabling', label: 'All power cabling and AV cable tracks taped down & insulated' },
  { id: 'generator', label: 'Emergency backup generator fuel levels verified at 100%' },
];

export function EventEmergencyTab({ eventId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  // Dialog State for logging new incidents
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [incidentSeverity, setIncidentSeverity] = useState<'info' | 'minor' | 'major' | 'critical'>('minor');
  const [incidentAssigned, setIncidentAssigned] = useState('');

  // Mass Broadcast state
  const [broadcastText, setBroadcastText] = useState('');

  // Fetch Event data containing metadata JSON
  const { data: eventData, isLoading: eventLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => sdk.events.get(eventId),
  });

  const event = eventData?.event;

  // Venue spaces for this org — used to resolve the event's current space
  // and its configured rain-plan backup space (metadata.rainPlanVenueId).
  const { data: venuesData } = useQuery({
    queryKey: ['venues', event?.organization_id],
    queryFn: () => sdk.venues.list(event!.organization_id!),
    enabled: Boolean(event?.organization_id),
  });
  const venues = venuesData?.venues ?? [];

  // Memoize metadata parsing
  const metadata = useMemo(() => {
    if (!event?.metadata) return {};
    try {
      return typeof event.metadata === 'string' ? JSON.parse(event.metadata) : event.metadata;
    } catch {
      return {};
    }
  }, [event?.metadata]);

  const parseVenueMetadata = (venue: any): Record<string, any> => {
    if (!venue?.metadata) return {};
    try { return typeof venue.metadata === 'string' ? JSON.parse(venue.metadata) : venue.metadata; } catch { return {}; }
  };

  const currentVenue = venues.find((v: any) => v.id === event?.venue_id) ?? null;
  const backupVenueId = (currentVenue && parseVenueMetadata(currentVenue).rainPlanVenueId) || null;
  const backupVenue = venues.find((v: any) => v.id === backupVenueId) ?? null;

  // Extract Emergency structures from metadata
  const activePlan = metadata.emergency_active_plan || 'plan-a';
  const kitChecklist: KitItem[] = metadata.emergency_kit_checklist || DEFAULT_KIT_ITEMS;
  const incidents: Incident[] = metadata.emergency_incidents || [];
  const currentBroadcast = metadata.emergency_broadcast_announcement || '';
  const complianceStatus: Record<string, boolean> = metadata.emergency_compliance_checklist || {};

  // Mutation to persist state updates back to SQLite metadata column
  const saveMetadataMutation = useMutation({
    mutationFn: async (newMetadata: any) => {
      // Refresh-before-write: base the write on the freshest metadata so
      // concurrent changes (another tablet logging an incident, toggling a
      // kit item) are not clobbered by our mount-time snapshot. The server
      // also deep-merges metadata, so different sub-keys always survive.
      let base: Record<string, any> = metadata;
      try {
        const fresh = await qc.fetchQuery({ queryKey: ['event', eventId], queryFn: () => sdk.events.get(eventId), staleTime: 0 });
        const raw = fresh?.event?.metadata;
        if (raw) {
          const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
          if (parsed && typeof parsed === 'object') base = parsed;
        }
      } catch { /* offline/error — fall back to mount-time snapshot */ }
      return sdk.events.update(eventId, { metadata: { ...base, ...newMetadata } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', eventId] });
    },
    onError: (err: any) => {
      toast({
        title: 'Sync Error',
        description: `Failed to persist emergency data: ${err.message}`,
        variant: 'destructive',
      });
    },
  });

  const handleUpdatePlan = (plan: 'plan-a' | 'plan-b') => {
    const nextMeta = { ...metadata, emergency_active_plan: plan };

    if (plan === 'plan-b' && backupVenueId && backupVenue && event?.venue_id !== backupVenueId) {
      // A backup space is configured: move the event to it (the server
      // records the previous space so Plan A can restore it).
      sdk.events.activateRainPlan(eventId)
        .then(() => {
          qc.invalidateQueries({ queryKey: ['event', eventId] });
          saveMetadataMutation.mutate(nextMeta, {
            onSuccess: () => {
              toast({
                title: '🚨 Plan B Weather Contingency Active',
                description: `The event has been moved to ${backupVenue.name}. Run sheets and the vendor portal now reference the backup space.`,
                variant: 'success',
              });
            },
          });
        })
        .catch((err: any) => {
          // Still record the plan flag so dashboards reflect the decision,
          // but surface the wiring problem honestly.
          saveMetadataMutation.mutate(nextMeta, {
            onSuccess: () => {
              toast({
                title: 'Plan B marked — event not moved',
                description: `${err?.message ?? 'Could not move the event'}. Open Venue Builder to fix the backup space configuration.`,
                variant: 'destructive',
              });
            },
          });
        });
      return;
    }

    if (plan === 'plan-a' && typeof metadata.previousVenueId === 'string') {
      // The event was moved by a rain-plan activation — move it back.
      sdk.events.activateRainPlan(eventId, { restore: true })
        .then((res) => {
          qc.invalidateQueries({ queryKey: ['event', eventId] });
          saveMetadataMutation.mutate(nextMeta, {
            onSuccess: () => {
              toast({
                title: '☀️ Plan A Standard Layout Active',
                description: `The event is back at ${res.rainPlan.toVenue}.`,
                variant: 'success',
              });
            },
          });
        })
        .catch((err: any) => {
          saveMetadataMutation.mutate(nextMeta, {
            onSuccess: () => {
              toast({
                title: 'Could not restore the original space',
                description: `${err?.message ?? 'Please try again.'}`,
                variant: 'destructive',
              });
            },
          });
        });
      return;
    }

    saveMetadataMutation.mutate(nextMeta, {
      onSuccess: () => {
        if (plan === 'plan-b') {
          toast({
            title: '🚨 Plan B Weather Contingency Active',
            description: backupVenue
              ? `${backupVenue.name} is the configured backup for ${currentVenue?.name ?? 'this space'}.`
              : 'No backup space is configured yet — staff layouts will keep showing the current space. Set a backup in Venue Builder to move the event automatically.',
            variant: 'success',
          });
        } else {
          toast({
            title: '☀️ Plan A Standard Layout Active',
            description: currentVenue ? `Standard setup in ${currentVenue.name} restored.` : 'Standard setup restored.',
            variant: 'success',
          });
        }
      },
    });
  };

  const handleToggleKitItem = (itemId: string, currentStatus: 'stocked' | 'low' | 'out') => {
    const statuses: Array<'stocked' | 'low' | 'out'> = ['stocked', 'low', 'out'];
    const nextStatus = statuses[(statuses.indexOf(currentStatus) + 1) % statuses.length];
    
    const updatedKit = kitChecklist.map((item) =>
      item.id === itemId ? { ...item, status: nextStatus } : item
    );

    const nextMeta = { ...metadata, emergency_kit_checklist: updatedKit };
    saveMetadataMutation.mutate(nextMeta);
  };

  const handleAddIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentTitle.trim()) {
      toast({ title: 'Please provide a title for the incident.', variant: 'destructive' });
      return;
    }

    const newIncident: Incident = {
      id: `inc-${Date.now()}`,
      title: incidentTitle.trim(),
      description: incidentDesc.trim(),
      severity: incidentSeverity,
      status: 'reported',
      assignedTo: incidentAssigned.trim() || 'Unassigned Coordinator',
      createdAt: new Date().toISOString(),
    };

    const nextMeta = {
      ...metadata,
      emergency_incidents: [newIncident, ...incidents],
    };

    saveMetadataMutation.mutate(nextMeta, {
      onSuccess: () => {
        toast({
          title: 'Emergency Incident Logged',
          description: `Logged: "${newIncident.title}"`,
          variant: 'success',
        });
        setIncidentTitle('');
        setIncidentDesc('');
        setIncidentSeverity('minor');
        setIncidentAssigned('');
        setIsLogDialogOpen(false);
      },
    });
  };

  const handleUpdateIncidentStatus = (incidentId: string, nextStatus: 'reported' | 'in-progress' | 'resolved') => {
    const updatedIncidents = incidents.map((inc) =>
      inc.id === incidentId ? { ...inc, status: nextStatus } : inc
    );

    const nextMeta = { ...metadata, emergency_incidents: updatedIncidents };
    saveMetadataMutation.mutate(nextMeta, {
      onSuccess: () => {
        toast({
          title: 'Incident Status Updated',
          description: `Incident marked as ${nextStatus.replace('-', ' ')}.`,
          variant: 'success',
        });
      },
    });
  };

  const handleDeleteIncident = (incidentId: string) => {
    const updatedIncidents = incidents.filter((inc) => inc.id !== incidentId);
    const nextMeta = { ...metadata, emergency_incidents: updatedIncidents };
    saveMetadataMutation.mutate(nextMeta, {
      onSuccess: () => {
        toast({
          title: 'Incident Deleted',
          variant: 'success',
        });
      },
    });
  };

  // Mass Announcement Broadcast
  const handleBroadcastAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;

    const nextMeta = {
      ...metadata,
      emergency_broadcast_announcement: broadcastText.trim(),
    };

    saveMetadataMutation.mutate(nextMeta, {
      onSuccess: () => {
        toast({
          title: 'Emergency Announcement Broadcasted',
          description: 'Announcements pushed to all checked-in staff and vendor portals.',
          variant: 'success',
        });
        setBroadcastText('');
      },
    });
  };

  const handleClearBroadcast = () => {
    const nextMeta = {
      ...metadata,
      emergency_broadcast_announcement: '',
    };
    saveMetadataMutation.mutate(nextMeta, {
      onSuccess: () => {
        toast({
          title: 'Broadcast Announcement Cleared',
          variant: 'success',
        });
      },
    });
  };

  // Toggle Safety Compliance Items
  const handleToggleCompliance = (checkId: string) => {
    const nextCompliance = { ...complianceStatus };
    nextCompliance[checkId] = !nextCompliance[checkId];

    const nextMeta = {
      ...metadata,
      emergency_compliance_checklist: nextCompliance,
    };
    saveMetadataMutation.mutate(nextMeta);
  };

  if (eventLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  // Statistics for badges
  const activeIncidentsCount = incidents.filter((i) => i.status !== 'resolved').length;
  const criticalIncidentsCount = incidents.filter((i) => i.status !== 'resolved' && i.severity === 'critical').length;
  const depletedKitItemsCount = kitChecklist.filter((k) => k.status === 'out').length;

  // Verify compliance completion
  const isFullyCompliant = PLAN_B_COMPLIANCE_CHECKS.every(check => !!complianceStatus[check.id]);

  return (
    <div className="space-y-6 text-paper-ink animate-in fade-in duration-200">
      
      {/* WEATHER CONTINGENCY BANNER & COMMAND CENTER */}
      <Card className="bg-paper text-paper-ink border-2 border-paper-border shadow-md overflow-hidden rounded-2xl">
        <div className="p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2 max-w-xl">
            <span className="text-[10px] uppercase font-bold tracking-widest text-brand inline-flex items-center gap-1.5 bg-[#e1d5c9]/30 px-2.5 py-1 rounded-full">
              <CloudRain className="w-3.5 h-3.5 text-brand" /> Coordinator Action Center
            </span>
            <h2 className="text-2xl font-serif font-black tracking-tight text-brand">Weather &amp; Contingency Status</h2>
            <p className="text-sm font-semibold text-fg-subtle">
              Severe weather or rain in forecast? Seamlessly toggle the active wedding plan structure to automatically adjust staff layout guides.
            </p>
          </div>

          <div className="flex gap-3 shrink-0 self-stretch md:self-auto flex-col sm:flex-row">
            <Button
              variant={activePlan === 'plan-a' ? 'default' : 'outline'}
              onClick={() => handleUpdatePlan('plan-a')}
              className={cn(
                "font-bold py-5 sm:py-6 px-6 text-sm transition-all rounded-xl shadow-xs flex-1",
                activePlan === 'plan-a' && "bg-paper-ink text-white hover:bg-[#3d3a39]"
              )}
            >
              ☀️ Plan A: {currentVenue?.name ?? 'Standard Layout'}
            </Button>
            <Button
              variant={activePlan === 'plan-b' ? 'default' : 'outline'}
              onClick={() => handleUpdatePlan('plan-b')}
              className={cn(
                "font-bold py-5 sm:py-6 px-6 text-sm transition-all rounded-xl shadow-xs flex-1",
                activePlan === 'plan-b' && "bg-amber-600 text-white border-amber-600 hover:bg-amber-700"
              )}
            >
              🌧️ Plan B: {backupVenue?.name ?? 'Weather Backup'}
            </Button>
          </div>
        </div>

        {/* Dynamic Warning Alert for Plan B */}
        {activePlan === 'plan-b' && (
          <div className="bg-amber-50 border-t-2 border-amber-500/50 p-5 flex gap-3.5 items-start">
            <AlertTriangle className="w-5.5 h-5.5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm text-amber-900 font-semibold">
              <p className="font-bold text-base">Plan B: Weather Contingency is ACTIVE</p>
              {backupVenue ? (
                <p className="opacity-90 leading-relaxed text-xs sm:text-sm">
                  The event has been moved to <strong>{backupVenue.name}</strong>. Run sheets, the vendor
                  portal, and staff layout guides now reference the backup space. Use Plan A to restore
                  the original space.
                </p>
              ) : (
                <p className="opacity-90 leading-relaxed text-xs sm:text-sm">
                  No backup space is configured for {currentVenue?.name ?? 'this event'} yet — layouts
                  keep referencing the current space. Open Venue Builder to pick a rain-plan backup space.
                </p>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* DYNAMIC COMPLIANCE & BROADCAST WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* MASS ANNOUNCEMENT BROADCAST CENTER */}
        <Card className="lg:col-span-6 bg-paper border border-paper-border shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-paper-border">
            <CardTitle className="text-base font-serif font-black text-brand flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-brand" /> Mass Emergency Broadcasts
            </CardTitle>
            <CardDescription className="text-xs text-fg-subtle">
              Push screen-wide notifications to all checked-in crew, staff, and partner vendor portals.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            
            {/* Active announcement box */}
            {currentBroadcast ? (
              <div className="border border-rose-200 bg-rose-50/20 p-4 rounded-xl flex items-start justify-between gap-4 animate-in zoom-in-95 duration-200">
                <div className="space-y-1">
                  <span className="text-[9px] uppercase font-black text-rose-600 tracking-widest flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 animate-pulse" /> Active Broadcast Announcement
                  </span>
                  <p className="text-sm font-bold text-fg leading-relaxed">"{currentBroadcast}"</p>
                </div>
                <Button 
                  onClick={handleClearBroadcast}
                  variant="outline" 
                  size="xs" 
                  className="h-7 text-[10px] font-bold text-rose-600 border-rose-200 hover:bg-rose-50"
                >
                  Clear Alert
                </Button>
              </div>
            ) : (
              <div className="border border-dashed border-gray-200 p-4 rounded-xl text-center text-xs text-fg-subtle">
                No active announcements broadcasting. Use the form below to push a live alert.
              </div>
            )}

            <form onSubmit={handleBroadcastAnnouncement} className="space-y-3">
              <div>
                <Label htmlFor="broadcast-input" className="text-xs font-bold text-fg-muted uppercase tracking-wider">Compose Announcement</Label>
                <div className="flex gap-2 mt-1.5">
                  <Input 
                    id="broadcast-input"
                    placeholder="E.g. Grand Entrance starting in 5 minutes. All staff stand by."
                    value={broadcastText}
                    onChange={(e) => setBroadcastText(e.target.value)}
                    required
                  />
                  <Button type="submit" className="font-bold flex items-center gap-1 shrink-0 bg-paper-ink hover:bg-[#3e3b39]">
                    <Megaphone className="w-4 h-4" /> Broadcast
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* PLAN B COMPLIANCE REGULATION AUDITOR */}
        <Card className="lg:col-span-6 bg-paper border border-paper-border shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="pb-3 border-b border-paper-border flex flex-row justify-between items-center">
            <div>
              <CardTitle className="text-base font-serif font-black text-brand flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-brand" /> Plan B Safety Compliance Auditor
              </CardTitle>
              <CardDescription className="text-xs text-fg-subtle">
                Verify venue regulations for indoor contingency operations.
              </CardDescription>
            </div>
            
            {isFullyCompliant ? (
              <Badge variant="success" className="font-bold text-[9px] uppercase tracking-wider animate-bounce">
                🛡️ COMPLIANT &amp; SECURED
              </Badge>
            ) : (
              <Badge variant="warning" className="font-bold text-[9px] uppercase tracking-wider">
                ⚠️ CHECKS PENDING
              </Badge>
            )}
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            
            <div className="space-y-2">
              {PLAN_B_COMPLIANCE_CHECKS.map((check) => {
                const isChecked = !!complianceStatus[check.id];
                const label = check.id === 'occupancy' && backupVenue
                  ? `${backupVenue.name} maximum occupancy threshold not exceeded`
                  : check.label;
                return (
                  <div 
                    key={check.id}
                    onClick={() => handleToggleCompliance(check.id)}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer bg-white transition-all",
                      isChecked ? "border-emerald-200 bg-emerald-50/10" : "border-paper-border hover:border-brand"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                      isChecked ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300"
                    )}>
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <span className={cn(
                      "text-xs font-semibold",
                      isChecked ? "text-fg-subtle line-through" : "text-fg-muted"
                    )}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            {isFullyCompliant && (
              <div className="border border-emerald-200 bg-emerald-50/10 p-3.5 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-xs font-semibold text-emerald-800 space-y-0.5">
                  <p className="font-bold">Venue Safety Compliances Secured</p>
                  <p className="opacity-90">Indoor ballroom spacing matches layout specifications. All critical exits, electrical runs, and back-power generators have been cleared.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* CORE TOOLKIT WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: ACTIVE INCIDENTS LOGGER */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="bg-paper border border-paper-border shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-4 border-b border-paper-border flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-serif font-black text-brand flex items-center gap-2">
                  <Siren className="w-5 h-5 text-brand" /> On-Site Incident Log
                </CardTitle>
                <CardDescription className="text-xs font-semibold text-fg-subtle">
                  Log and track active crises or setup deviations in real-time.
                </CardDescription>
              </div>
              
              <div className="flex gap-2">
                {criticalIncidentsCount > 0 && (
                  <Badge variant="danger" className="animate-pulse px-2 py-0.5 text-[10px] font-bold">
                    🚨 {criticalIncidentsCount} CRITICAL
                  </Badge>
                )}
                <Button 
                  onClick={() => setIsLogDialogOpen(true)}
                  className="bg-brand text-white hover:bg-brand-dark font-bold text-xs px-3 h-8 rounded-lg flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Log Issue
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              
              {/* Log Incident Dialog form (Simulated beautifully inside tab to maintain robust rendering structure) */}
              {isLogDialogOpen && (
                <form onSubmit={handleAddIncident} className="mb-6 p-4 bg-white rounded-xl border border-amber-200 shadow-sm space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex justify-between items-center pb-2 border-b">
                    <h4 className="text-sm font-bold font-serif text-brand flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-brand" /> Report Real-time Incident
                    </h4>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setIsLogDialogOpen(false)}
                      className="text-xs h-6 px-2 hover:bg-gray-100 font-bold"
                    >
                      Cancel
                    </Button>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div>
                      <label className="block text-xs font-bold text-fg-subtle mb-1">Incident Title *</label>
                      <Input
                        required
                        placeholder="E.g. Main power circuit tripped in ballroom"
                        value={incidentTitle}
                        onChange={(e) => setIncidentTitle(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-fg-subtle mb-1">Details &amp; Resolution Actions</label>
                      <textarea
                        rows={2}
                        className="w-full text-sm p-2.5 rounded-lg border border-input bg-background focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder="E.g. Catering microwave overloaded circuit. Sparky on site relocating plugs."
                        value={incidentDesc}
                        onChange={(e) => setIncidentDesc(e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-fg-subtle mb-1">Severity Level</label>
                        <select
                          className="w-full text-sm p-2 rounded-lg border border-input bg-background"
                          value={incidentSeverity}
                          onChange={(e) => setIncidentSeverity(e.target.value as any)}
                        >
                          <option value="info">Info / Operational</option>
                          <option value="minor">Minor Deviation</option>
                          <option value="major">Major / High Risk</option>
                          <option value="critical">🚨 Critical / Life Safety</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-fg-subtle mb-1">Assigned Crew Member</label>
                        <Input
                          placeholder="E.g. Planner Jane"
                          value={incidentAssigned}
                          onChange={(e) => setIncidentAssigned(e.target.value)}
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full font-bold h-9">
                      🚨 Broadcast Incident &amp; Log
                    </Button>
                  </div>
                </form>
              )}

              {/* Incidents List */}
              {incidents.length === 0 ? (
                <div className="text-center py-12 text-fg-subtle bg-white rounded-xl border border-dashed border-paper-border p-6">
                  <Activity className="w-10 h-10 mx-auto text-brand/30 mb-2.5" />
                  <p className="font-serif font-black text-brand text-base">All Operational Systems Normal</p>
                  <p className="text-xs font-semibold max-w-sm mx-auto mt-1">
                    No emergencies, delays, or outages logged. Click "Log Issue" above to dispatch personnel to an event conflict.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {incidents.map((inc) => {
                    const isResolved = inc.status === 'resolved';
                    return (
                      <div 
                        key={inc.id} 
                        className={cn(
                          "border-l-4 p-4 rounded-r-xl bg-white shadow-xs border border-y border-r border-paper-border transition-all relative",
                          inc.severity === 'critical' && !isResolved && "border-l-rose-600 bg-rose-50/20",
                          inc.severity === 'major' && !isResolved && "border-l-amber-500 bg-amber-50/20",
                          inc.severity === 'minor' && !isResolved && "border-l-indigo-400",
                          inc.severity === 'info' && !isResolved && "border-l-blue-400",
                          isResolved && "border-l-emerald-500 opacity-60 bg-emerald-50/10"
                        )}
                      >
                        <div className="flex justify-between items-start gap-4 mb-2 flex-wrap">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h5 className={cn("font-bold text-base font-serif", isResolved && "line-through text-fg-subtle")}>
                                {inc.title}
                              </h5>
                              <Badge 
                                variant={
                                  inc.severity === 'critical' ? 'danger' :
                                  inc.severity === 'major' ? 'warning' :
                                  inc.severity === 'minor' ? 'brand' : 'outline'
                                }
                                className="text-[9px] uppercase font-bold tracking-wider"
                              >
                                {inc.severity}
                              </Badge>
                              <Badge 
                                variant={
                                  inc.status === 'resolved' ? 'success' :
                                  inc.status === 'in-progress' ? 'warning' : 'outline'
                                }
                                className="text-[9px] uppercase font-bold tracking-wider"
                              >
                                {inc.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-fg-subtle font-semibold flex items-center gap-1">
                              <User className="w-3.5 h-3.5" /> Assigned: <span className="text-fg">{inc.assignedTo}</span>
                            </p>
                          </div>

                          <div className="flex gap-1.5 text-xs">
                            {inc.status !== 'resolved' && (
                              <>
                                <Button 
                                  size="xs" 
                                  variant="outline" 
                                  onClick={() => handleUpdateIncidentStatus(inc.id, 'in-progress')}
                                  className="h-7 text-[10px] font-bold"
                                  disabled={inc.status === 'in-progress'}
                                >
                                  In Progress
                                </Button>
                                <Button 
                                  size="xs" 
                                  variant="default" 
                                  onClick={() => handleUpdateIncidentStatus(inc.id, 'resolved')}
                                  className="h-7 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700"
                                >
                                  Resolve
                                </Button>
                              </>
                            )}
                            {inc.status === 'resolved' && (
                              <Button 
                                size="xs" 
                                variant="outline" 
                                onClick={() => handleUpdateIncidentStatus(inc.id, 'reported')}
                                className="h-7 text-[10px] font-bold"
                              >
                                Re-open
                              </Button>
                            )}
                            <Button 
                              size="xs" 
                              variant="ghost" 
                              onClick={() => handleDeleteIncident(inc.id)}
                              className="h-7 text-[10px] font-bold text-rose-600 hover:bg-rose-50"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>

                        {inc.description && (
                          <p className="text-sm text-fg-muted font-medium mb-2.5 leading-relaxed bg-surface-2 p-2.5 rounded-lg border border-gray-100 whitespace-pre-wrap">
                            {inc.description}
                          </p>
                        )}

                        <div className="text-[9px] font-bold uppercase tracking-wider text-fg-subtle flex items-center gap-1 justify-end">
                          <Clock className="w-3 h-3" /> Logged: {new Date(inc.createdAt).toLocaleTimeString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: EMERGENCY SURVIVAL KIT CHECKLIST */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="bg-paper border border-paper-border shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="pb-4 border-b border-paper-border">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-serif font-black text-brand flex items-center gap-2">
                  <HeartPulse className="w-5 h-5 text-brand" /> Coordinator Survival Kit
                </CardTitle>
                {depletedKitItemsCount > 0 && (
                  <Badge variant="danger" className="px-2 py-0.5 text-[9px] font-bold">
                    ⚠️ {depletedKitItemsCount} OUT
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs font-semibold text-fg-subtle">
                Digital stock tracker of the physical emergency toolbox. Tap item to cycle inventory status.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              
              <div className="space-y-2.5">
                {kitChecklist.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => handleToggleKitItem(item.id, item.status)}
                    className="flex justify-between items-center p-3 rounded-xl bg-white border border-paper-border shadow-xs cursor-pointer hover:border-brand hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "w-5 h-5 rounded-md flex items-center justify-center border-2 transition-all",
                        item.status === 'stocked' && "border-emerald-500 bg-emerald-50 text-emerald-600",
                        item.status === 'low' && "border-amber-400 bg-amber-50 text-amber-500",
                        item.status === 'out' && "border-rose-500 bg-rose-50 text-rose-600"
                      )}>
                        {item.status === 'stocked' && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        {item.status === 'low' && <span className="text-[10px] font-black font-sans">!</span>}
                        {item.status === 'out' && <span className="text-[10px] font-black font-sans">✕</span>}
                      </div>
                      <span className="text-sm font-semibold text-fg-muted group-hover:text-fg transition-colors">
                        {item.label}
                      </span>
                    </div>

                    <Badge 
                      variant={
                        item.status === 'stocked' ? 'success' :
                        item.status === 'low' ? 'warning' : 'danger'
                      }
                      className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5"
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>

            </CardContent>
          </Card>
        </div>

      </div>

      {/* EMERGENCY QUICK-DIAL CONTACT REGISTRY */}
      <Card className="bg-paper border border-paper-border shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="pb-4 border-b border-paper-border">
          <CardTitle className="text-lg font-serif font-black text-brand flex items-center gap-2">
            <Phone className="w-5 h-5 text-brand" /> Emergency Quick-Dial Contacts
          </CardTitle>
          <CardDescription className="text-xs font-semibold text-fg-subtle">
            Immediate dialer links to the primary coordination and security desk officers on site.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {EMERGENCY_CONTACTS.map((contact, idx) => (
              <div key={idx} className="border border-paper-border p-4 rounded-xl bg-white shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-brand block mb-1">
                    {contact.role}
                  </span>
                  <div className="font-bold text-fg text-sm mb-0.5">{contact.name}</div>
                  <div className="text-xs font-semibold text-fg-subtle mb-3">{contact.phone}</div>
                </div>

                <div className="flex gap-1.5 mt-auto border-t pt-3">
                  <a href={`tel:${contact.phone}`} className="flex-1">
                    <Button variant="outline" size="xs" className="w-full text-[10px] font-bold h-7 py-0 px-2 flex items-center justify-center gap-1 text-brand border-paper-border hover:bg-brand-soft/20">
                      <Phone className="w-3 h-3" /> Call
                    </Button>
                  </a>
                  <a href={`sms:${contact.phone}`} className="flex-1">
                    <Button variant="outline" size="xs" className="w-full text-[10px] font-bold h-7 py-0 px-2 flex items-center justify-center gap-1 text-paper-ink border-paper-border hover:bg-gray-100">
                      <MessageSquare className="w-3 h-3" /> Text
                    </Button>
                  </a>
                </div>
              </div>
            ))}
          </div>

        </CardContent>
      </Card>

    </div>
  );
}
