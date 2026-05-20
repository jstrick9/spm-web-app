import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';
export const vendorsRepo = {
    findById(id) {
        return db.prepare(`SELECT * FROM vendors WHERE id = ? AND deleted_at IS NULL`).get(id);
    },
    listForOrg(orgId, opts = {}) {
        let sql = `SELECT * FROM vendors WHERE organization_id = ? AND deleted_at IS NULL`;
        const params = [orgId];
        if (opts.eventId) {
            sql += ` AND event_id = ?`;
            params.push(opts.eventId);
        }
        sql += ` ORDER BY name`;
        return db.prepare(sql).all(...params);
    },
    create(orgId, input) {
        const id = uuid();
        db.prepare(`INSERT INTO vendors
         (id, organization_id, event_id, name, category, contact_name, email, phone, website_url,
          contract_amount_cents, is_preferred, notes, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, orgId, input.eventId ?? null, input.name, input.category ?? 'other', input.contactName ?? null, input.email ?? null, input.phone ?? null, input.websiteUrl ?? null, input.contractAmountCents ?? null, input.isPreferred ? 1 : 0, input.notes ?? null, stringifyJson(input.metadata ?? {}));
        return this.findById(id);
    },
    update(id, patch) {
        const map = {
            name: { col: 'name' },
            category: { col: 'category' },
            contactName: { col: 'contact_name' },
            email: { col: 'email' },
            phone: { col: 'phone' },
            websiteUrl: { col: 'website_url' },
            contractAmountCents: { col: 'contract_amount_cents' },
            isPreferred: { col: 'is_preferred', bool: true },
            notes: { col: 'notes' },
            metadata: { col: 'metadata', json: true },
            eventId: { col: 'event_id' },
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
        db.prepare(`UPDATE vendors SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
        return this.findById(id);
    },
    softDelete(id) {
        return db.prepare(`UPDATE vendors SET deleted_at = datetime('now') WHERE id = ? AND deleted_at IS NULL`).run(id).changes > 0;
    },
    // ─── Payments ───────────────────────────────────────────
    addPayment(vendorId, input) {
        const id = uuid();
        const tx = db.transaction(() => {
            db.prepare(`INSERT INTO vendor_payments (id, vendor_id, amount_cents, paid_at, method, notes)
         VALUES (?, ?, ?, ?, ?, ?)`).run(id, vendorId, input.amountCents, input.paidAt, input.method ?? null, input.notes ?? null);
            db.prepare(`UPDATE vendors SET amount_paid_cents = COALESCE(amount_paid_cents, 0) + ?, updated_at = datetime('now') WHERE id = ?`).run(input.amountCents, vendorId);
        });
        tx();
        return db.prepare(`SELECT * FROM vendor_payments WHERE id = ?`).get(id);
    },
    listPayments(vendorId) {
        return db.prepare(`SELECT * FROM vendor_payments WHERE vendor_id = ? ORDER BY paid_at DESC`).all(vendorId);
    },
};
//# sourceMappingURL=vendors.js.map