/**
 * Roles repository.
 *
 *   - System roles (sys_owner, sys_admin, ...) are seeded once on startup
 *     by ensureSystemRoles(). They are IMMUTABLE: update/delete throw a
 *     conflict error if called against an is_system=1 row.
 *
 *   - Custom roles belong to an organization. Owners/admins create them
 *     via /api/orgs/:id/roles. They have UUID ids and may grant any
 *     subset of permissions from PERMISSION_CATALOG.
 *
 *   - We bust the in-process permission cache (lib/rbac.ts) on every
 *     mutation so the next request sees the new grants.
 */
import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { invalidateRoleCache } from '../../lib/rbac.js';
import { PERMISSION_CATALOG, SYSTEM_ROLE_DEFINITIONS, isValidPermissionId, } from '../../lib/permissions.js';
function rowWithPermissions(row) {
    const perms = db.prepare(`SELECT permission_id FROM role_permissions WHERE role_id = ? ORDER BY permission_id`).all(row.id);
    return {
        ...row,
        permissions: perms.map((p) => p.permission_id).filter(isValidPermissionId),
    };
}
export const rolesRepo = {
    /**
     * Idempotently seed the 7 system roles. Called once on app boot.
     * Safe to re-run: re-syncs the permission grants if the code-side
     * SYSTEM_ROLE_DEFINITIONS changes.
     */
    ensureSystemRoles() {
        const tx = db.transaction(() => {
            const insertRole = db.prepare(`INSERT INTO roles (id, organization_id, key, name, description, is_system, system_kind, hierarchy)
         VALUES (?, NULL, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           description = excluded.description,
           hierarchy = excluded.hierarchy,
           updated_at = datetime('now')`);
            const deletePerms = db.prepare(`DELETE FROM role_permissions WHERE role_id = ?`);
            const insertPerm = db.prepare(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`);
            for (const def of SYSTEM_ROLE_DEFINITIONS) {
                insertRole.run(def.id, def.key, def.name, def.description, def.key, def.hierarchy);
                // Re-sync permissions to match code (single source of truth for system roles).
                deletePerms.run(def.id);
                for (const p of def.permissions)
                    insertPerm.run(def.id, p);
            }
        });
        tx();
        invalidateRoleCache();
    },
    findById(id) {
        const row = db.prepare(`SELECT * FROM roles WHERE id = ?`).get(id);
        return row ? rowWithPermissions(row) : undefined;
    },
    findByKey(orgId, key) {
        const row = db.prepare(orgId === null
            ? `SELECT * FROM roles WHERE organization_id IS NULL AND key = ? COLLATE NOCASE`
            : `SELECT * FROM roles WHERE organization_id = ? AND key = ? COLLATE NOCASE`).get(...(orgId === null ? [key] : [orgId, key]));
        return row ? rowWithPermissions(row) : undefined;
    },
    /**
     * List roles available to a given org: all system roles + that org's
     * custom roles. Ordered by hierarchy DESC so the most-powerful first.
     */
    listForOrg(orgId) {
        const rows = db.prepare(`SELECT * FROM roles
       WHERE organization_id = ? OR organization_id IS NULL
       ORDER BY hierarchy DESC, name`).all(orgId);
        return rows.map(rowWithPermissions);
    },
    /** Create a custom role for an org. Throws on duplicate key within the org. */
    createCustom(input) {
        // Validate permissions are real.
        for (const p of input.permissions) {
            if (!isValidPermissionId(p)) {
                const err = new Error(`unknown-permission: ${p}`);
                err.code = 'unknown-permission';
                err.statusCode = 400;
                throw err;
            }
        }
        const id = uuid();
        const tx = db.transaction(() => {
            db.prepare(`INSERT INTO roles (id, organization_id, key, name, description, is_system, system_kind, hierarchy, created_by)
         VALUES (?, ?, ?, ?, ?, 0, NULL, ?, ?)`).run(id, input.organizationId, input.key, input.name, input.description ?? null, input.hierarchy ?? 50, input.createdBy);
            const insertPerm = db.prepare(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`);
            for (const p of input.permissions)
                insertPerm.run(id, p);
        });
        try {
            tx();
        }
        catch (err) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                const wrapped = new Error('role-key-already-exists');
                wrapped.code = 'role-key-already-exists';
                wrapped.statusCode = 409;
                throw wrapped;
            }
            throw err;
        }
        return this.findById(id);
    },
    /** Update name/description/hierarchy/permissions of a CUSTOM role only. */
    updateCustom(id, patch) {
        const role = this.findById(id);
        if (!role)
            throw httpError(404, 'role-not-found');
        if (role.is_system)
            throw httpError(409, 'system-role-immutable');
        if (patch.permissions) {
            for (const p of patch.permissions) {
                if (!isValidPermissionId(p))
                    throw httpError(400, `unknown-permission: ${p}`);
            }
        }
        const fields = [];
        const values = [];
        if (patch.name !== undefined) {
            fields.push('name = ?');
            values.push(patch.name);
        }
        if (patch.description !== undefined) {
            fields.push('description = ?');
            values.push(patch.description);
        }
        if (patch.hierarchy !== undefined) {
            fields.push('hierarchy = ?');
            values.push(patch.hierarchy);
        }
        const tx = db.transaction(() => {
            if (fields.length > 0) {
                values.push(id);
                db.prepare(`UPDATE roles SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
            }
            if (patch.permissions) {
                db.prepare(`DELETE FROM role_permissions WHERE role_id = ?`).run(id);
                const insertPerm = db.prepare(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`);
                for (const p of patch.permissions)
                    insertPerm.run(id, p);
            }
        });
        tx();
        invalidateRoleCache(id);
        return this.findById(id);
    },
    /** Delete a CUSTOM role. Fails if any membership still references it. */
    deleteCustom(id) {
        const role = this.findById(id);
        if (!role)
            throw httpError(404, 'role-not-found');
        if (role.is_system)
            throw httpError(409, 'system-role-immutable');
        const inUse = db.prepare(`SELECT COUNT(*) AS n FROM organization_memberships WHERE role_id = ?
       UNION ALL
       SELECT COUNT(*) AS n FROM event_memberships WHERE role_id = ?`).all(id, id);
        if (inUse.reduce((a, r) => a + r.n, 0) > 0) {
            throw httpError(409, 'role-in-use');
        }
        db.prepare(`DELETE FROM roles WHERE id = ?`).run(id);
        invalidateRoleCache(id);
    },
    /**
     * Returns the catalog of every permission id (sourced from code, not DB).
     * Used by the admin UI to render the role editor.
     */
    permissionCatalog() {
        return PERMISSION_CATALOG;
    },
};
function httpError(statusCode, code) {
    const err = new Error(code);
    err.statusCode = statusCode;
    err.code = code;
    return err;
}
//# sourceMappingURL=roles.js.map