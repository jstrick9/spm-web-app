import { db } from '../database.js';
import { uuid, hashToken, generateOpaqueToken } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';
export const guestsRepo = {
    findById(id) {
        return db.prepare(`SELECT * FROM guests WHERE id = ? AND deleted_at IS NULL`).get(id);
    },
    listForEvent(eventId) {
        return db.prepare(`SELECT * FROM guests WHERE event_id = ? AND deleted_at IS NULL ORDER BY full_name`).all(eventId);
    },
    bulkCreate(orgId, eventId, mode, inputs) {
        return db.transaction(() => {
            let inserted = 0;
            let updated = 0;
            let skipped = 0;
            const existing = this.listForEvent(eventId);
            const byEmail = new Map();
            for (const g of existing) {
                if (g.email) {
                    byEmail.set(g.email.toLowerCase(), g);
                }
            }
            for (const input of inputs) {
                const emailKey = input.email ? input.email.toLowerCase() : null;
                let match = emailKey ? byEmail.get(emailKey) : undefined;
                if (match && mode === 'skip') {
                    skipped++;
                    continue;
                }
                if (match && mode === 'replace') {
                    this.update(match.id, input);
                    updated++;
                    continue;
                }
                // append or no match
                this.create(orgId, eventId, input);
                inserted++;
            }
            return { inserted, updated, skipped };
        })();
    },
    create(orgId, eventId, input) {
        const id = uuid();
        db.prepare(`INSERT INTO guests
         (id, organization_id, event_id, full_name, email, phone, party_name,
          rsvp_status, dietary_restrictions, accessibility_notes,
          table_assignment, room_assignment, seat_assignment,
          plus_one_allowed, allow_portal_access, allow_lodging_access, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, orgId, eventId, input.fullName, input.email ?? null, input.phone ?? null, input.partyName ?? null, input.rsvpStatus ?? 'pending', input.dietaryRestrictions ?? null, input.accessibilityNotes ?? null, input.tableAssignment ?? null, input.roomAssignment ?? null, input.seatAssignment ?? null, input.plusOneAllowed ? 1 : 0, input.allowPortalAccess === false ? 0 : 1, input.allowLodgingAccess ? 1 : 0, stringifyJson(input.metadata ?? {}));
        return this.findById(id);
    },
    update(id, patch) {
        const map = {
            fullName: { col: 'full_name' },
            email: { col: 'email' },
            phone: { col: 'phone' },
            partyName: { col: 'party_name' },
            rsvpStatus: { col: 'rsvp_status' },
            dietaryRestrictions: { col: 'dietary_restrictions' },
            accessibilityNotes: { col: 'accessibility_notes' },
            tableAssignment: { col: 'table_assignment' },
            roomAssignment: { col: 'room_assignment' },
            seatAssignment: { col: 'seat_assignment' },
            plusOneAllowed: { col: 'plus_one_allowed', bool: true },
            allowPortalAccess: { col: 'allow_portal_access', bool: true },
            allowLodgingAccess: { col: 'allow_lodging_access', bool: true },
            metadata: { col: 'metadata', json: true },
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
        db.prepare(`UPDATE guests SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
        return this.findById(id);
    },
    softDelete(id) {
        const res = db.prepare(`UPDATE guests SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`).run(id);
        return res.changes > 0;
    },
    /** Issue a new portal token for the guest. Returns the plaintext (only chance!). */
    rotatePortalToken(id) {
        const plaintext = generateOpaqueToken();
        const rec = hashToken(plaintext);
        db.prepare(`UPDATE guests SET portal_token_hash = ?, portal_token_salt = ?, updated_at = datetime('now') WHERE id = ?`).run(rec.hash, rec.salt, id);
        return plaintext;
    },
    revokePortalToken(id) {
        db.prepare(`UPDATE guests SET portal_token_hash = NULL, portal_token_salt = NULL, allow_portal_access = 0, updated_at = datetime('now') WHERE id = ?`).run(id);
    },
    countByStatus(eventId) {
        const rows = db.prepare(`SELECT rsvp_status, COUNT(*) AS n FROM guests
       WHERE event_id = ? AND deleted_at IS NULL
       GROUP BY rsvp_status`).all(eventId);
        const out = { pending: 0, attending: 0, declined: 0, maybe: 0 };
        for (const r of rows)
            out[r.rsvp_status] = r.n;
        return out;
    },
};
// ─── RSVPs ──────────────────────────────────────────────────
export const rsvpRepo = {
    submit(input) {
        const id = uuid();
        db.prepare(`INSERT INTO rsvp_submissions
         (id, organization_id, event_id, guest_id, attending, attending_days,
          meal_choice, plus_one_name, plus_one_meal_choice,
          dietary_notes, special_needs, notes, submitted_ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, input.organizationId, input.eventId, input.guestId ?? null, input.attending ? 1 : 0, stringifyJson(input.attendingDays ?? []), input.mealChoice ?? null, input.plusOneName ?? null, input.plusOneMealChoice ?? null, input.dietaryNotes ?? null, input.specialNeeds ?? null, input.notes ?? null, input.ip ?? null, input.userAgent ?? null);
        if (input.guestId) {
            db.prepare(`UPDATE guests SET rsvp_status = ?, updated_at = datetime('now') WHERE id = ?`).run(input.attending ? 'attending' : 'declined', input.guestId);
        }
        return id;
    },
    listForEvent(eventId) {
        return db.prepare(`SELECT r.*, g.full_name AS guest_name
       FROM rsvp_submissions r
       LEFT JOIN guests g ON g.id = r.guest_id
       WHERE r.event_id = ?
       ORDER BY r.submitted_at DESC`).all(eventId);
    },
    findById(id) {
        return db.prepare(`SELECT * FROM rsvp_submissions WHERE id = ?`).get(id);
    },
};
// ─── Guest portal config ───────────────────────────────────
export const portalConfigRepo = {
    getForEvent(eventId) {
        return db.prepare(`SELECT * FROM guest_portal_configs WHERE event_id = ?`).get(eventId);
    },
    upsert(input) {
        const existing = this.getForEvent(input.eventId);
        if (existing) {
            db.prepare(`UPDATE guest_portal_configs
           SET enabled = ?, password_hash = ?, password_salt = ?,
               access_starts_at = ?, access_ends_at = ?, grace_period_hours = ?,
               config = ?, updated_by = ?, updated_at = datetime('now')
         WHERE id = ?`).run(input.enabled ? 1 : 0, input.passwordHash ?? null, input.passwordSalt ?? null, input.accessStartsAt ?? null, input.accessEndsAt ?? null, input.gracePeriodHours ?? 36, stringifyJson(input.config ?? {}), input.updatedBy, existing.id);
        }
        else {
            db.prepare(`INSERT INTO guest_portal_configs
           (id, organization_id, event_id, enabled, password_hash, password_salt,
            access_starts_at, access_ends_at, grace_period_hours, config,
            created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(uuid(), input.organizationId, input.eventId, input.enabled ? 1 : 0, input.passwordHash ?? null, input.passwordSalt ?? null, input.accessStartsAt ?? null, input.accessEndsAt ?? null, input.gracePeriodHours ?? 36, stringifyJson(input.config ?? {}), input.updatedBy, input.updatedBy);
        }
        return this.getForEvent(input.eventId);
    },
};
//# sourceMappingURL=guests.js.map