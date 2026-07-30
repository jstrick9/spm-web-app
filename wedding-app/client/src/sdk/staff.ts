import { api } from './client.js';
import type { SdkStaffTask } from './types.js';

export interface TaskInput {
  title: string;
  description?: string;
  phase?: 'pre-event' | 'during-event' | 'post-event';
  status?: 'not-started' | 'in-progress' | 'completed' | 'blocked';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  dueAt?: string;
  estimatedMinutes?: number;
  assigneeName?: string;
  assigneePhone?: string;
  assigneeEmail?: string;
  assignedStaff?: string[];
  assignedAreas?: string[];
  tags?: string[];
  checklist?: { id: string; label: string; completed: boolean }[];
  notes?: string;
  eventId?: string | null;
}

export interface WeeklyAvailability { id: string; staff_id: string; day_of_week: number; starts_at: string; ends_at: string; }

export const staffSdk = {
  staffingRequirements(eventId: string): Promise<{ requiredRoles: Array<'coordinator' | 'setup' | 'cleaning' | 'parking' | 'other'> }> { return api.get(`/api/events/${eventId}/staffing-requirements`); },
  setStaffingRequirements(eventId: string, requiredRoles: Array<'coordinator' | 'setup' | 'cleaning' | 'parking' | 'other'>): Promise<{ requiredRoles: string[] }> { return api.put(`/api/events/${eventId}/staffing-requirements`, { requiredRoles }); },
  calendar(orgId: string, startsAt: string, endsAt: string): Promise<{ calendar: { startsAt: string; endsAt: string; events: Array<{ id: string; title: string; start_date: string; end_date: string | null; status: string }>; shifts: any[] } }> {
    return api.get(`/api/orgs/${orgId}/staff/calendar?startsAt=${encodeURIComponent(startsAt)}&endsAt=${encodeURIComponent(endsAt)}`);
  },
  availability(orgId: string, staffId?: string): Promise<{ availability: WeeklyAvailability[] }> {
    return api.get(`/api/orgs/${orgId}/staff/availability${staffId ? `?staffId=${encodeURIComponent(staffId)}` : ''}`);
  },
  createAvailability(orgId: string, input: { staffId: string; dayOfWeek: number; startsAt: string; endsAt: string }): Promise<{ availability: WeeklyAvailability }> {
    return api.post(`/api/orgs/${orgId}/staff/availability`, input);
  },
  deleteAvailability(id: string): Promise<void> { return api.delete(`/api/staff/availability/${id}`); },
  coverage(orgId: string): Promise<{ coverage: { events: Array<{ eventId: string | null; eventTitle: string; shifts: any[]; staffCount: number; taskCount: number; blockedTaskCount: number; missingRoles: string[] }>; staff: Array<{ staffId: string; staffName: string; shiftCount: number; eventCount: number; conflictCount: number }>; conflicts: string[]; conflictDetails: Array<{ shiftId: string; conflictingShiftId: string; staffName: string; eventId: string | null; eventTitle: string; conflictingEventId: string | null; conflictingEventTitle: string }>; totalShifts: number } }> {
    return api.get(`/api/orgs/${orgId}/staff/coverage`);
  },
  listTasks(orgId: string, opts: { eventId?: string; status?: string } = {}): Promise<{ tasks: SdkStaffTask[] }> {
    const q = new URLSearchParams();
    if (opts.eventId) q.set('eventId', opts.eventId);
    if (opts.status) q.set('status', opts.status);
    const qs = q.toString();
    return api.get(`/api/orgs/${orgId}/staff/tasks${qs ? `?${qs}` : ''}`);
  },
  createTask(orgId: string, input: TaskInput): Promise<{ task: SdkStaffTask }> {
    return api.post(`/api/orgs/${orgId}/staff/tasks`, input);
  },
  updateTask(taskId: string, patch: Partial<TaskInput>): Promise<{ task: SdkStaffTask }> {
    return api.patch(`/api/staff/tasks/${taskId}`, patch);
  },
  deleteTask(taskId: string): Promise<void> {
    return api.delete(`/api/staff/tasks/${taskId}`);
  },
  listShifts(orgId: string, opts: { eventId?: string } = {}): Promise<{ shifts: any[] }> {
    const qs = opts.eventId ? `?eventId=${encodeURIComponent(opts.eventId)}` : '';
    return api.get(`/api/orgs/${orgId}/staff/shifts${qs}`);
  },
  createShift(orgId: string, input: { staffId: string; areaId?: string; role?: string; startsAt: string; endsAt: string; notes?: string; eventId?: string; contactName?: string; contactPhone?: string; contactEmail?: string; radioChannel?: string; handoffNotes?: string; availabilityOverrideReason?: string }): Promise<{ shift: any }> {
    return api.post(`/api/orgs/${orgId}/staff/shifts`, input);
  },
  updateShift(shiftId: string, patch: { contactName?: string; contactPhone?: string; contactEmail?: string; radioChannel?: string; handoffNotes?: string; notes?: string }): Promise<{ shift: any }> {
    return api.patch(`/api/staff/shifts/${shiftId}`, patch);
  },
  deleteShift(shiftId: string): Promise<void> {
    return api.delete(`/api/staff/shifts/${shiftId}`);
  },
  clockInShift(shiftId: string): Promise<{ shift: any }> {
    return api.post(`/api/staff/shifts/${shiftId}/clock-in`, {});
  },
  clockOutShift(shiftId: string): Promise<{ shift: any }> {
    return api.post(`/api/staff/shifts/${shiftId}/clock-out`, {});
  }
};
