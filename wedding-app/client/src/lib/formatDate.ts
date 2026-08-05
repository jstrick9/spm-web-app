/**
 * Human-readable date formatting shared across the app.
 *
 * Server timestamps arrive in two shapes:
 *   - "YYYY-MM-DD" (SQLite date columns, e.g. events.start_date)
 *   - ISO-8601 with time (e.g. "2026-09-12T16:30:00.000Z")
 *
 * `formatDateOnly` renders the DATE portion in a human format
 * ("September 12, 2026") without timezone surprises: YYYY-MM-DD values are
 * parsed as calendar dates (UTC), so the same date shows the same day
 * everywhere in the world.
 */
export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "TBD";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    const [, y, mo, d] = m;
    const parsed = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value; // never mangle unknown strings
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
