import type { SdkStaffTask } from '../../../../sdk/types';
import { CheckSquare, Circle, ClipboardList, Plus, Calendar, Clock, UserCheck, ShieldAlert, Sparkles, Trash2, Shield, Eye, Settings2, SlidersHorizontal, Map, X, Bell, Download, Smartphone, Radio, AlertTriangle, Phone, MessageSquare, Mail, Users, Printer, ClipboardCheck, BarChart3, GitBranch, MapPin } from 'lucide-react';
import { Button } from '../../../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../ui/Card';
import { Badge } from '../../../../ui/Badge';
import { Input } from '../../../../ui/Input';
import { cn } from '../../../../ui/lib/cn';
import { VenueManagerStaffingCommandCenter, CrewContactCard, StaffMiniMetric } from '.././staffPanels';

export interface StaffTopCardsProps {
  setEditTask: React.Dispatch<React.SetStateAction<SdkStaffTask | null>>;
  setSetupWizardOpen: React.Dispatch<React.SetStateAction<any>>;
  captainMode: any;
  setCaptainMode: React.Dispatch<React.SetStateAction<any>>;
  setIncidentOpen: React.Dispatch<React.SetStateAction<any>>;
  availabilityDay: any;
  setAvailabilityDay: React.Dispatch<React.SetStateAction<any>>;
  availabilityStart: any;
  setAvailabilityStart: React.Dispatch<React.SetStateAction<any>>;
  availabilityEnd: any;
  setAvailabilityEnd: React.Dispatch<React.SetStateAction<any>>;
  availabilityStaffId: any;
  setAvailabilityStaffId: React.Dispatch<React.SetStateAction<any>>;
  setupChecklistData: any;
  staffingRequirementsData: any;
  availabilityData: any;
  availabilityMutation: any;
  seedSetupChecklistMutation: any;
  staffingRequirementsMutation: any;
  deleteAvailabilityMutation: any;
  tasks: any;
  shifts: any;
  whatNowQueue: any[];
  canManageAvailability: any;
  availabilityStaff: any;
  liveCrew: any;
  coveragePct: any;
}

