import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { parseJson, stringifyJson } from '../../lib/json.js';

export interface StaffTaskRow {
  id: string;
  organization_id: string;
  event_id: string | null;
  title: string;
  description: string | null;
  phase: 'pre-event' | 'during-event' | 'post-event';
  status: 'not-started' | 'in-progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_at: string | null;
  estimated_minutes: number | null;
  completed_at: string | null;
  completed_by: string | null;
  assignee_name: string | null;
  assignee_phone: string | null;
  assignee_email: string | null;
  assigned_staff: string;   // JSON array
  assigned_areas: string;   // JSON array
  tags: string;             // JSON array
  checklist: string;        // JSON array
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StaffTaskInput {
  title: string;
  description?: string;
  phase?: StaffTaskRow['phase'];
  status?: StaffTaskRow['status'];
  priority?: StaffTaskRow['priority'];
  dueAt?: string;
  estimatedMinutes?: number;
  assigneeName?: string;
  assigneePhone?: string;
  assigneeEmail?: string;
  assignedStaff?: string[];
  assignedAreas?: string[];
  tags?: string[];
  checklist?: Array<{ id: string; label: string; completed: boolean }>;
  notes?: string;
  eventId?: string | null;
}

export const staffTasksRepo = {
  listForOrg(orgId: string, opts: { eventId?: string; status?: StaffTaskRow['status']; assignedTo?: string } = {}): StaffTaskRow[] {
    let sql = `SELECT * FROM staff_tasks WHERE organization_id = ?`;
    const params: unknown[] = [orgId];
    if (opts.eventId) { sql += ` AND event_id = ?`; params.push(opts.eventId); }
    if (opts.status)  { sql += ` AND status = ?`;   params.push(opts.status); }
    if (opts.assignedTo) {
      // Since assigned_staff is a JSON array of strings, we can use JSON_EACH in SQLite or a LIKE query.
      // Since we just want to know if assignedTo is inside the JSON array:
      sql += ` AND EXISTS (SELECT 1 FROM json_each(assigned_staff) WHERE value = ?)`;
      params.push(opts.assignedTo);
    }
    sql += ` ORDER BY due_at IS NULL, due_at, created_at`;
    return db.prepare(sql).all(...params) as StaffTaskRow[];
  },

  findById(id: string): StaffTaskRow | undefined {
    return db.prepare(`SELECT * FROM staff_tasks WHERE id = ?`).get(id) as StaffTaskRow | undefined;
  },

  create(orgId: string, createdBy: string, input: StaffTaskInput): StaffTaskRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO staff_tasks
         (id, organization_id, event_id, title, description, phase, status, priority,
          due_at, estimated_minutes, assignee_name, assignee_phone, assignee_email,
          assigned_staff, assigned_areas, tags, checklist, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, orgId,
      input.eventId ?? null,
      input.title,
      input.description ?? null,
      input.phase ?? 'pre-event',
      input.status ?? 'not-started',
      input.priority ?? 'medium',
      input.dueAt ?? null,
      input.estimatedMinutes ?? null,
      input.assigneeName ?? null,
      input.assigneePhone ?? null,
      input.assigneeEmail ?? null,
      stringifyJson(input.assignedStaff ?? []),
      stringifyJson(input.assignedAreas ?? []),
      stringifyJson(input.tags ?? []),
      stringifyJson(input.checklist ?? []),
      input.notes ?? null,
      createdBy,
    );
    return this.findById(id)!;
  },

