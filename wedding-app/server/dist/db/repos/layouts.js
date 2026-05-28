import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';
export const layoutsRepo = {
    findById(id) {
        return db.prepare(`SELECT * FROM layouts WHERE id = ?`).get(id);
    },
    listForOrg(orgId, opts = {}) {
        let sql = `SELECT * FROM layouts WHERE organization_id = ?`;
        const params = [orgId];
        if (opts.eventId !== undefined) {
            if (opts.eventId === '')
                sql += ` AND event_id IS NULL`;
            else {
                sql += ` AND event_id = ?`;
                params.push(opts.eventId);
            }
        }
        if (opts.isTemplate !== undefined) {
            sql += ` AND is_template = ?`;
            params.push(opts.isTemplate ? 1 : 0);
        }
        sql += ` ORDER BY updated_at DESC`;
        return db.prepare(sql).all(...params);
    },
    create(input) {
        const id = uuid();
        db.prepare(`INSERT INTO layouts
         (id, organization_id, event_id, venue_id, name, visibility,
          revision, payload, is_template, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`).run(id, input.organizationId, input.eventId ?? null, input.venueId ?? null, input.name, input.visibility ?? 'event', input.approvalStatus ?? 'draft', stringifyJson(input.payload), input.isTemplate ? 1 : 0, input.createdBy, input.createdBy);
        // Snapshot revision 1 in versions.
        this._snapshot(id, 1, input.payload, input.createdBy, 'initial');
        return this.findById(id);
    },
    /**
     * Save a new revision. Bumps revision, snapshots the OLD payload into
     * layout_versions, then writes the new payload. All atomic.
     */
    saveRevision(input) {
        const tx = db.transaction(() => {
            const current = this.findById(input.layoutId);
            if (!current)
                throw new Error('layout-not-found');
            if (input.expectedRevision !== undefined &&
                input.expectedRevision !== current.revision) {
                const err = new Error('revision-conflict');
                err.code = 'revision-conflict';
                throw err;
            }
            const newRev = current.revision + 1;
            // Snapshot the NEW state at the NEW revision number.
            // (Revision 1 was already snapshotted by create().)
            db.prepare(`UPDATE layouts
           SET payload = ?, revision = ?, updated_by = ?, updated_at = datetime('now')
         WHERE id = ?`).run(stringifyJson(input.payload), newRev, input.updatedBy, input.layoutId);
            this._snapshot(input.layoutId, newRev, input.payload, input.updatedBy, input.changeDescription ?? null);
        });
        tx();
        return this.findById(input.layoutId);
    },
    _snapshot(layoutId, revision, payload, userId, desc) {
        db.prepare(`INSERT OR REPLACE INTO layout_versions
         (id, layout_id, revision, payload, change_description, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`).run(uuid(), layoutId, revision, stringifyJson(payload), desc, userId);
    },
    listVersions(layoutId) {
        return db.prepare(`SELECT * FROM layout_versions WHERE layout_id = ? ORDER BY revision DESC`).all(layoutId);
    },
    getVersion(layoutId, revision) {
        return db.prepare(`SELECT * FROM layout_versions WHERE layout_id = ? AND revision = ?`).get(layoutId, revision);
    },
    rename(id, name) {
        db.prepare(`UPDATE layouts SET name = ?, updated_at = datetime('now') WHERE id = ?`).run(name, id);
    },
    delete(id) {
        const res = db.prepare(`DELETE FROM layouts WHERE id = ?`).run(id);
        return res.changes > 0;
    },
};
//# sourceMappingURL=layouts.js.map