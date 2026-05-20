import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';
export const auditRepo = {
    log(input) {
        db.prepare(`INSERT INTO audit_logs
         (id, organization_id, actor_user_id, actor_label, action, target_type, target_id, ip, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(uuid(), input.organizationId ?? null, input.actorUserId ?? null, input.actorLabel ?? null, input.action, input.targetType ?? null, input.targetId ?? null, input.ip ?? null, input.userAgent ?? null, stringifyJson(input.details ?? {}));
    },
    listForOrg(orgId, opts = {}) {
        let sql = `SELECT * FROM audit_logs WHERE organization_id = ?`;
        const params = [orgId];
        if (opts.action) {
            sql += ` AND action = ?`;
            params.push(opts.action);
        }
        sql += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(opts.limit ?? 500);
        return db.prepare(sql).all(...params);
    },
};
//# sourceMappingURL=audit.js.map