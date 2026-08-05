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

/**
 * Local calendar date ('YYYY-MM-DD') for the given Date (default now).
 * Use this when comparing against user-entered date-only values (date
 * pickers send LOCAL dates) — deriving "today" with toISOString() gives
 * the UTC date, which is tomorrow during US evening hours and silently
 * shifts "overdue/upcoming" labels by a day.
 */
export function localDateString(date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}
