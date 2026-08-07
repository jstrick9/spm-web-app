import { CheckSquare, Circle, ClipboardList, Plus, Calendar, Clock, UserCheck, ShieldAlert, Sparkles, Trash2, Shield, Eye, Settings2, SlidersHorizontal, Map, X, Bell, Download, Smartphone, Radio, AlertTriangle, Phone, MessageSquare, Mail, Users, Printer, ClipboardCheck, BarChart3, GitBranch, MapPin } from 'lucide-react';
import type { SdkStaffTask } from '../../../sdk/types';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Badge } from '../../../ui/Badge';

export function VenueManagerStaffingCommandCenter({ tasks, shifts, allShifts, members, eventId, onApplyTemplate, onPrintBrief }: {
  tasks: SdkStaffTask[];
  shifts: any[];
  allShifts: any[];
  members: any[];
  eventId: string;
  onApplyTemplate: (template: 'captain' | 'setup' | 'parking' | 'cleanup') => void;
  onPrintBrief: () => void;
}) {
  const openTasks = tasks.filter(t => t.status !== 'completed');
  const unassignedCritical = tasks.filter(t => t.priority === 'critical' && t.status !== 'completed' && (t.assigned_staff?.length || 0) === 0 && !t.assignee_name);
  const blocked = tasks.filter(t => t.status === 'blocked');
  const completed = tasks.filter(t => t.status === 'completed');
  const completionPct = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0;
  const liveAll = allShifts.filter((s: any) => s.clocked_in_at && !s.clocked_out_at);
  const liveHere = shifts.filter((s: any) => s.clocked_in_at && !s.clocked_out_at);
  const contactRows = buildCrewContactRows(tasks, shifts, members);
  const radioRows = shifts.filter((s: any) => s.radio_channel || s.contact_name || s.handoff_notes);
  const closeoutChecks = [
    { label: 'All critical incidents resolved or owner-notified', done: !tasks.some(t => t.tags?.includes?.('incident') && t.status !== 'completed') },
    { label: 'Post-event teardown tasks complete', done: !tasks.some(t => t.phase === 'post-event' && t.status !== 'completed') },
    { label: 'All on-site shifts clocked out', done: liveHere.length === 0 },
    { label: 'Handoff notes captured for next manager', done: shifts.some((s: any) => s.handoff_notes) },
  ];

  return (
    <div className="space-y-4 print:space-y-3">
      <Card className="border-brand/20 bg-brand-soft/5 print:break-inside-avoid">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4 text-brand" /> Venue manager staffing command center</CardTitle>
          <CardDescription>Roster, contacts, on-site coverage, radio channels, incidents, blockers, handoff notes, and staff completion analytics.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <StaffMiniMetric title="On site now" value={liveHere.length} detail="this event" />
            <StaffMiniMetric title="Across current events" value={liveAll.length} detail="all active clock-ins" />
            <StaffMiniMetric title="Unassigned critical" value={unassignedCritical.length} detail="needs manager assignment" />
            <StaffMiniMetric title="Blocked tasks" value={blocked.length} detail="dependency / incident blockers" />
            <StaffMiniMetric title="Completion" value={`${completionPct}%`} detail={`${completed.length}/${tasks.length} done`} />
            <StaffMiniMetric title="Crew contacts" value={contactRows.length} detail="call/SMS/email entries" />
          </div>

          {unassignedCritical.length > 0 && (
            <div className="rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
              <strong>Unassigned critical task alert:</strong> {unassignedCritical.map(t => t.title).join(' · ')}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-3">
              <h3 className="text-xs font-bold text-brand flex items-center gap-2"><Phone className="h-4 w-4" /> Crew contact directory</h3>
              <div className="mt-3 space-y-2 max-h-60 overflow-auto">
                {contactRows.length ? contactRows.slice(0, 8).map(row => <CrewContactCard key={row.key} row={row} />) : <p className="text-xs text-fg-muted">Add shift or task contact fields to build the call sheet.</p>}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3">
              <h3 className="text-xs font-bold text-brand flex items-center gap-2"><MapPin className="h-4 w-4" /> On-site roster map</h3>
              <div className="mt-3 grid gap-2">
                {shifts.map((s: any) => {
                  const name = s.contact_name || members.find((m: any) => (m.user_id || m.userId) === s.staff_id)?.fullName || members.find((m: any) => (m.user_id || m.userId) === s.staff_id)?.email || 'Crew member';
                  const live = s.clocked_in_at && !s.clocked_out_at;
                  return <div key={s.id} className="flex items-center justify-between rounded-lg border border-border bg-surface-2 p-2 text-xs"><span>{name}</span><Badge variant={live ? 'success' : 'outline'}>{live ? 'on site' : s.role}</Badge></div>;
                })}
                {shifts.length === 0 && <p className="text-xs text-fg-muted">No shifts scheduled for the roster map yet.</p>}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3">
              <h3 className="text-xs font-bold text-brand flex items-center gap-2"><Radio className="h-4 w-4" /> Radio/channel assignment tracker</h3>
              <div className="mt-3 space-y-2">
                {radioRows.length ? radioRows.map((s: any) => <div key={s.id} className="rounded-lg border border-border bg-surface-2 p-2 text-xs"><strong>{s.contact_name || 'Crew'}</strong><div className="text-fg-muted">Channel: {s.radio_channel || 'Not assigned'}{s.handoff_notes ? ` · Handoff: ${s.handoff_notes}` : ''}</div></div>) : <p className="text-xs text-fg-muted">Assign channels when scheduling shifts.</p>}
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-surface p-3">
              <h3 className="text-xs font-bold text-brand flex items-center gap-2"><Settings2 className="h-4 w-4" /> Manager-facing task templates</h3>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Button size="xs" variant="outline" onClick={() => onApplyTemplate('captain')}>Captain command</Button>
                <Button size="xs" variant="outline" onClick={() => onApplyTemplate('setup')}>Venue setup</Button>
                <Button size="xs" variant="outline" onClick={() => onApplyTemplate('parking')}>Parking/arrival</Button>
                <Button size="xs" variant="outline" onClick={() => onApplyTemplate('cleanup')}>Closeout/cleanup</Button>
              </div>
              <p className="mt-2 text-[11px] text-fg-muted">Templates are organized by venue space, event phase, and day-of responsibility.</p>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3">
              <h3 className="text-xs font-bold text-brand flex items-center gap-2"><GitBranch className="h-4 w-4" /> Dependency / blocker tracking</h3>
              <div className="mt-3 space-y-2">
                {blocked.length ? blocked.slice(0, 5).map(task => <div key={task.id} className="rounded-lg border border-warning/30 bg-warning-soft/20 p-2 text-xs text-warning"><strong>{task.title}</strong><div>{task.description || 'No blocker note yet.'}</div></div>) : <p className="text-xs text-fg-muted">No blocked dependency items right now.</p>}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-3">
              <h3 className="text-xs font-bold text-brand flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Staff performance analytics</h3>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between"><span>Completion rate</span><strong>{completionPct}%</strong></div>
                <div className="flex justify-between"><span>Blocked workload</span><strong>{blocked.length}</strong></div>
                <div className="flex justify-between"><span>Open workload</span><strong>{openTasks.length}</strong></div>
                <div className="flex justify-between"><span>Active shifts</span><strong>{liveHere.length}</strong></div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-3">
              <h3 className="text-xs font-bold text-brand flex items-center gap-2"><Smartphone className="h-4 w-4" /> Staff briefing printout / mobile brief</h3>
              <p className="mt-1 text-xs text-fg-muted">Print or screenshot this brief for captains: contacts, radio channels, blockers, incident rules, and closeout checks.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={onPrintBrief}><Printer className="h-4 w-4" /> Print staff brief</Button>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3">
              <h3 className="text-xs font-bold text-brand flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Post-event staff closeout checklist</h3>
              <div className="mt-3 grid gap-2">
                {closeoutChecks.map(check => <div key={check.label} className="flex gap-2 rounded-lg border border-border bg-surface-2 p-2 text-xs"><span className={check.done ? 'text-success' : 'text-warning'}>{check.done ? '✓' : '!'}</span><span>{check.label}</span></div>)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function buildCrewContactRows(tasks: SdkStaffTask[], shifts: any[], members: any[]) {
  const rows: Array<{ key: string; name: string; role?: string; phone?: string; email?: string; source: string }> = [];
  for (const shift of shifts) {
    const member = members.find((m: any) => (m.user_id || m.userId) === shift.staff_id);
    const name = shift.contact_name || member?.fullName || member?.email || 'Crew member';
    rows.push({ key: `shift-${shift.id}`, name, role: shift.role, phone: shift.contact_phone, email: shift.contact_email || member?.email, source: 'shift' });
  }
  for (const task of tasks) {
    if (task.assignee_name || task.assignee_phone || task.assignee_email) rows.push({ key: `task-${task.id}`, name: task.assignee_name || task.title, phone: task.assignee_phone || undefined, email: task.assignee_email || undefined, source: 'task' });
  }
  const seen = new Set<string>();
  return rows.filter(row => { const key = `${row.name}-${row.phone || ''}-${row.email || ''}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

export function CrewContactCard({ row }: { row: { name: string; role?: string; phone?: string; email?: string; source: string } }) {
  return <div className="rounded-lg border border-border bg-surface-2 p-2 text-xs"><div className="font-bold text-fg">{row.name}</div><div className="text-fg-muted">{row.role || row.source}</div><div className="mt-2 flex flex-wrap gap-1">{row.phone && <a className="rounded-md border border-border bg-white px-2 py-1 font-bold text-brand" href={`tel:${row.phone}`}>Call</a>}{row.phone && <a className="rounded-md border border-border bg-white px-2 py-1 font-bold text-brand" href={`sms:${row.phone}`}>SMS</a>}{row.email && <a className="rounded-md border border-border bg-white px-2 py-1 font-bold text-brand" href={`mailto:${row.email}`}>Email</a>}</div></div>;
}

export function StaffMiniMetric({ title, value, detail }: { title: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-[10px] uppercase tracking-wide font-bold text-fg-subtle">{title}</div>
      <div className="mt-1 text-xl font-black text-brand">{value}</div>
      <p className="mt-1 text-[11px] text-fg-muted line-clamp-2">{detail}</p>
    </div>
  );
}

