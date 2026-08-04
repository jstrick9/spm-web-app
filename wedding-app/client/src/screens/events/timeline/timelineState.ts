import type { SdkStaffTask, SdkTimelineItem, SdkVendor } from '../../../sdk/types';
import type { EventReadiness, ReadinessSeverity } from '../../../sdk/timeline';
import { format, parseISO } from 'date-fns';

export type ApprovalStatus = 'not_started' | 'requested' | 'approved' | 'changes_requested';
export type TimelineAudience = 'venue_staff' | 'vendors' | 'couple' | 'planner';

export interface TimelineSnapshotItem {
  id: string;
  title: string;
  startsAt: string;
  durationMin: number | null;
  category: string;
  completed: 0 | 1;
  assignment: string;
}

export interface TimelineSnapshot {
  savedAt: string;
  items: TimelineSnapshotItem[];
}

export interface TimelineDiffEntry {
  id: string;
  type: 'added' | 'removed' | 'changed';
  label: string;
  detail: string;
}

export interface ManagerTimelineState {
  managerApprovalStatus: ApprovalStatus;
  ownerApprovalStatus: ApprovalStatus;
  plannerApprovalStatus: ApprovalStatus;
  approvalUpdatedAt?: string;
  offlineSyncedAt?: string;
  lastSnapshot?: TimelineSnapshot;
  commandLog: Array<{ command: string; at: string; targetItemId?: string }>;
}

export const DEFAULT_MANAGER_TIMELINE_STATE: ManagerTimelineState = {
  managerApprovalStatus: 'not_started',
  ownerApprovalStatus: 'not_started',
  plannerApprovalStatus: 'not_started',
  commandLog: [],
};

export function managerTimelineStorageKey(eventId: string) {
  return `wvi_manager_timeline_state_${eventId}`;
}

export function readManagerTimelineState(eventId: string): ManagerTimelineState {
  if (typeof window === 'undefined') return DEFAULT_MANAGER_TIMELINE_STATE;
  try {
    const raw = localStorage.getItem(managerTimelineStorageKey(eventId));
    if (!raw) return DEFAULT_MANAGER_TIMELINE_STATE;
    return { ...DEFAULT_MANAGER_TIMELINE_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_MANAGER_TIMELINE_STATE;
  }
}

export function writeManagerTimelineState(eventId: string, state: ManagerTimelineState) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(managerTimelineStorageKey(eventId), JSON.stringify(state)); } catch {}
}

export function managerStateFromTimelineOps(ops: any, eventId: string): ManagerTimelineState {
  const fallback = readManagerTimelineState(eventId);
  const approvalFor = (role: 'manager' | 'owner' | 'planner'): ApprovalStatus => ops.approvals?.find((a: any) => a.role === role)?.status || fallback[`${role}ApprovalStatus` as keyof ManagerTimelineState] || 'not_started';
  const snapshotLog = ops.changeLogs?.find((log: any) => log.change_type === 'snapshot');
  const packet = ops.offlinePackets?.[0];
  let lastSnapshot = fallback.lastSnapshot;
  try {
    if (snapshotLog?.payload) lastSnapshot = JSON.parse(snapshotLog.payload);
  } catch {}
  return {
    ...fallback,
    managerApprovalStatus: approvalFor('manager'),
    ownerApprovalStatus: approvalFor('owner'),
    plannerApprovalStatus: approvalFor('planner'),
    approvalUpdatedAt: ops.approvals?.[0]?.updated_at || fallback.approvalUpdatedAt,
    offlineSyncedAt: packet?.updated_at || fallback.offlineSyncedAt,
    lastSnapshot,
    commandLog: [
      ...(ops.changeLogs || [])
        .filter((log: any) => log.change_type === 'command')
        .map((log: any) => ({ command: log.summary, at: log.created_at, targetItemId: log.timeline_item_id || undefined })),
      ...(fallback.commandLog || []),
    ].slice(0, 20),
  };
}

export function timelineMetadata(item: SdkTimelineItem): Record<string, any> {
  if (!item.metadata) return {};
  try { return typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata; } catch { return {}; }
}

export function buildTimelineSnapshot(items: SdkTimelineItem[]): TimelineSnapshot {
  return {
    savedAt: new Date().toISOString(),
    items: items.map(item => {
      const meta = timelineMetadata(item);
      return {
        id: item.id,
        title: item.title,
        startsAt: item.starts_at,
        durationMin: item.duration_min,
        category: item.category,
        completed: item.completed,
        assignment: item.vendor_id || item.assigned_to || meta.assignedContactName || meta.assignedStaffTaskId || '',
      };
    }),
  };
}

export function compareTimelineSnapshots(previous: TimelineSnapshot | undefined, current: TimelineSnapshot): TimelineDiffEntry[] {
  if (!previous) return [];
  const before = new Map(previous.items.map(item => [item.id, item]));
  const now = new Map(current.items.map(item => [item.id, item]));
  const diff: TimelineDiffEntry[] = [];
  for (const item of current.items) {
    const old = before.get(item.id);
    if (!old) {
      diff.push({ id: item.id, type: 'added', label: item.title, detail: `${format(parseISO(item.startsAt), 'h:mm a')} was added to the run of show.` });
      continue;
    }
    const changes: string[] = [];
    if (old.title !== item.title) changes.push(`title changed from “${old.title}”`);
    if (old.startsAt !== item.startsAt) changes.push(`time moved from ${format(parseISO(old.startsAt), 'h:mm a')} to ${format(parseISO(item.startsAt), 'h:mm a')}`);
    if (old.durationMin !== item.durationMin) changes.push(`duration changed from ${old.durationMin || 0} to ${item.durationMin || 0} minutes`);
    if (old.assignment !== item.assignment) changes.push('assignment/contact changed');
    if (old.completed !== item.completed) changes.push(item.completed ? 'marked complete' : 'reopened');
    if (changes.length) diff.push({ id: item.id, type: 'changed', label: item.title, detail: changes.join('; ') });
  }
  for (const item of previous.items) {
    if (!now.has(item.id)) diff.push({ id: item.id, type: 'removed', label: item.title, detail: 'Removed from the run of show.' });
  }
  return diff;
}

export function plainLanguageIssue(issue: EventReadiness['issues'][number]) {
  const category = issue.category === 'layout' ? 'room setup' : issue.category;
  return `${issue.title}: ${issue.ownerExplanation || issue.detail || `Review this ${category} item before final approval.`}`;
}

export function approvalLabel(status: ApprovalStatus) {
  return status.replace('_', ' ');
}

