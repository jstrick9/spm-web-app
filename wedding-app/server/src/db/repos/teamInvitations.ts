import { db } from '../database.js';
import { generateOpaqueToken, hashToken, uuid, verifyToken } from '../../lib/crypto.js';

export interface TeamInvitationRow {
  id: string;
  organization_id: string;
  email: string;
  event_id: string | null;
  invitation_type: 'organization' | 'event';
  role_id: string;
  token_hash: string;
  token_salt: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export const teamInvitationsRepo = {
  create(input: { organizationId: string; email: string; roleId: string; invitedBy: string; eventId?: string | null; invitationType?: 'organization' | 'event'; ttlMs?: number }): { token: string; row: TeamInvitationRow } {
    const id = uuid();
    const secret = generateOpaqueToken(32);
    const token = `${id}.${secret}`;
    const hashed = hashToken(secret);
    const expiresAt = new Date(Date.now() + (input.ttlMs ?? 7 * 24 * 60 * 60 * 1000)).toISOString();
    const email = input.email.trim().toLowerCase();
    const tx = db.transaction(() => {
      db.prepare(
        `UPDATE team_invitations SET revoked_at = datetime('now'), updated_at = datetime('now')
         WHERE organization_id = ? AND email = ? COLLATE NOCASE
           AND COALESCE(event_id, '') = COALESCE(?, '')
           AND accepted_at IS NULL AND revoked_at IS NULL`,
      ).run(input.organizationId, email, input.eventId ?? null);
      db.prepare(
        `INSERT INTO team_invitations
          (id, organization_id, event_id, invitation_type, email, role_id, token_hash, token_salt, expires_at, invited_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(id, input.organizationId, input.eventId ?? null, input.invitationType ?? (input.eventId ? 'event' : 'organization'), email, input.roleId, hashed.hash, hashed.salt, expiresAt, input.invitedBy);
    });
    tx();
    return { token, row: this.findById(id)! };
  },

  findById(id: string): TeamInvitationRow | undefined {
    return db.prepare(`SELECT * FROM team_invitations WHERE id = ?`).get(id) as TeamInvitationRow | undefined;
  },

  listForOrg(orgId: string): TeamInvitationRow[] {
    return db.prepare(
      `SELECT * FROM team_invitations WHERE organization_id = ? ORDER BY created_at DESC LIMIT 200`,
    ).all(orgId) as TeamInvitationRow[];
  },

  listForEvent(eventId: string): TeamInvitationRow[] {
    return db.prepare(
      `SELECT * FROM team_invitations WHERE event_id = ? ORDER BY created_at DESC LIMIT 100`,
    ).all(eventId) as TeamInvitationRow[];
  },

  findValidByToken(token: string): TeamInvitationRow | undefined {
    const [id, secret] = token.split('.', 2);
    if (!id || !secret) return undefined;
    const row = db.prepare(
      `SELECT * FROM team_invitations
       WHERE id = ? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > datetime('now')`,
    ).get(id) as TeamInvitationRow | undefined;
    if (!row) return undefined;
    return verifyToken(secret, { hash: row.token_hash, salt: row.token_salt }) ? row : undefined;
  },

  markAccepted(id: string): void {
    db.prepare(`UPDATE team_invitations SET accepted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(id);
  },
};
