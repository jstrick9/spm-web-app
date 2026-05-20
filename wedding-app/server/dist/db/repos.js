/**
 * Thin repository functions wrapping prepared statements.
 *
 * Why one file? At POC scale, 6 repos × 4 functions = 24 functions. Keeping
 * them together makes the SQL surface easy to audit. When this grows past
 * ~100 functions, split into per-domain files.
 */
import { db } from './database.js';
import { uuid } from '../lib/crypto.js';
export const usersRepo = {
    findByEmail(email) {
        return db
            .prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE`)
            .get(email);
    },
    findById(id) {
        return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
    },
    create(input) {
        const id = uuid();
        db.prepare(`INSERT INTO users (id, email, full_name, password_hash, password_salt)
       VALUES (?, ?, ?, ?, ?)`).run(id, input.email, input.fullName, input.passwordHash, input.passwordSalt);
        return this.findById(id);
    },
};
// ─── ORGANIZATIONS ───────────────────────────────────────────
export const orgsRepo = {
    createWithOwner(input) {
        const id = uuid();
        const tx = db.transaction(() => {
            db.prepare(`INSERT INTO organizations (id, name, slug, owner_id) VALUES (?, ?, ?, ?)`).run(id, input.name, input.slug, input.ownerId);
            db.prepare(`INSERT INTO organization_memberships (id, organization_id, user_id, role)
         VALUES (?, ?, ?, 'owner')`).run(uuid(), id, input.ownerId);
        });
        tx();
        return id;
    },
    listForUser(userId) {
        return db
            .prepare(`SELECT o.* FROM organizations o
         JOIN organization_memberships m
           ON m.organization_id = o.id
         WHERE m.user_id = ? AND m.status = 'active'
         ORDER BY o.created_at`)
            .all(userId);
    },
};
export const eventsRepo = {
    create(input) {
        const id = uuid();
        db.prepare(`INSERT INTO events
       (id, organization_id, title, slug, start_date, end_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, input.organizationId, input.title, input.slug, input.startDate ?? null, input.endDate ?? null, input.createdBy);
        return this.findById(id);
    },
    findById(id) {
        return db.prepare(`SELECT * FROM events WHERE id = ?`).get(id);
    },
    listForOrg(orgId) {
        return db
            .prepare(`SELECT * FROM events WHERE organization_id = ? ORDER BY start_date`)
            .all(orgId);
    },
    /** event_id → organization_id map for the user's visible events.
     *  Used by the RBAC resolver to bridge event-scoped checks. */
    orgMapForUser(userId) {
        const rows = db
            .prepare(`SELECT e.id, e.organization_id
         FROM events e
         LEFT JOIN event_memberships em
           ON em.event_id = e.id AND em.user_id = ?
         LEFT JOIN organization_memberships om
           ON om.organization_id = e.organization_id AND om.user_id = ?
         WHERE em.id IS NOT NULL OR om.id IS NOT NULL`)
            .all(userId, userId);
        const map = {};
        for (const r of rows)
            map[r.id] = r.organization_id;
        return map;
    },
};
export const guestsRepo = {
    create(input) {
        const id = uuid();
        db.prepare(`INSERT INTO guests
       (id, organization_id, event_id, full_name, email, plus_one_allowed)
       VALUES (?, ?, ?, ?, ?, ?)`).run(id, input.organizationId, input.eventId, input.fullName, input.email ?? null, input.plusOneAllowed ? 1 : 0);
        return this.findById(id);
    },
    findById(id) {
        return db.prepare(`SELECT * FROM guests WHERE id = ?`).get(id);
    },
    listForEvent(eventId) {
        return db
            .prepare(`SELECT * FROM guests WHERE event_id = ? ORDER BY full_name`)
            .all(eventId);
    },
    updateRsvpStatus(id, status) {
        db.prepare(`UPDATE guests SET rsvp_status = ?, updated_at = datetime('now') WHERE id = ?`).run(status, id);
    },
};
// ─── RSVPs ───────────────────────────────────────────────────
export const rsvpRepo = {
    submit(input) {
        const id = uuid();
        db.prepare(`INSERT INTO rsvp_submissions
       (id, organization_id, event_id, guest_id, attending,
        meal_choice, plus_one_name, notes, submitted_ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, input.organizationId, input.eventId, input.guestId ?? null, input.attending ? 1 : 0, input.mealChoice ?? null, input.plusOneName ?? null, input.notes ?? null, input.ip ?? null, input.userAgent ?? null);
        if (input.guestId) {
            guestsRepo.updateRsvpStatus(input.guestId, input.attending ? 'attending' : 'declined');
        }
        return id;
    },
    listForEvent(eventId) {
        return db
            .prepare(`SELECT r.*, g.full_name AS guest_name
         FROM rsvp_submissions r
         LEFT JOIN guests g ON g.id = r.guest_id
         WHERE r.event_id = ?
         ORDER BY r.submitted_at DESC`)
            .all(eventId);
    },
};
// ─── AUDIT LOG ───────────────────────────────────────────────
export const auditRepo = {
    log(input) {
        db.prepare(`INSERT INTO audit_logs
       (id, organization_id, actor_user_id, actor_label, action,
        target_type, target_id, ip, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(uuid(), input.organizationId ?? null, input.actorUserId ?? null, input.actorLabel ?? null, input.action, input.targetType ?? null, input.targetId ?? null, input.ip ?? null, input.userAgent ?? null, JSON.stringify(input.details ?? {}));
    },
};
//# sourceMappingURL=repos.js.map