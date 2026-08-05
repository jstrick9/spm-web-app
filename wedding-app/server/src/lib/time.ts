/**
 * Canonical timestamp helpers.
 *
 * Convention: ALL timestamps written by application code are ISO-8601 UTC
 * (`YYYY-MM-DDTHH:MM:SS.sssZ`, from `new Date().toISOString()`). SQLite's
 * `datetime('now')` (space-separated, no timezone) is used only for column
 * DEFAULTS inside migrations and a few legacy queries; never mix the two
 * formats in a string comparison.
 */
export function nowIso(at?: number): string {
  return at !== undefined ? new Date(at).toISOString() : new Date().toISOString();
}

/** SQLite-friendly UTC string ('YYYY-MM-DD HH:MM:SS') for comparisons with datetime('now') columns. */
export function toSqliteUtc(date = new Date()): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Convert an ISO-8601 timestamp ('YYYY-MM-DDTHH:MM:SS.sssZ') to SQLite
 * space format ('YYYY-MM-DD HH:MM:SS'). Use this when a caller hands you
 * an ISO timestamp but the column stores datetime('now') values — mixing
 * the two formats in a string comparison silently breaks (every ISO
 * string sorts AFTER every space string on the same day, so e.g.
 * "expires_at > datetime('now')" stays true until UTC midnight).
 */
export function isoToSqliteUtc(iso: string): string {
  return iso.slice(0, 19).replace('T', ' ');
}
