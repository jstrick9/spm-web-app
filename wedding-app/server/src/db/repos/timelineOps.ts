import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';

export type TimelineApprovalRole = 'manager' | 'owner' | 'planner';
export type TimelineApprovalStatus = 'not_started' | 'requested' | 'approved' | 'changes_requested';
export type TimelineIncidentSeverity = 'info' | 'delay' | 'incident' | 'critical';
export type TimelineIncidentStatus = 'open' | 'monitoring' | 'resolved';
export type TimelineAudience = 'venue_staff' | 'vendors' | 'couple' | 'planner';
export type TimelineReminderChannel = 'in_app' | 'sms' | 'email';
export type TimelineReminderStatus = 'queued' | 'sent' | 'cancelled';

export interface TimelineChangeLogRow {
  id: string;
  organization_id: string;
  event_id: string;
  timeline_item_id: string | null;
  change_type: string;
  summary: string;
  payload: string;
  created_by: string | null;
  created_at: string;
}

export interface TimelineApprovalRow {
  id: string;
  organization_id: string;
  event_id: string;
  role: TimelineApprovalRole;
  status: TimelineApprovalStatus;
  note: string | null;
  requested_by: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimelineIncidentRow {
  id: string;
  organization_id: string;
  event_id: string;
  timeline_item_id: string | null;
  severity: TimelineIncidentSeverity;
  note: string;
  status: TimelineIncidentStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimelineReminderRow {
  id: string;
  organization_id: string;
  event_id: string;
  timeline_item_id: string | null;
  remind_at: string;
  channel: TimelineReminderChannel;
  audience: TimelineAudience;
  status: TimelineReminderStatus;
  payload: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventOfflinePacketRow {
  id: string;
  organization_id: string;
  event_id: string;
  audience: TimelineAudience;
  payload: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const timelineOpsRepo = {
  listForEvent(eventId: string) {
    return {
      approvals: db.prepare(`SELECT * FROM timeline_approvals WHERE event_id = ? ORDER BY role`).all(eventId) as TimelineApprovalRow[],
      changeLogs: db.prepare(`SELECT * FROM timeline_change_logs WHERE event_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`).all(eventId) as TimelineChangeLogRow[],
      incidents: db.prepare(`SELECT * FROM timeline_incidents WHERE event_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`).all(eventId) as TimelineIncidentRow[],
      reminders: db.prepare(`SELECT * FROM timeline_reminders WHERE event_id = ? ORDER BY remind_at ASC, id ASC LIMIT 200`).all(eventId) as TimelineReminderRow[],
      offlinePackets: db.prepare(`SELECT * FROM event_offline_packets WHERE event_id = ? ORDER BY audience`).all(eventId) as EventOfflinePacketRow[],
    };
  },

  addChangeLog(orgId: string, eventId: string, input: { timelineItemId?: string | null; changeType: string; summary: string; payload?: Record<string, unknown>; createdBy?: string | null }): TimelineChangeLogRow {
    const id = uuid();
    db.prepare(`INSERT INTO timeline_change_logs (id, organization_id, event_id, timeline_item_id, change_type, summary, payload, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, orgId, eventId, input.timelineItemId ?? null, input.changeType, input.summary, stringifyJson(input.payload ?? {}), input.createdBy ?? null,
    );
    return db.prepare(`SELECT * FROM timeline_change_logs WHERE id = ?`).get(id) as TimelineChangeLogRow;
  },

  upsertApproval(orgId: string, eventId: string, input: { role: TimelineApprovalRole; status: TimelineApprovalStatus; note?: string; actorId?: string | null }): TimelineApprovalRow {
    const existing = db.prepare(`SELECT * FROM timeline_approvals WHERE event_id = ? AND role = ?`).get(eventId, input.role) as TimelineApprovalRow | undefined;
    const approvedBy = input.status === 'approved' ? input.actorId ?? null : existing?.approved_by ?? null;
    if (existing) {
      db.prepare(`UPDATE timeline_approvals SET status = ?, note = ?, requested_by = ?, approved_by = ?, updated_at = datetime('now') WHERE id = ?`).run(
        input.status, input.note ?? existing.note, input.actorId ?? existing.requested_by, approvedBy, existing.id,
      );
      return db.prepare(`SELECT * FROM timeline_approvals WHERE id = ?`).get(existing.id) as TimelineApprovalRow;
    }
    const id = uuid();
    db.prepare(`INSERT INTO timeline_approvals (id, organization_id, event_id, role, status, note, requested_by, approved_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, orgId, eventId, input.role, input.status, input.note ?? null, input.actorId ?? null, approvedBy,
    );
    return db.prepare(`SELECT * FROM timeline_approvals WHERE id = ?`).get(id) as TimelineApprovalRow;
  },

  addIncident(orgId: string, eventId: string, input: { timelineItemId?: string | null; severity?: TimelineIncidentSeverity; note: string; status?: TimelineIncidentStatus; createdBy?: string | null }): TimelineIncidentRow {
    const id = uuid();
    db.prepare(`INSERT INTO timeline_incidents (id, organization_id, event_id, timeline_item_id, severity, note, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, orgId, eventId, input.timelineItemId ?? null, input.severity ?? 'info', input.note, input.status ?? 'open', input.createdBy ?? null,
    );
    return db.prepare(`SELECT * FROM timeline_incidents WHERE id = ?`).get(id) as TimelineIncidentRow;
  },

  addReminder(orgId: string, eventId: string, input: { timelineItemId?: string | null; remindAt: string; channel?: TimelineReminderChannel; audience?: TimelineAudience; status?: TimelineReminderStatus; payload?: Record<string, unknown>; createdBy?: string | null }): TimelineReminderRow {
    const id = uuid();
    db.prepare(`INSERT INTO timeline_reminders (id, organization_id, event_id, timeline_item_id, remind_at, channel, audience, status, payload, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, orgId, eventId, input.timelineItemId ?? null, input.remindAt, input.channel ?? 'in_app', input.audience ?? 'venue_staff', input.status ?? 'queued', stringifyJson(input.payload ?? {}), input.createdBy ?? null,
    );
    return db.prepare(`SELECT * FROM timeline_reminders WHERE id = ?`).get(id) as TimelineReminderRow;
  },

  upsertOfflinePacket(orgId: string, eventId: string, input: { audience: TimelineAudience; payload: Record<string, unknown>; createdBy?: string | null }): EventOfflinePacketRow {
    const existing = db.prepare(`SELECT * FROM event_offline_packets WHERE event_id = ? AND audience = ?`).get(eventId, input.audience) as EventOfflinePacketRow | undefined;
    if (existing) {
      db.prepare(`UPDATE event_offline_packets SET payload = ?, created_by = ?, updated_at = datetime('now') WHERE id = ?`).run(stringifyJson(input.payload), input.createdBy ?? existing.created_by, existing.id);
      return db.prepare(`SELECT * FROM event_offline_packets WHERE id = ?`).get(existing.id) as EventOfflinePacketRow;
    }
    const id = uuid();
    db.prepare(`INSERT INTO event_offline_packets (id, organization_id, event_id, audience, payload, created_by) VALUES (?, ?, ?, ?, ?, ?)`).run(
      id, orgId, eventId, input.audience, stringifyJson(input.payload), input.createdBy ?? null,
    );
    return db.prepare(`SELECT * FROM event_offline_packets WHERE id = ?`).get(id) as EventOfflinePacketRow;
  },
};
