import { api } from './client.js';
import type { SdkTimelineItem } from './types.js';

export type ReadinessSeverity = 'critical' | 'warning' | 'info';
export type ReadinessCategory = 'timeline' | 'layout' | 'vendors' | 'guests' | 'staff';

export interface ReadinessIssue {
  id: string;
  severity: ReadinessSeverity;
  category: ReadinessCategory;
  title: string;
  detail: string;
  href: string;
  relatedIds: string[];
  ownerExplanation?: string;
}

export interface EventReadiness {
  eventId: string;
  score: number;
  summary: {
    timelineItems: number;
    vendors: number;
    attendingGuests: number;
    layoutSeats: number;
    assignedSeats: number;
    hasApprovedLayout: boolean;
  };
  issues: ReadinessIssue[];
}

export interface TimelineInput {
  title: string;
  category?: string;
  startsAt: string;
  endsAt?: string;
  durationMin?: number;
  location?: string;
  notes?: string;
  vendorId?: string;
  assignedTo?: string;
  metadata?: Record<string, unknown>;
}

export type TimelineApprovalStatus = 'not_started' | 'requested' | 'approved' | 'changes_requested';
export type TimelineApprovalRole = 'manager' | 'owner' | 'planner';
export type TimelineAudience = 'venue_staff' | 'vendors' | 'couple' | 'planner';
export type TimelineIncidentSeverity = 'info' | 'delay' | 'incident' | 'critical';

export interface TimelineOpsApproval {
  id: string;
  event_id: string;
  role: TimelineApprovalRole;
  status: TimelineApprovalStatus;
  note: string | null;
  updated_at: string;
}

export interface TimelineOpsChangeLog {
  id: string;
  event_id: string;
  timeline_item_id: string | null;
  change_type: string;
  summary: string;
  payload: string;
  created_at: string;
}

export interface TimelineOpsIncident {
  id: string;
  event_id: string;
  timeline_item_id: string | null;
  severity: TimelineIncidentSeverity;
  note: string;
  status: 'open' | 'monitoring' | 'resolved';
  created_at: string;
}

export interface TimelineOpsReminder {
  id: string;
  event_id: string;
  timeline_item_id: string | null;
  remind_at: string;
  channel: 'in_app' | 'sms' | 'email';
  audience: TimelineAudience;
  status: 'queued' | 'sent' | 'cancelled';
  payload: string;
}

export interface TimelineOpsOfflinePacket {
  id: string;
  event_id: string;
  audience: TimelineAudience;
  payload: string;
  updated_at: string;
}

export interface TimelineOpsState {
  approvals: TimelineOpsApproval[];
  changeLogs: TimelineOpsChangeLog[];
  incidents: TimelineOpsIncident[];
  reminders: TimelineOpsReminder[];
  offlinePackets: TimelineOpsOfflinePacket[];
}

export const timelineSdk = {
  list(eventId: string): Promise<{ items: SdkTimelineItem[] }> {
    return api.get(`/api/events/${eventId}/timeline`);
  },
  readiness(eventId: string): Promise<{ readiness: EventReadiness }> {
    return api.get(`/api/events/${eventId}/readiness`);
  },
  setupPacket(eventId: string): Promise<{ packet: { event: { title: string; startDate: string | null; guestCount: number }; layout: { id: string; name: string; revision: number } | null; timeline: Array<{ id: string; title: string; starts_at: string; location: string | null; vendor_name: string | null }>; vendorLoadIn: Array<{ id: string; name: string; category: string; loadIn: string | null }>; staffing: Array<{ full_name: string; role_key: string }> } }> { return api.get(`/api/events/${eventId}/setup-packet`); },
  coupleSchedule(eventId: string): Promise<{ schedule: Array<{ title: string; category: string; starts_at: string; ends_at: string | null; location: string | null }>; message: string }> { return api.get(`/api/events/${eventId}/couple-schedule`); },
  ops(eventId: string): Promise<{ ops: TimelineOpsState }> {
    return api.get(`/api/events/${eventId}/timeline-ops`);
  },
  setApproval(eventId: string, input: { role: TimelineApprovalRole; status: TimelineApprovalStatus; note?: string }): Promise<{ approval: TimelineOpsApproval }> {
    return api.post(`/api/events/${eventId}/timeline-ops/approval`, input);
  },
  addChangeLog(eventId: string, input: { timelineItemId?: string | null; changeType: string; summary: string; payload?: Record<string, unknown> }): Promise<{ changeLog: TimelineOpsChangeLog }> {
    return api.post(`/api/events/${eventId}/timeline-ops/change-log`, input);
  },
  addIncident(eventId: string, input: { timelineItemId?: string | null; severity?: TimelineIncidentSeverity; note: string; status?: 'open' | 'monitoring' | 'resolved' }): Promise<{ incident: TimelineOpsIncident }> {
    return api.post(`/api/events/${eventId}/timeline-ops/incident`, input);
  },
  addReminder(eventId: string, input: { timelineItemId?: string | null; remindAt: string; channel?: 'in_app' | 'sms' | 'email'; audience?: TimelineAudience; payload?: Record<string, unknown> }): Promise<{ reminder: TimelineOpsReminder }> {
    return api.post(`/api/events/${eventId}/timeline-ops/reminder`, input);
  },
  saveOfflinePacket(eventId: string, input: { audience: TimelineAudience; payload: Record<string, unknown> }): Promise<{ offlinePacket: TimelineOpsOfflinePacket }> {
    return api.post(`/api/events/${eventId}/timeline-ops/offline-packet`, input);
  },
  create(eventId: string, input: TimelineInput): Promise<{ item: SdkTimelineItem }> {
    return api.post(`/api/events/${eventId}/timeline`, input);
  },
  update(itemId: string, patch: Partial<TimelineInput & { completed: boolean }>): Promise<{ item: SdkTimelineItem }> {
    return api.patch(`/api/timeline/${itemId}`, patch);
  },
  delete(itemId: string): Promise<void> {
    return api.delete(`/api/timeline/${itemId}`);
  },
};
