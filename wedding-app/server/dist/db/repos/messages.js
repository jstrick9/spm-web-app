import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { parseJson, stringifyJson } from '../../lib/json.js';
export const messagesRepo = {
    listForThread(threadId, limit = 200) {
        return db.prepare(`SELECT * FROM direct_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT ?`).all(threadId, limit);
    },
    send(input) {
        const id = uuid();
        db.prepare(`INSERT INTO direct_messages (id, thread_id, sender_id, sender_role, body, read_by)
       VALUES (?, ?, ?, ?, ?, ?)`).run(id, input.threadId, input.senderId, input.senderRole, input.body, stringifyJson([input.senderId]));
        return db.prepare(`SELECT * FROM direct_messages WHERE id = ?`).get(id);
    },
    markRead(threadId, userId) {
        // Read the JSON array, add user id, write back. Done per-row to keep it simple.
        const rows = db.prepare(`SELECT id, read_by FROM direct_messages WHERE thread_id = ?`).all(threadId);
        const tx = db.transaction(() => {
            for (const r of rows) {
                const arr = parseJson(r.read_by, []);
                if (!arr.includes(userId)) {
                    arr.push(userId);
                    db.prepare(`UPDATE direct_messages SET read_by = ? WHERE id = ?`).run(stringifyJson(arr), r.id);
                }
            }
        });
        tx();
    },
    unreadCount(threadId, userId) {
        const rows = db.prepare(`SELECT read_by FROM direct_messages WHERE thread_id = ? AND sender_id != ?`).all(threadId, userId);
        let n = 0;
        for (const r of rows) {
            const arr = parseJson(r.read_by, []);
            if (!arr.includes(userId))
                n++;
        }
        return n;
    },
};
//# sourceMappingURL=messages.js.map