export function StaffTopCards({ setEditTask, setSetupWizardOpen, captainMode, setCaptainMode, setIncidentOpen, availabilityDay, setAvailabilityDay, availabilityStart, setAvailabilityStart, availabilityEnd, setAvailabilityEnd, availabilityStaffId, setAvailabilityStaffId, setupChecklistData, staffingRequirementsData, availabilityData, availabilityMutation, seedSetupChecklistMutation, staffingRequirementsMutation, deleteAvailabilityMutation, tasks, shifts, whatNowQueue, canManageAvailability, availabilityStaff, liveCrew, coveragePct }: StaffTopCardsProps) {
  return (
    <>
      <Card><CardHeader><CardTitle>Event Week setup checklist</CardTitle><CardDescription>Ceremony and reception execution checks for the venue team.</CardDescription></CardHeader><CardContent>{setupChecklistData?.checklist.length ? <div className="space-y-1 text-sm">{setupChecklistData.checklist.map((task: any) => <p key={task.id}>{task.status === 'completed' ? '✓' : '○'} {task.title}</p>)}</div> : <div className="flex items-center justify-between gap-2 text-sm"><span className="text-fg-muted">No setup checklist has been prepared.</span>{canManageAvailability ? <Button size="sm" isLoading={seedSetupChecklistMutation.isPending} onClick={() => seedSetupChecklistMutation.mutate()}>Create checklist</Button> : <span className="text-fg-muted">Ask a venue manager to create it.</span>}</div>}</CardContent></Card>
      {canManageAvailability && <Card><CardHeader><CardTitle>Required event staffing roles</CardTitle><CardDescription>Configure the roles this wedding needs. The venue coverage dashboard flags any missing role.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3">{(['coordinator','setup','cleaning','parking','other'] as const).map((role) => { const required = staffingRequirementsData?.requiredRoles?.includes(role) ?? ['coordinator','setup'].includes(role); return <label key={role} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={required} onChange={(e) => { const current = staffingRequirementsData?.requiredRoles || ['coordinator','setup']; const next = e.target.checked ? [...new Set([...current, role])] : current.filter((item: any) => item !== role); if (next.length) staffingRequirementsMutation.mutate(next as any); }}/>{role}</label>; })}</CardContent></Card>}
      <Card><CardHeader><CardTitle>My weekly availability</CardTitle><CardDescription>Set your normal recurring hours. Venue managers can use these hours when assigning event shifts.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-2">{availabilityData?.availability?.map((slot: any) => <span key={slot.id} className="inline-flex items-center gap-1"><Badge variant="outline">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][slot.day_of_week]} {slot.starts_at}–{slot.ends_at}</Badge><Button aria-label={`Remove availability ${slot.id}`} size="xs" variant="ghost" isLoading={deleteAvailabilityMutation.isPending} onClick={() => deleteAvailabilityMutation.mutate(slot.id)}><X className="h-3 w-3" /></Button></span>) || <span className="text-sm text-fg-muted">No recurring hours set.</span>}</div><div className="flex flex-wrap items-end gap-2">{canManageAvailability && <label className="text-sm">Team member<select aria-label="Availability staff member" className="ml-1 h-9 rounded border border-border bg-surface px-2" value={availabilityStaffId} onChange={(e) => setAvailabilityStaffId(e.target.value)}><option value="">My availability</option>{availabilityStaff.map((member: any) => <option key={member.user_id || member.userId} value={member.user_id || member.userId}>{member.full_name || member.fullName || member.email}</option>)}</select></label>}<label className="text-sm">Day<select aria-label="Availability day" className="ml-1 h-9 rounded border border-border bg-surface px-2" value={availabilityDay} onChange={(e) => setAvailabilityDay(e.target.value)}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label><label className="text-sm">Start<Input aria-label="Availability start" type="time" className="ml-1 inline-flex w-28" value={availabilityStart} onChange={(e) => setAvailabilityStart(e.target.value)} /></label><label className="text-sm">End<Input aria-label="Availability end" type="time" className="ml-1 inline-flex w-28" value={availabilityEnd} onChange={(e) => setAvailabilityEnd(e.target.value)} /></label><Button size="sm" isLoading={availabilityMutation.isPending} onClick={() => availabilityMutation.mutate()}><Plus className="h-4 w-4" /> Add hours</Button></div></CardContent></Card>
      <Card className={cn('border-brand/20 bg-brand-soft/10', captainMode && 'border-danger/40 bg-danger-soft/20')}>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand flex items-center gap-2"><Radio className="h-4 w-4" /> Day-of Command Center Mode</h2>
              <p className="text-xs text-fg-muted mt-1">Mobile-first staff operations: what to do now, coverage heatmap, incident reporting, shift calendar, and offline/PWA guidance.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={captainMode ? 'default' : 'outline'} onClick={() => setCaptainMode(!captainMode)}><ShieldAlert className="h-4 w-4" /> {captainMode ? 'Captain mode on' : 'Captain mode'}</Button>
              <Button size="sm" variant="outline" onClick={() => setSetupWizardOpen(true)}><Settings2 className="h-4 w-4" /> Staff setup wizard</Button>
              <Button size="sm" variant="outline" onClick={() => setIncidentOpen(true)}><AlertTriangle className="h-4 w-4" /> Report incident</Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StaffMiniMetric title="What to do now" value={whatNowQueue.length} detail={whatNowQueue.length ? 'Open queued items below for priority work.' : 'No urgent tasks'} />
            <StaffMiniMetric title="Coverage heatmap" value={`${coveragePct}%`} detail={`Active crew count: ${liveCrew}`} />
            <StaffMiniMetric title="Shift scheduling calendar" value={shifts.length} detail="scheduled shifts" />
            <StaffMiniMetric title="Push notifications" value="Ready" detail="Task changes broadcast live and can feed push subscriptions." />
            <StaffMiniMetric title="Offline mode" value="PWA" detail="If WiFi drops, keep working; queued writes retry when online." />
          </div>
          {whatNowQueue.length > 0 && (
            <div className="rounded-xl border border-border bg-surface p-3">
              <div className="text-xs font-bold text-brand mb-2">What to do now staff queue</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{whatNowQueue.map((t, idx) => <button key={t.id} onClick={() => setEditTask(t)} className="rounded-lg border border-border bg-surface-2 p-2 text-left text-xs hover:border-brand/40"><div className="font-bold text-fg line-clamp-2">Queue item {idx + 1}</div><div className="text-fg-muted mt-1">{t.priority} · {t.status}</div></button>)}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
