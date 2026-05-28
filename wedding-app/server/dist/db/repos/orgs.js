import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { parseJson, stringifyJson } from '../../lib/json.js';
import { SYSTEM_ROLE_IDS } from '../../lib/permissions.js';
export const orgsRepo = {
    findById(id) {
        return db.prepare(`SELECT * FROM organizations WHERE id = ?`).get(id);
    },
    findBySlug(slug) {
        return db.prepare(`SELECT * FROM organizations WHERE slug = ? COLLATE NOCASE`).get(slug);
    },
    createWithOwner(input) {
        const id = uuid();
        const tx = db.transaction(() => {
            db.prepare(`INSERT INTO organizations (id, name, slug, owner_id) VALUES (?, ?, ?, ?)`).run(id, input.name, input.slug, input.ownerId);
            db.prepare(`INSERT INTO organization_memberships (id, organization_id, user_id, role_id)
         VALUES (?, ?, ?, ?)`).run(uuid(), id, input.ownerId, SYSTEM_ROLE_IDS.owner);
        });
        tx();
        return id;
    },
    listForUser(userId) {
        return db.prepare(`SELECT o.* FROM organizations o
       JOIN organization_memberships m ON m.organization_id = o.id
       WHERE m.user_id = ? AND m.status = 'active'
       ORDER BY o.created_at`).all(userId);
    },
    listMembers(orgId) {
        return db.prepare(`SELECT m.*, u.email, u.full_name, r.key AS role_key, r.name AS role_name
       FROM organization_memberships m
       JOIN users u ON u.id = m.user_id
       JOIN roles r ON r.id = m.role_id
       WHERE m.organization_id = ?
       ORDER BY r.hierarchy DESC, m.created_at`).all(orgId);
    },
    addMember(input) {
        const id = uuid();
        db.prepare(`INSERT INTO organization_memberships (id, organization_id, user_id, role_id, invited_by)
       VALUES (?, ?, ?, ?, ?)`).run(id, input.orgId, input.userId, input.roleId, input.invitedBy ?? null);
        return db.prepare(`SELECT * FROM organization_memberships WHERE id = ?`).get(id);
    },
    removeMember(orgId, userId) {
        const res = db.prepare(`DELETE FROM organization_memberships WHERE organization_id = ? AND user_id = ?`).run(orgId, userId);
        return res.changes > 0;
    },
    updateMemberRole(orgId, userId, roleId) {
        const res = db.prepare(`UPDATE organization_memberships
       SET role_id = ?, updated_at = datetime('now')
       WHERE organization_id = ? AND user_id = ?`).run(roleId, orgId, userId);
        return res.changes > 0;
    },
    updateBranding(orgId, branding) {
        db.prepare(`UPDATE organizations SET branding = ?, updated_at = datetime('now') WHERE id = ?`).run(stringifyJson(branding), orgId);
    },
    getBranding(orgId) {
        const row = this.findById(orgId);
        return row ? parseJson(row.branding, {}) : {};
    },
    updateSettings(orgId, settings) {
        db.prepare(`UPDATE organizations SET settings = ?, updated_at = datetime('now') WHERE id = ?`).run(stringifyJson(settings), orgId);
    },
};
//# sourceMappingURL=orgs.js.map