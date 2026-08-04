import React, { useState, useMemo } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle, Clock, Info, Plus, MoreVertical, Trash2, Edit2, CheckCircle2, Circle, Sparkles, Move, ShieldCheck, Network, Users, CalendarDays, Bell, Phone, MessageSquare, Download, Radio, GitCompare, ClipboardCheck, UserPlus, FileText, CloudOff, Siren, Send, Printer } from 'lucide-react';
import type { SdkStaffTask, SdkTimelineItem, SdkVendor } from '../../../sdk/types';
import type { EventReadiness, ReadinessSeverity } from '../../../sdk/timeline';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../ui/Card';
import { Skeleton } from '../../../ui/Skeleton';
import { Badge } from '../../../ui/Badge';
import { format, parseISO } from 'date-fns';

import { ManagerTimelineState, TimelineDiffEntry, TimelineAudience, ApprovalStatus, timelineMetadata, plainLanguageIssue, approvalLabel } from './timelineState';

export function ManagerTimelineCommandCenter({
  items,
  vendors,
  staffTasks,
  readiness,
  managerState,
  snapshotDiff,
  audienceView,
  commandText,
  onAudienceViewChange,
  onCommandTextChange,
  onRecordCommand,
  onSaveOffline,
  onSaveSnapshot,
  onSetApproval,
}: {
  items: SdkTimelineItem[];
  vendors: SdkVendor[];
  staffTasks: SdkStaffTask[];
  readiness?: EventReadiness;
  managerState: ManagerTimelineState;
  snapshotDiff: TimelineDiffEntry[];
  audienceView: TimelineAudience;
  commandText: string;
  onAudienceViewChange: (view: TimelineAudience) => void;
  onCommandTextChange: (value: string) => void;
  onRecordCommand: () => void;
  onSaveOffline: () => void;
  onSaveSnapshot: () => void;
  onSetApproval: (field: keyof Pick<ManagerTimelineState, 'managerApprovalStatus' | 'ownerApprovalStatus' | 'plannerApprovalStatus'>, status: ApprovalStatus) => void;
}) {
  const now = Date.now();
  const missingAssignments = items.filter(item => !item.vendor_id && !item.assigned_to && !timelineMetadata(item).assignedContactName);
  const lateItems = items.filter(item => item.completed !== 1 && new Date(item.starts_at).getTime() < now);
  const reviewChecks = [
    { label: 'At least one timeline item exists', complete: items.length > 0 },
    { label: 'Critical readiness issues resolved or explained', complete: !readiness?.issues?.some(i => i.severity === 'critical') },
    { label: 'Timeline items have owners/vendors/contacts', complete: missingAssignments.length === 0 },
    { label: 'No currently late timeline items', complete: lateItems.length === 0 },
    { label: 'Manager has approved final run of show', complete: managerState.managerApprovalStatus === 'approved' },
    { label: 'Owner/planner approval requested or approved', complete: managerState.ownerApprovalStatus !== 'not_started' || managerState.plannerApprovalStatus !== 'not_started' },
  ];
  const readinessScore = Math.round((reviewChecks.filter(check => check.complete).length / reviewChecks.length) * 100);
  const audienceItems = filterAudienceItems(items, audienceView);
  const reminders = buildDayOfReminders(items);
  const dependencyRows = buildDependencyRows(items);

  return (
    <div className="space-y-4 print:hidden">
      <Card className="border-brand/20 bg-brand-soft/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-brand" /> Manager timeline readiness review</CardTitle>
          <CardDescription>Guided review for a first-time venue manager before approving the final run of show.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant={readinessScore >= 85 ? 'success' : readinessScore >= 60 ? 'warning' : 'danger'}>{readinessScore}% ready</Badge>
              <span className="text-xs font-semibold text-fg-muted">{items.length} items · {missingAssignments.length} unassigned · {lateItems.length} late</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {reviewChecks.map(check => (
                <div key={check.label} className="rounded-lg border border-border bg-surface p-3 text-xs font-semibold flex gap-2">
                  {check.complete ? <CheckCircle className="h-4 w-4 text-success shrink-0" /> : <AlertTriangle className="h-4 w-4 text-warning shrink-0" />}
                  <span>{check.label}</span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="text-xs font-bold text-brand flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Plain-language conflict explanation</div>
              {readiness?.issues?.length ? (
                <ul className="mt-2 space-y-1 text-xs text-fg-muted">
                  {readiness.issues.slice(0, 4).map(issue => <li key={issue.id}>• {plainLanguageIssue(issue)}</li>)}
                </ul>
              ) : <p className="mt-2 text-xs text-fg-muted">No current timeline/layout conflicts detected. Keep this review open while making final day-of changes.</p>}
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="text-xs font-bold text-brand flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Final run-of-show approval</div>
              <div className="mt-3 grid gap-2 text-xs">
                <ApprovalRow label="Manager" status={managerState.managerApprovalStatus} onRequest={() => onSetApproval('managerApprovalStatus', 'approved')} actionLabel="Approve" />
                <ApprovalRow label="Owner" status={managerState.ownerApprovalStatus} onRequest={() => onSetApproval('ownerApprovalStatus', managerState.ownerApprovalStatus === 'approved' ? 'changes_requested' : 'requested')} actionLabel={managerState.ownerApprovalStatus === 'approved' ? 'Request changes' : 'Request'} />
                <ApprovalRow label="Planner" status={managerState.plannerApprovalStatus} onRequest={() => onSetApproval('plannerApprovalStatus', managerState.plannerApprovalStatus === 'approved' ? 'changes_requested' : 'requested')} actionLabel={managerState.plannerApprovalStatus === 'approved' ? 'Request changes' : 'Request'} />
              </div>
              {managerState.approvalUpdatedAt && <p className="mt-2 text-[11px] text-fg-muted">Updated {format(parseISO(managerState.approvalUpdatedAt), 'MMM d, h:mm a')}</p>}
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="text-xs font-bold text-brand flex items-center gap-2"><CloudOff className="h-4 w-4" /> Offline day-of mobile fallback</div>
              <p className="mt-1 text-xs text-fg-muted">Cache this run of show on the current device so a manager can still view it if Wi‑Fi drops.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={onSaveOffline}><Download className="h-4 w-4" /> Make visible offline</Button>
              {managerState.offlineSyncedAt && <p className="mt-2 text-[11px] text-success font-semibold">Cached {format(parseISO(managerState.offlineSyncedAt), 'MMM d, h:mm a')}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Radio className="h-4 w-4 text-brand" /> Live timeline command mode</CardTitle>
            <CardDescription>Record day-of changes, delays, and incident annotations from one field.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <textarea value={commandText} onChange={e => onCommandTextChange(e.target.value)} placeholder="Example: incident DJ soundcheck delayed 10 minutes" className="min-h-[92px] w-full rounded-lg border border-border bg-surface p-3 text-sm" />
            <Button size="sm" onClick={onRecordCommand}><Send className="h-4 w-4" /> Record command</Button>
            <div className="space-y-2">
              {(managerState.commandLog || []).slice(0, 3).map(entry => <div key={`${entry.at}-${entry.command}`} className="rounded-lg bg-surface-2 p-2 text-[11px] text-fg-muted"><strong>{format(parseISO(entry.at), 'h:mm a')}:</strong> {entry.command}</div>)}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><GitCompare className="h-4 w-4 text-brand" /> What changed since yesterday?</CardTitle>
            <CardDescription>Diff viewer against the last saved manager snapshot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button size="sm" variant="outline" onClick={onSaveSnapshot}><GitCompare className="h-4 w-4" /> Save current snapshot</Button>
            {managerState.lastSnapshot && <p className="text-[11px] text-fg-muted">Baseline saved {format(parseISO(managerState.lastSnapshot.savedAt), 'MMM d, h:mm a')}</p>}
            {snapshotDiff.length ? (
              <ul className="space-y-2 text-xs">
                {snapshotDiff.slice(0, 5).map(diff => <li key={`${diff.type}-${diff.id}`} className="rounded-lg border border-border bg-surface p-2"><Badge variant={diff.type === 'removed' ? 'danger' : diff.type === 'added' ? 'success' : 'warning'} className="mr-2">{diff.type}</Badge><strong>{diff.label}</strong><div className="mt-1 text-fg-muted">{diff.detail}</div></li>)}
              </ul>
            ) : <p className="text-xs text-fg-muted">No saved snapshot yet, or no timeline changes since the last snapshot.</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Printer className="h-4 w-4 text-brand" /> Audience print / phone views</CardTitle>
            <CardDescription>Switch manager previews for staff, vendors, couple, and planner.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <select value={audienceView} onChange={e => onAudienceViewChange(e.target.value as TimelineAudience)} className="w-full rounded-lg border border-border bg-surface p-2 text-sm font-semibold">
              <option value="venue_staff">Venue staff</option>
              <option value="vendors">Vendors</option>
              <option value="couple">Couple</option>
              <option value="planner">Planner</option>
            </select>
            <div className="rounded-lg border border-border bg-surface p-3 text-xs space-y-2 max-h-48 overflow-auto">
              {audienceItems.slice(0, 6).map(item => <div key={item.id} className="flex justify-between gap-2"><span className="font-semibold">{format(parseISO(item.starts_at), 'h:mm a')}</span><span className="flex-1">{item.title}</span></div>)}
              {audienceItems.length === 0 && <p className="text-fg-muted">No audience-specific items yet.</p>}
            </div>
            <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print selected view</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Network className="h-4 w-4 text-brand" /> Manager dependency map</CardTitle>
            <CardDescription>Plain dependency chain for handoffs a manager needs to watch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {dependencyRows.map(row => <div key={row} className="rounded-lg border border-border bg-surface p-2">{row}</div>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4 text-brand" /> Automated day-of reminders</CardTitle>
            <CardDescription>Reminder schedule derived from the timeline for staff/vendor nudges.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {reminders.slice(0, 6).map(reminder => <div key={`${reminder.when}-${reminder.label}`} className="rounded-lg border border-border bg-surface p-2"><strong>{format(parseISO(reminder.when), 'MMM d, h:mm a')}</strong> — {reminder.label}</div>)}
            {reminders.length === 0 && <p className="text-fg-muted">Add timeline items to generate reminders.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function ApprovalRow({ label, status, onRequest, actionLabel }: { label: string; status: ApprovalStatus; onRequest: () => void; actionLabel: string }) {
  return <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 p-2"><span className="font-bold">{label}</span><Badge variant={status === 'approved' ? 'success' : status === 'changes_requested' ? 'danger' : status === 'requested' ? 'warning' : 'outline'}>{approvalLabel(status)}</Badge><Button size="xs" variant="outline" onClick={onRequest}>{actionLabel}</Button></div>;
}

export function ManagerTimelineItemActions({ item, vendors, staffTasks, onUpdateMetadata, onRecordIncident, onQueueReminder }: { item: SdkTimelineItem; vendors: SdkVendor[]; staffTasks: SdkStaffTask[]; onUpdateMetadata: (item: SdkTimelineItem, patch: Record<string, any>, action: string, extraPatch?: Record<string, any>) => void; onRecordIncident: (item: SdkTimelineItem, note: string, severity?: 'info' | 'delay' | 'incident' | 'critical') => void; onQueueReminder: (item: SdkTimelineItem) => void }) {
  const meta = timelineMetadata(item);
  const [manualName, setManualName] = useState(meta.assignedContactName || '');
  const [manualPhone, setManualPhone] = useState(meta.assignedContactPhone || '');
  const assignedVendor = vendors.find(v => v.id === item.vendor_id || v.id === meta.assignedVendorId);
  const assignedStaffTask = staffTasks.find(task => task.id === meta.assignedStaffTaskId || task.assignee_name === item.assigned_to || task.title === item.assigned_to);
  const assignedName = assignedVendor?.name || assignedStaffTask?.assignee_name || assignedStaffTask?.title || meta.assignedContactName || item.assigned_to;
  const phone = assignedVendor?.phone || assignedStaffTask?.assignee_phone || meta.assignedContactPhone;
  const isLate = item.completed !== 1 && new Date(item.starts_at).getTime() < Date.now();
  const incidents = Array.isArray(meta.incidentAnnotations) ? meta.incidentAnnotations : [];

  const handleAssignmentChange = (value: string) => {
    if (!value) return;
    const [kind, id] = value.split(':');
    if (kind === 'vendor') {
      const vendor = vendors.find(v => v.id === id);
      onUpdateMetadata(item, { assignedVendorId: id, assignedContactName: vendor?.name, assignedContactPhone: vendor?.phone }, 'timeline-vendor-assigned', { vendorId: id });
    }
    if (kind === 'staff') {
      const task = staffTasks.find(t => t.id === id);
      onUpdateMetadata(item, { assignedStaffTaskId: id, assignedContactName: task?.assignee_name || task?.title, assignedContactPhone: task?.assignee_phone }, 'timeline-staff-assigned', { assignedTo: task?.assignee_name || task?.title || id });
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-brand/20 bg-brand-soft/5 p-3 space-y-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-brand">
        <UserPlus className="h-3.5 w-3.5" /> Manager assignment & day-of controls
        {isLate && <Badge variant="danger" className="text-[10px]"><Siren className="h-3 w-3 mr-1" /> Late item</Badge>}
        {assignedName && <Badge variant="outline" className="text-[10px]">Assigned: {assignedName}</Badge>}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <select className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs" defaultValue="" onChange={e => handleAssignmentChange(e.target.value)} aria-label={`Assign ${item.title}`}>
          <option value="">Assign vendor or staff…</option>
          {vendors.map(v => <option key={v.id} value={`vendor:${v.id}`}>Vendor: {v.name}</option>)}
          {staffTasks.map(t => <option key={t.id} value={`staff:${t.id}`}>Staff: {t.assignee_name || t.title}</option>)}
        </select>
        <div className="flex gap-1">
          {phone ? <a className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs font-bold text-brand" href={`tel:${phone}`}><Phone className="inline h-3.5 w-3.5 mr-1" />Call</a> : null}
          {phone ? <a className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs font-bold text-brand" href={`sms:${phone}`}><MessageSquare className="inline h-3.5 w-3.5 mr-1" />SMS</a> : null}
          <Button size="xs" variant="outline" onClick={() => onUpdateMetadata(item, { lateMode: true }, 'timeline-late-mode')}>Mark late</Button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input value={manualName} onChange={e => setManualName(e.target.value)} className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs" placeholder="Manual contact name" />
        <input value={manualPhone} onChange={e => setManualPhone(e.target.value)} className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs" placeholder="Manual phone" />
        <Button size="xs" variant="outline" onClick={() => onUpdateMetadata(item, { assignedContactName: manualName, assignedContactPhone: manualPhone }, 'timeline-manual-contact-assigned', { assignedTo: manualName || undefined })}>Save contact</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="xs" variant="outline" onClick={() => { onUpdateMetadata(item, { incidentAnnotations: [...incidents, { note: `Incident noted for ${item.title}`, at: new Date().toISOString(), severity: 'incident' }] }, 'timeline-incident-annotated'); onRecordIncident(item, `Incident noted for ${item.title}`, 'incident'); }}><FileText className="h-3.5 w-3.5" /> Add incident annotation</Button>
        <Button size="xs" variant="outline" onClick={() => { onUpdateMetadata(item, { reminderQueued: true, reminderQueuedAt: new Date().toISOString() }, 'timeline-reminder-queued'); onQueueReminder(item); }}><Bell className="h-3.5 w-3.5" /> Queue reminder</Button>
      </div>
      {incidents.length > 0 && <p className="text-[11px] text-warning font-semibold">{incidents.length} incident / delay annotation(s) recorded for this item.</p>}
    </div>
  );
}

export function filterAudienceItems(items: SdkTimelineItem[], audience: TimelineAudience) {
  if (audience === 'vendors') return items.filter(item => ['vendor_arrival', 'load_in', 'load_out', 'other'].includes((item.category || '').toLowerCase()) || !!item.vendor_id);
  if (audience === 'couple') return items.filter(item => !['vendor_arrival', 'load_out', 'prep'].includes((item.category || '').toLowerCase()));
  if (audience === 'planner') return items;
  return items;
}

export function buildDayOfReminders(items: SdkTimelineItem[]) {
  return items.flatMap(item => {
    const start = new Date(item.starts_at).getTime();
    return [
      { when: new Date(start - 24 * 60 * 60_000).toISOString(), label: `24-hour reminder: ${item.title}` },
      { when: new Date(start - 30 * 60_000).toISOString(), label: `30-minute cue: ${item.title}` },
    ];
  }).sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime());
}

export function buildDependencyRows(items: SdkTimelineItem[]) {
  if (items.length === 0) return ['No dependency map yet. Add ceremony/reception/vendor milestones to build handoffs.'];
  const rows: string[] = [];
  for (let index = 0; index < items.length - 1; index += 1) {
    rows.push(`${format(parseISO(items[index].starts_at), 'h:mm a')} ${items[index].title} → ${format(parseISO(items[index + 1].starts_at), 'h:mm a')} ${items[index + 1].title}`);
  }
  return rows.slice(0, 8);
}

export type TimelineTemplateId = 'traditional' | 'micro' | 'ceremony_only' | 'reception_only' | 'full_weekend';

export const TIMELINE_TEMPLATES: Record<TimelineTemplateId, { label: string; desc: string; items: Array<{ title: string; category: string; offsetMin: number; durationMin: number; notes?: string }> }> = {
  traditional: { label: 'Traditional wedding', desc: 'Full ceremony, cocktail hour, dinner, dances, and send-off.', items: [
    { title: 'Vendor load-in begins', category: 'vendor_arrival', offsetMin: 0, durationMin: 60, notes: 'Dock/gate opens for vendors.' },
    { title: 'DJ soundcheck', category: 'vendor_arrival', offsetMin: 90, durationMin: 30, notes: 'Complete before ceremony and reception audio.' },
    { title: 'Ceremony', category: 'ceremony', offsetMin: 180, durationMin: 30 },
    { title: 'Family photos', category: 'photography', offsetMin: 220, durationMin: 45 },
    { title: 'Cocktail hour', category: 'cocktail', offsetMin: 225, durationMin: 60 },
    { title: 'Grand entrance', category: 'reception', offsetMin: 295, durationMin: 15 },
    { title: 'Dinner service', category: 'reception', offsetMin: 315, durationMin: 60 },
    { title: 'Dancing / reception', category: 'reception', offsetMin: 390, durationMin: 150 },
    { title: 'Vendor teardown / load-out', category: 'load_out', offsetMin: 560, durationMin: 90 },
  ] },
  micro: { label: 'Micro wedding', desc: 'Shorter guest count, focused ceremony and dinner flow.', items: [
    { title: 'Vendor arrival', category: 'vendor_arrival', offsetMin: 60, durationMin: 45 },
    { title: 'Ceremony', category: 'ceremony', offsetMin: 150, durationMin: 25 },
    { title: 'Portrait photos', category: 'photography', offsetMin: 180, durationMin: 30 },
    { title: 'Dinner', category: 'reception', offsetMin: 230, durationMin: 75 },
    { title: 'Teardown', category: 'load_out', offsetMin: 330, durationMin: 45 },
  ] },
  ceremony_only: { label: 'Ceremony-only', desc: 'Arrival, ceremony, photos, and departure.', items: [
    { title: 'Vendor arrival', category: 'vendor_arrival', offsetMin: 60, durationMin: 30 },
    { title: 'Ceremony', category: 'ceremony', offsetMin: 120, durationMin: 30 },
    { title: 'Photos', category: 'photography', offsetMin: 155, durationMin: 45 },
    { title: 'Guest departure', category: 'other', offsetMin: 210, durationMin: 30 },
  ] },
  reception_only: { label: 'Reception-only', desc: 'Dinner, speeches, dancing, and teardown.', items: [
    { title: 'Catering setup', category: 'vendor_arrival', offsetMin: 60, durationMin: 60 },
    { title: 'DJ soundcheck', category: 'vendor_arrival', offsetMin: 100, durationMin: 30 },
    { title: 'Grand entrance', category: 'reception', offsetMin: 180, durationMin: 15 },
    { title: 'Dinner service', category: 'reception', offsetMin: 200, durationMin: 60 },
    { title: 'Dancing / reception', category: 'reception', offsetMin: 280, durationMin: 150 },
    { title: 'Teardown', category: 'load_out', offsetMin: 450, durationMin: 90 },
  ] },
  full_weekend: { label: 'Full weekend', desc: 'Weekend sub-events plus wedding day anchor milestones.', items: [
    { title: 'Rehearsal dinner', category: 'reception', offsetMin: 0, durationMin: 120 },
    { title: 'Wedding vendor load-in', category: 'vendor_arrival', offsetMin: 18 * 60, durationMin: 90 },
    { title: 'Ceremony', category: 'ceremony', offsetMin: 21 * 60, durationMin: 30 },
    { title: 'Reception', category: 'reception', offsetMin: 23 * 60, durationMin: 240 },
    { title: 'Farewell brunch', category: 'reception', offsetMin: 42 * 60, durationMin: 120 },
  ] },
};

export function TimelineTemplatePanel({ onApply, busyTemplate }: { onApply: (id: TimelineTemplateId) => void; busyTemplate: string | null }) {
  return <Card><CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-brand" /> Timeline templates & AI-style generator</CardTitle><CardDescription>Choose a proven owner-friendly run-of-show template. These are deterministic now and ready for future AI generation.</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{(Object.keys(TIMELINE_TEMPLATES) as TimelineTemplateId[]).map(id => <button key={id} type="button" onClick={() => onApply(id)} disabled={!!busyTemplate} className="rounded-lg border border-border bg-surface-2 p-3 text-left hover:border-brand/40 disabled:opacity-60"><div className="text-xs font-bold text-brand">{TIMELINE_TEMPLATES[id].label}</div><p className="mt-1 text-[11px] text-fg-muted leading-relaxed">{TIMELINE_TEMPLATES[id].desc}</p><div className="mt-2 text-[10px] font-bold uppercase text-fg-subtle">{busyTemplate === id ? 'Adding…' : `${TIMELINE_TEMPLATES[id].items.length} items`}</div></button>)}</CardContent></Card>;
}

export function TimelineIntelligencePanels({ items }: { items: SdkTimelineItem[] }) {
  const phases = ['prep','ceremony','cocktail','reception','load_out'];
  const phaseCounts = phases.map(p => ({ p, n: items.filter(i => (i.category || '').toLowerCase().includes(p.replace('_','')) || (i.category || '').toLowerCase() === p).length }));
  const vendorLoad = items.filter(i => ['vendor_arrival','load_in','load_out'].includes((i.category || '').toLowerCase()));
  const reminders = items.slice(0, 5).map(i => ({ title: i.title, at: new Date(new Date(i.starts_at).getTime() - 24 * 60 * 60_000).toISOString() }));
  return (
    <div className="grid gap-4 lg:grid-cols-4">
      <MiniTimelinePanel title="Timeline dependency graph" icon={<Network className="h-4 w-4" />} value={`${items.length} nodes`} desc="Ceremony, reception, vendor, photo, catering, and teardown dependencies are scanned for warnings." />
      <MiniTimelinePanel title="Staff assignment coverage heatmap" icon={<Users className="h-4 w-4" />} value={`${phaseCounts.filter(p => p.n > 0).length}/${phases.length}`} desc={phaseCounts.map(p => `${p.p}: ${p.n}`).join(' · ')} />
      <MiniTimelinePanel title="Vendor load-in calendar" icon={<CalendarDays className="h-4 w-4" />} value={vendorLoad.length} desc={vendorLoad.length ? `${vendorLoad.length} vendor arrival/load-out window(s) scheduled.` : 'No vendor load-in windows yet.'} />
      <MiniTimelinePanel title="Automated reminder schedule" icon={<Bell className="h-4 w-4" />} value={reminders.length} desc={reminders.length ? '24-hour reminders generated from first timeline milestones.' : 'Add timeline items to generate reminders.'} />
    </div>
  );
}

export function MiniTimelinePanel({ title, icon, value, desc }: { title: string; icon: React.ReactNode; value: string | number; desc: string }) {
  return <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-xs font-bold text-brand">{icon}{title}</div><div className="mt-2 text-2xl font-bold text-fg">{value}</div><p className="mt-1 text-[11px] text-fg-muted line-clamp-3">{desc}</p></CardContent></Card>;
}

export function readinessVariant(score: number): 'success' | 'warning' | 'danger' {
  return score >= 85 ? 'success' : score >= 60 ? 'warning' : 'danger';
}

export const ISSUE_META: Record<ReadinessSeverity, { Icon: typeof Info; badge: 'danger' | 'warning' | 'info'; label: string }> = {
  critical: { Icon: AlertOctagon, badge: 'danger', label: 'Critical' },
  warning: { Icon: AlertTriangle, badge: 'warning', label: 'Warning' },
  info: { Icon: Info, badge: 'info', label: 'Info' },
};

export function ReadinessCard({ readiness, isLoading }: { readiness?: EventReadiness; isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton className="h-40 rounded-xl" aria-label="Loading event readiness" />;
  }
  if (!readiness) return null;

  return (
    <Card className="border-brand/20 bg-brand-soft/5">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" />
          Timeline & Layout Readiness
          <Badge variant={readinessVariant(readiness.score)} className="text-[10px]">
            {readiness.score}/100
          </Badge>
        </CardTitle>
        <CardDescription>
          Conflict detection for timeline overlaps, vendor coverage, seating capacity, and layout approval.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <ReadinessMetric label="Timeline" value={readiness.summary.timelineItems} />
          <ReadinessMetric label="Vendors" value={readiness.summary.vendors} />
          <ReadinessMetric label="Attending" value={readiness.summary.attendingGuests} />
          <ReadinessMetric label="Seats" value={readiness.summary.layoutSeats} />
          <ReadinessMetric label="Assigned" value={readiness.summary.assignedSeats} />
        </div>

        {readiness.issues.length === 0 ? (
          <div className="rounded-lg border border-success/30 bg-success-soft p-3 text-sm text-success flex items-center gap-2">
            <CheckCircle className="h-4 w-4" aria-hidden="true" />
            No timeline or layout readiness issues detected.
          </div>
        ) : (
          <ul className="space-y-2" aria-label="Timeline and layout readiness issues">
            {readiness.issues.slice(0, 6).map((issue) => {
              const meta = ISSUE_META[issue.severity];
              const Icon = meta.Icon;
              return (
                <li key={issue.id} className="rounded-lg border border-border bg-surface p-3 text-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={meta.badge} className="text-[10px]">
                          <Icon className="h-3 w-3 mr-1" aria-hidden="true" />
                          {meta.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">{issue.category}</Badge>
                        <a href={issue.href} className="font-semibold hover:underline">{issue.title}</a>
                      </div>
                      <p className="mt-1 text-xs text-fg-muted leading-relaxed">{issue.detail}</p>
                      <p className="mt-1 text-[11px] text-brand font-semibold">Owner explanation: {issue.ownerExplanation ?? 'This warning highlights a coordination risk to review before event day.'}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function ReadinessMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-fg-subtle font-bold">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

