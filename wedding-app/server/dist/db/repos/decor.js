import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';
export const decorRepo = {
    // ─── Items ──────────────────────────────────────────────
    listItems(orgId) {
        return db.prepare(`SELECT * FROM decor_items WHERE organization_id = ? ORDER BY name`).all(orgId);
    },
    createItem(orgId, input) {
        const id = uuid();
        db.prepare(`INSERT INTO decor_items (id, organization_id, category_id, name, spec, image_path, visible)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, orgId, input.categoryId ?? null, input.name, stringifyJson(input.spec ?? {}), input.imagePath ?? null, input.visible === false ? 0 : 1);
        return db.prepare(`SELECT * FROM decor_items WHERE id = ?`).get(id);
    },
    updateItem(id, patch) {
        const fields = [];
        const values = [];
        if (patch.categoryId !== undefined) {
            fields.push('category_id = ?');
            values.push(patch.categoryId);
        }
        if (patch.name !== undefined) {
            fields.push('name = ?');
            values.push(patch.name);
        }
        if (patch.spec !== undefined) {
            fields.push('spec = ?');
            values.push(stringifyJson(patch.spec));
        }
        if (patch.imagePath !== undefined) {
            fields.push('image_path = ?');
            values.push(patch.imagePath);
        }
        if (patch.visible !== undefined) {
            fields.push('visible = ?');
            values.push(patch.visible ? 1 : 0);
        }
        if (fields.length === 0)
            return db.prepare(`SELECT * FROM decor_items WHERE id = ?`).get(id);
        values.push(id);
        db.prepare(`UPDATE decor_items SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
        return db.prepare(`SELECT * FROM decor_items WHERE id = ?`).get(id);
    },
    deleteItem(id) {
        return db.prepare(`DELETE FROM decor_items WHERE id = ?`).run(id).changes > 0;
    },
    // ─── Categories ─────────────────────────────────────────
    listCategories(orgId) {
        return db.prepare(`SELECT * FROM decor_categories WHERE organization_id = ? ORDER BY sort_order, name`).all(orgId);
    },
    createCategory(orgId, input) {
        const id = uuid();
        db.prepare(`INSERT INTO decor_categories (id, organization_id, name, icon, sort_order)
       VALUES (?, ?, ?, ?, ?)`).run(id, orgId, input.name, input.icon ?? null, input.sortOrder ?? 0);
        return db.prepare(`SELECT * FROM decor_categories WHERE id = ?`).get(id);
    },
    deleteCategory(id) {
        return db.prepare(`DELETE FROM decor_categories WHERE id = ?`).run(id).changes > 0;
    },
    // ─── Arrangements ───────────────────────────────────────
    listArrangements(orgId) {
        return db.prepare(`SELECT * FROM decor_arrangements WHERE organization_id = ? ORDER BY name`).all(orgId);
    },
    upsertArrangement(orgId, input) {
        const id = input.id ?? uuid();
        const existing = input.id ? db.prepare(`SELECT id FROM decor_arrangements WHERE id = ?`).get(id) : undefined;
        if (existing) {
            db.prepare(`UPDATE decor_arrangements SET name = ?, payload = ?, updated_at = datetime('now') WHERE id = ?`).run(input.name, stringifyJson(input.payload), id);
        }
        else {
            db.prepare(`INSERT INTO decor_arrangements (id, organization_id, name, payload, created_by)
         VALUES (?, ?, ?, ?, ?)`).run(id, orgId, input.name, stringifyJson(input.payload), input.createdBy ?? null);
        }
        return db.prepare(`SELECT * FROM decor_arrangements WHERE id = ?`).get(id);
    },
    deleteArrangement(id) {
        return db.prepare(`DELETE FROM decor_arrangements WHERE id = ?`).run(id).changes > 0;
    },
    // ─── Packages ───────────────────────────────────────────
    listPackages(orgId) {
        return db.prepare(`SELECT * FROM decor_packages WHERE organization_id = ? ORDER BY name`).all(orgId);
    },
    upsertPackage(orgId, input) {
        const id = input.id ?? uuid();
        const existing = input.id ? db.prepare(`SELECT id FROM decor_packages WHERE id = ?`).get(id) : undefined;
        if (existing) {
            db.prepare(`UPDATE decor_packages SET name = ?, style = ?, description = ?, arrangements = ?, updated_at = datetime('now') WHERE id = ?`).run(input.name, input.style ?? null, input.description ?? null, stringifyJson(input.arrangements), id);
        }
        else {
            db.prepare(`INSERT INTO decor_packages (id, organization_id, name, style, description, arrangements)
         VALUES (?, ?, ?, ?, ?, ?)`).run(id, orgId, input.name, input.style ?? null, input.description ?? null, stringifyJson(input.arrangements));
        }
        return db.prepare(`SELECT * FROM decor_packages WHERE id = ?`).get(id);
    },
    deletePackage(id) {
        return db.prepare(`DELETE FROM decor_packages WHERE id = ?`).run(id).changes > 0;
    },
};
//# sourceMappingURL=decor.js.map