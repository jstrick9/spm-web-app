import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { parseJson, stringifyJson } from '../../lib/json.js';
import { SYSTEM_ROLE_IDS } from '../../lib/permissions.js';

export interface OrgRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  support_email: string | null;
  phone: string | null;
  website_url: string | null;
  branding: string;
  settings: string;
  created_at: string;
}

export interface MembershipRow {
  id: string;
  organization_id: string;
  user_id: string;
  role_id: string;
  status: 'invited' | 'active' | 'suspended' | 'disabled';
  invited_by: string | null;
  created_at: string;
}

export const orgsRepo = {
  findById(id: string): OrgRow | undefined {
    return db.prepare(`SELECT * FROM organizations WHERE id = ?`).get(id) as OrgRow | undefined;
  },

  findBySlug(slug: string): OrgRow | undefined {
    return db.prepare(`SELECT * FROM organizations WHERE slug = ? COLLATE NOCASE`).get(slug) as OrgRow | undefined;
  },

  createWithOwner(input: { name: string; slug: string; ownerId: string }): string {
    const id = uuid();
    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO organizations (id, name, slug, owner_id) VALUES (?, ?, ?, ?)`
      ).run(id, input.name, input.slug, input.ownerId);
      db.prepare(
        `INSERT INTO organization_memberships (id, organization_id, user_id, role_id)
         VALUES (?, ?, ?, ?)`
      ).run(uuid(), id, input.ownerId, SYSTEM_ROLE_IDS.owner);
    });
    tx();
    return id;
  },

  listForUser(userId: string): OrgRow[] {
    return db.prepare(
      `SELECT o.* FROM organizations o
       JOIN organization_memberships m ON m.organization_id = o.id
       WHERE m.user_id = ? AND m.status = 'active'
       ORDER BY o.created_at`
    ).all(userId) as OrgRow[];
  },

  listMembers(orgId: string): Array<MembershipRow & { email: string; full_name: string; role_key: string; role_name: string }> {
    return db.prepare(
      `SELECT m.*, u.email, u.full_name, r.key AS role_key, r.name AS role_name
       FROM organization_memberships m
       JOIN users u ON u.id = m.user_id
       JOIN roles r ON r.id = m.role_id
       WHERE m.organization_id = ?
       ORDER BY r.hierarchy DESC, m.created_at`
    ).all(orgId) as never;
  },

  addMember(input: { orgId: string; userId: string; roleId: string; invitedBy?: string }): MembershipRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO organization_memberships (id, organization_id, user_id, role_id, invited_by)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, input.orgId, input.userId, input.roleId, input.invitedBy ?? null);
    return db.prepare(`SELECT * FROM organization_memberships WHERE id = ?`).get(id) as MembershipRow;
  },

  removeMember(orgId: string, userId: string): boolean {
    const res = db.prepare(
      `DELETE FROM organization_memberships WHERE organization_id = ? AND user_id = ?`
    ).run(orgId, userId);
    return res.changes > 0;
  },

  updateMemberRole(orgId: string, userId: string, roleId: string): boolean {
    const res = db.prepare(
      `UPDATE organization_memberships
       SET role_id = ?, updated_at = datetime('now')
       WHERE organization_id = ? AND user_id = ?`
    ).run(roleId, orgId, userId);
    return res.changes > 0;
  },

  updateBranding(orgId: string, branding: Record<string, unknown>): void {
    db.prepare(
      `UPDATE organizations SET branding = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(stringifyJson(branding), orgId);
  },

  getBranding(orgId: string): Record<string, unknown> {
    const row = this.findById(orgId);
    return row ? parseJson(row.branding, {}) : {};
  },

  updateSettings(orgId: string, settings: Record<string, unknown>): void {
    db.prepare(
      `UPDATE organizations SET settings = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(stringifyJson(settings), orgId);
  },
};
