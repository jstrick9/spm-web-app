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
