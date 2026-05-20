import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';
export const timelineRepo = {
    listForEvent(eventId) {
        return db.prepare(`SELECT * FROM timeline_events WHERE event_id = ? ORDER BY starts_at`).all(eventId);
    },
    findById(id) {
        return db.prepare(`SELECT * FROM timeline_events WHERE id = ?`).get(id);
    },
    create(orgId, eventId, input) {
        const id = uuid();
        db.prepare(`INSERT INTO timeline_events
         (id, organization_id, event_id, title, category, starts_at, ends_at,
          duration_min, location, notes, vendor_id, assigned_to, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, orgId, eventId, input.title, input.category ?? 'other', input.startsAt, input.endsAt ?? null, input.durationMin ?? null, input.location ?? null, input.notes ?? null, input.vendorId ?? null, input.assignedTo ?? null, stringifyJson(input.metadata ?? {}));
        return this.findById(id);
    },
    update(id, patch) {
        const map = {
            title: { col: 'title' },
            category: { col: 'category' },
            startsAt: { col: 'starts_at' },
            endsAt: { col: 'ends_at' },
            durationMin: { col: 'duration_min' },
            location: { col: 'location' },
            notes: { col: 'notes' },
            vendorId: { col: 'vendor_id' },
            assignedTo: { col: 'assigned_to' },
            metadata: { col: 'metadata', json: true },
            completed: { col: 'completed', bool: true },
        };
        const fields = [];
        const values = [];
        for (const [k, v] of Object.entries(patch)) {
            const spec = map[k];
            if (!spec)
                continue;
            fields.push(`${spec.col} = ?`);
            if (spec.bool)
                values.push(v ? 1 : 0);
            else if (spec.json)
                values.push(stringifyJson(v));
            else
                values.push(v ?? null);
        }
        if (fields.length === 0)
            return this.findById(id);
        values.push(id);
        db.prepare(`UPDATE timeline_events SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
        return this.findById(id);
    },
    delete(id) {
        return db.prepare(`DELETE FROM timeline_events WHERE id = ?`).run(id).changes > 0;
    },
};
//# sourceMappingURL=timeline.js.map