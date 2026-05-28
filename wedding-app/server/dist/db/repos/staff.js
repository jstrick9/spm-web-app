import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';
export const staffTasksRepo = {
    listForOrg(orgId, opts = {}) {
        let sql = `SELECT * FROM staff_tasks WHERE organization_id = ?`;
        const params = [orgId];
        if (opts.eventId) {
            sql += ` AND event_id = ?`;
            params.push(opts.eventId);
        }
        if (opts.status) {
            sql += ` AND status = ?`;
            params.push(opts.status);
        }
        if (opts.assignedTo) {
            // Since assigned_staff is a JSON array of strings, we can use JSON_EACH in SQLite or a LIKE query.
            // Since we just want to know if assignedTo is inside the JSON array:
            sql += ` AND EXISTS (SELECT 1 FROM json_each(assigned_staff) WHERE value = ?)`;
            params.push(opts.assignedTo);
        }
        sql += ` ORDER BY due_at IS NULL, due_at, created_at`;
        return db.prepare(sql).all(...params);
    },
    findById(id) {
        return db.prepare(`SELECT * FROM staff_tasks WHERE id = ?`).get(id);
    },
    create(orgId, createdBy, input) {
        const id = uuid();
        db.prepare(`INSERT INTO staff_tasks
         (id, organization_id, event_id, title, description, phase, status, priority,
          due_at, estimated_minutes, assigned_staff, assigned_areas, tags, checklist, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, orgId, input.eventId ?? null, input.title, input.description ?? null, input.phase ?? 'pre-event', input.status ?? 'not-started', input.priority ?? 'medium', input.dueAt ?? null, input.estimatedMinutes ?? null, stringifyJson(input.assignedStaff ?? []), stringifyJson(input.assignedAreas ?? []), stringifyJson(input.tags ?? []), stringifyJson(input.checklist ?? []), input.notes ?? null, createdBy);
        return this.findById(id);
    },
    update(id, patch) {
        const fields = [];
        const values = [];
        const scalar = {
            title: 'title', description: 'description', phase: 'phase', status: 'status',
            priority: 'priority', dueAt: 'due_at', estimatedMinutes: 'estimated_minutes',
            notes: 'notes', eventId: 'event_id',
        };
        for (const [k, col] of Object.entries(scalar)) {
            if (k in patch) {
                fields.push(`${col} = ?`);
                values.push(patch[k] ?? null);
            }
        }
        const json = {
            assignedStaff: 'assigned_staff', assignedAreas: 'assigned_areas',
            tags: 'tags', checklist: 'checklist',
        };
        for (const [k, col] of Object.entries(json)) {
            if (k in patch) {
                fields.push(`${col} = ?`);
                values.push(stringifyJson(patch[k]));
            }
        }
        // Auto-set completed_at when status flips to completed
        if (patch.status === 'completed') {
            fields.push(`completed_at = datetime('now')`);
        }
        if (fields.length === 0)
            return this.findById(id);
        values.push(id);
        db.prepare(`UPDATE staff_tasks SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
        return this.findById(id);
    },
    delete(id) {
        return db.prepare(`DELETE FROM staff_tasks WHERE id = ?`).run(id).changes > 0;
    },
};
export const staffAreasRepo = {
    listForOrg(orgId) {
        return db.prepare(`SELECT * FROM staff_areas WHERE organization_id = ? ORDER BY name`).all(orgId);
    },
    create(orgId, input) {
        const id = uuid();
        db.prepare(`INSERT INTO staff_areas (id, organization_id, venue_id, name, description, color, icon, assigned_staff)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, orgId, input.venueId ?? null, input.name, input.description ?? null, input.color ?? '#cccccc', input.icon ?? null, stringifyJson(input.assignedStaff ?? []));
        return db.prepare(`SELECT * FROM staff_areas WHERE id = ?`).get(id);
    },
    delete(id) {
        return db.prepare(`DELETE FROM staff_areas WHERE id = ?`).run(id).changes > 0;
    },
};
export const staffShiftsRepo = {
    listForOrg(orgId, opts = {}) {
        let sql = `SELECT * FROM staff_shifts WHERE organization_id = ?`;
        const params = [orgId];
        if (opts.eventId) {
            sql += ` AND event_id = ?`;
            params.push(opts.eventId);
        }
        sql += ` ORDER BY starts_at`;
        return db.prepare(sql).all(...params);
    },
    create(orgId, input) {
        const id = uuid();
        db.prepare(`INSERT INTO staff_shifts (id, organization_id, event_id, staff_id, area_id, role, starts_at, ends_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, orgId, input.eventId ?? null, input.staffId, input.areaId ?? null, input.role ?? 'other', input.startsAt, input.endsAt, input.notes ?? null);
        return db.prepare(`SELECT * FROM staff_shifts WHERE id = ?`).get(id);
    },
    delete(id) {
        return db.prepare(`DELETE FROM staff_shifts WHERE id = ?`).run(id).changes > 0;
    },
};
//# sourceMappingURL=staff.js.map