  update(id: string, patch: Partial<StaffTaskInput>): StaffTaskRow | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];
    const scalar: Record<string, string> = {
      title: 'title', description: 'description', phase: 'phase', status: 'status',
      priority: 'priority', dueAt: 'due_at', estimatedMinutes: 'estimated_minutes',
      assigneeName: 'assignee_name', assigneePhone: 'assignee_phone', assigneeEmail: 'assignee_email',
      notes: 'notes', eventId: 'event_id',
    };
    for (const [k, col] of Object.entries(scalar)) {
      if (k in patch) {
        fields.push(`${col} = ?`);
        values.push((patch as Record<string, unknown>)[k] ?? null);
      }
    }
    const json: Record<string, string> = {
      assignedStaff: 'assigned_staff', assignedAreas: 'assigned_areas',
      tags: 'tags', checklist: 'checklist',
    };
    for (const [k, col] of Object.entries(json)) {
      if (k in patch) {
        fields.push(`${col} = ?`);
        values.push(stringifyJson((patch as Record<string, unknown>)[k]));
      }
    }
    // Auto-set completed_at when status flips to completed
    if (patch.status === 'completed') {
      fields.push(`completed_at = datetime('now')`);
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    db.prepare(`UPDATE staff_tasks SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  delete(id: string): boolean {
    return db.prepare(`DELETE FROM staff_tasks WHERE id = ?`).run(id).changes > 0;
  },
};

// ─── Areas ──────────────────────────────────────────────
export interface StaffAreaRow {
  id: string;
  organization_id: string;
  venue_id: string | null;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  assigned_staff: string;  // JSON array
}

export const staffAreasRepo = {
  listForOrg(orgId: string): StaffAreaRow[] {
    return db.prepare(
      `SELECT * FROM staff_areas WHERE organization_id = ? ORDER BY name`
    ).all(orgId) as StaffAreaRow[];
  },

  create(orgId: string, input: { name: string; description?: string; color?: string; icon?: string; venueId?: string; assignedStaff?: string[] }): StaffAreaRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO staff_areas (id, organization_id, venue_id, name, description, color, icon, assigned_staff)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, orgId, input.venueId ?? null, input.name, input.description ?? null,
          input.color ?? '#cccccc', input.icon ?? null,
          stringifyJson(input.assignedStaff ?? []));
    return db.prepare(`SELECT * FROM staff_areas WHERE id = ?`).get(id) as StaffAreaRow;
  },

  findById(id: string): StaffAreaRow | undefined {
    return db.prepare(`SELECT * FROM staff_areas WHERE id = ?`).get(id) as StaffAreaRow | undefined;
  },

  delete(id: string): boolean {
    return db.prepare(`DELETE FROM staff_areas WHERE id = ?`).run(id).changes > 0;
  },
};

// ─── Shifts ─────────────────────────────────────────────
export interface StaffShiftRow {
  id: string;
  organization_id: string;
  event_id: string | null;
  staff_id: string;
  area_id: string | null;
  role: 'coordinator' | 'setup' | 'cleaning' | 'parking' | 'other';
  starts_at: string;
  ends_at: string;
  notes: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  radio_channel: string | null;
  handoff_notes: string | null;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
}

export const staffShiftsRepo = {
  findById(id: string): StaffShiftRow | undefined {
    return db.prepare("SELECT * FROM staff_shifts WHERE id = ?").get(id) as StaffShiftRow | undefined;
  },

  listForOrg(orgId: string, opts: { eventId?: string } = {}): StaffShiftRow[] {
    let sql = `SELECT * FROM staff_shifts WHERE organization_id = ?`;
    const params: unknown[] = [orgId];
    if (opts.eventId) { sql += ` AND event_id = ?`; params.push(opts.eventId); }
    sql += ` ORDER BY starts_at`;
    return db.prepare(sql).all(...params) as StaffShiftRow[];
  },

  create(orgId: string, input: {
    staffId: string; areaId?: string; role?: StaffShiftRow['role'];
    startsAt: string; endsAt: string; notes?: string; eventId?: string;
    contactName?: string; contactPhone?: string; contactEmail?: string;
    radioChannel?: string; handoffNotes?: string;
  }): StaffShiftRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO staff_shifts (id, organization_id, event_id, staff_id, area_id, role, starts_at, ends_at, notes, contact_name, contact_phone, contact_email, radio_channel, handoff_notes, clocked_in_at, clocked_out_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
    ).run(id, orgId, input.eventId ?? null, input.staffId, input.areaId ?? null,
          input.role ?? 'other', input.startsAt, input.endsAt, input.notes ?? null,
          input.contactName ?? null, input.contactPhone ?? null, input.contactEmail ?? null,
          input.radioChannel ?? null, input.handoffNotes ?? null);
    return this.findById(id)!;
  },

  update(id: string, patch: Partial<{
    contactName: string; contactPhone: string; contactEmail: string;
    radioChannel: string; handoffNotes: string; notes: string;
  }>): StaffShiftRow | undefined {
    const map: Record<string, string> = {
      contactName: 'contact_name', contactPhone: 'contact_phone', contactEmail: 'contact_email',
      radioChannel: 'radio_channel', handoffNotes: 'handoff_notes', notes: 'notes',
    };
    const fields: string[] = [];
    const values: unknown[] = [];
    for (const [key, col] of Object.entries(map)) {
      if (key in patch) { fields.push(`${col} = ?`); values.push((patch as Record<string, unknown>)[key] ?? null); }
    }
    if (!fields.length) return this.findById(id);
    values.push(id);
    db.prepare(`UPDATE staff_shifts SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    return this.findById(id);
  },

  clockIn(id: string): StaffShiftRow {
    db.prepare(`UPDATE staff_shifts SET clocked_in_at = datetime('now'), clocked_out_at = NULL WHERE id = ?`).run(id);
    return this.findById(id)!;
  },

  clockOut(id: string): StaffShiftRow {
    db.prepare(`UPDATE staff_shifts SET clocked_out_at = datetime('now') WHERE id = ?`).run(id);
    return this.findById(id)!;
  },

  delete(id: string): boolean {
    return db.prepare("DELETE FROM staff_shifts WHERE id = ?").run(id).changes > 0;
  },
};
