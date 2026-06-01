import { db } from '../database.js';
import { stringifyJson } from '../../lib/json.js';

export interface SSEEventRow {
  id: number;
  organization_id: string;
  event_type: string;
  payload: string;
  actor_user_id: string | null;
  created_at: string;
}

export interface SSEEventInput {
  organizationId: string;
  eventType: string;
  payload?: Record<string, unknown>;
  actorUserId?: string;
}

export const sseEventsRepo = {
  /**
   * Insert a new event into the stream. Returns the auto-incremented id
   * which clients use as a cursor.
   */
  publish(input: SSEEventInput): SSEEventRow {
    const stmt = db.prepare(
      `INSERT INTO sse_events (organization_id, event_type, payload, actor_user_id)
       VALUES (?, ?, ?, ?)`
    );
    const result = stmt.run(
      input.organizationId,
      input.eventType,
      stringifyJson(input.payload ?? {}),
      input.actorUserId ?? null
    );
    return this.findById(Number(result.lastInsertRowid))!;
  },

  findById(id: number): SSEEventRow | undefined {
    return db.prepare(
      `SELECT * FROM sse_events WHERE id = ?`
    ).get(id) as SSEEventRow | undefined;
  },

  /**
   * Get events for an org after a given cursor (exclusive).
   * Used by the SSE endpoint to catch up on missed events.
   */
  listAfter(orgId: string, afterId: number, limit = 100): SSEEventRow[] {
    return db.prepare(
      `SELECT * FROM sse_events
       WHERE organization_id = ? AND id > ?
       ORDER BY id ASC
       LIMIT ?`
    ).all(orgId, afterId, limit) as SSEEventRow[];
  },

  /**
   * Get the latest event id for an org (used to initialize cursor).
   */
  latestId(orgId: string): number {
    const row = db.prepare(
      `SELECT MAX(id) AS max_id FROM sse_events WHERE organization_id = ?`
    ).get(orgId) as { max_id: number | null } | undefined;
    return row?.max_id ?? 0;
  },

  /**
   * Cleanup old events (older than N days). Called by the worker periodically.
   */
  pruneOlderThan(days: number): number {
    const result = db.prepare(
      `DELETE FROM sse_events
       WHERE created_at < datetime('now', '-' || ? || ' days')`
    ).run(days);
    return result.changes;
  },
};
