import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';
export const venuesRepo = {
    findById(id) {
        return db.prepare(`SELECT * FROM venues WHERE id = ? AND deleted_at IS NULL`).get(id);
    },
    listForOrg(orgId) {
        return db.prepare(`SELECT * FROM venues WHERE organization_id = ? AND deleted_at IS NULL ORDER BY name`).all(orgId);
    },
    create(orgId, createdBy, input) {
        const id = uuid();
        db.prepare(`INSERT INTO venues
         (id, organization_id, name, category, environment, description,
          capacity, width, height, canvas_width, canvas_height,
          shape, style, master_layout, metadata, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, orgId, input.name, input.category ?? 'reception', input.environment ?? 'indoor', input.description ?? null, input.capacity ?? 0, input.width ?? 0, input.height ?? 0, input.canvasWidth ?? null, input.canvasHeight ?? null, stringifyJson(input.shape ?? {}), stringifyJson(input.style ?? {}), stringifyJson(input.masterLayout ?? {}), stringifyJson(input.metadata ?? {}), createdBy);
        return this.findById(id);
    },
    update(id, input) {
        const fields = [];
        const values = [];
        const scalarMap = {
            name: 'name', category: 'category', environment: 'environment',
            description: 'description', capacity: 'capacity', width: 'width', height: 'height',
            canvasWidth: 'canvas_width', canvasHeight: 'canvas_height',
        };
        for (const [k, col] of Object.entries(scalarMap)) {
            if (k in input) {
                fields.push(`${col} = ?`);
                values.push(input[k]);
            }
        }
        const jsonMap = {
            shape: 'shape', style: 'style', masterLayout: 'master_layout', metadata: 'metadata',
        };
        for (const [k, col] of Object.entries(jsonMap)) {
            if (k in input) {
                fields.push(`${col} = ?`);
                values.push(stringifyJson(input[k]));
            }
        }
        if (fields.length === 0)
            return this.findById(id);
        values.push(id);
        db.prepare(`UPDATE venues SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
        return this.findById(id);
    },
    softDelete(id) {
        const res = db.prepare(`UPDATE venues SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`).run(id);
        return res.changes > 0;
    },
};
//# sourceMappingURL=venues.js.map