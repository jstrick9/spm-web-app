import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { parseJson, stringifyJson } from '../../lib/json.js';

export interface DirectMessageRow {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: string;
  body: string;
  read_by: string;   // JSON array of user ids
  created_at: string;
}

export const messagesRepo = {
  listForThread(threadId: string, limit = 200): DirectMessageRow[] {
    return db.prepare(
      `SELECT * FROM direct_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT ?`
    ).all(threadId, limit) as DirectMessageRow[];
  },

  send(input: { threadId: string; senderId: string; senderRole: string; body: string }): DirectMessageRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO direct_messages (id, thread_id, sender_id, sender_role, body, read_by)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, input.threadId, input.senderId, input.senderRole, input.body,
          stringifyJson([input.senderId]));
    return db.prepare(`SELECT * FROM direct_messages WHERE id = ?`).get(id) as DirectMessageRow;
  },

  markRead(threadId: string, userId: string): void {
    // Read the JSON array, add user id, write back. Done per-row to keep it simple.
    const rows = db.prepare(
      `SELECT id, read_by FROM direct_messages WHERE thread_id = ?`
    ).all(threadId) as Array<{ id: string; read_by: string }>;
    const tx = db.transaction(() => {
      for (const r of rows) {
        const arr = parseJson<string[]>(r.read_by, []);
        if (!arr.includes(userId)) {
          arr.push(userId);
          db.prepare(`UPDATE direct_messages SET read_by = ? WHERE id = ?`).run(stringifyJson(arr), r.id);
        }
      }
    });
    tx();
  },

  unreadCount(threadId: string, userId: string): number {
    const rows = db.prepare(
      `SELECT read_by FROM direct_messages WHERE thread_id = ? AND sender_id != ?`
    ).all(threadId, userId) as Array<{ read_by: string }>;
    let n = 0;
    for (const r of rows) {
      const arr = parseJson<string[]>(r.read_by, []);
      if (!arr.includes(userId)) n++;
    }
    return n;
  },
};
