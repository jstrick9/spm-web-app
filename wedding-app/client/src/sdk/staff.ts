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

export const staffSdk = {
  coverage(orgId: string): Promise<{ coverage: { events: Array<{ eventId: string | null; eventTitle: string; shifts: any[]; staffCount: number }>; staff: Array<{ staffId: string; staffName: string; shiftCount: number; eventCount: number; conflictCount: number }>; conflicts: string[]; totalShifts: number } }> {
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
  createShift(orgId: string, input: { staffId: string; areaId?: string; role?: string; startsAt: string; endsAt: string; notes?: string; eventId?: string; contactName?: string; contactPhone?: string; contactEmail?: string; radioChannel?: string; handoffNotes?: string }): Promise<{ shift: any }> {
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
