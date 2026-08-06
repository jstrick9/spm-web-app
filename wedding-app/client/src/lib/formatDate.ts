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

/**
 * Parse a "YYYY-MM-DD" calendar date into a LOCAL Date (local midnight).
 *
 * `new Date("2026-09-12")` parses as UTC midnight, which lands on the
 * PREVIOUS day in every UTC-negative timezone (i.e. all of the US) — so
 * any calendar alignment (day cells, month grouping) or day-count done
 * against a date-only column must use this helper. Timeline items with
 * real times (ISO with time) keep using `new Date()`.
 */
export function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (m) {
    const [, y, mo, d] = m;
    const parsed = new Date(Number(y), Number(mo) - 1, Number(d));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Whole calendar days from today (local) to a date-only string; negative
 * when the date is past. DST-safe (compares y/m/d, not raw timestamps).
 */
export function daysUntilDateOnly(value: string | null | undefined): number | null {
  const target = parseDateOnly(value);
  if (!target) return null;
  const now = new Date();
  const utcDays = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  return Math.round(utcDays(target) - utcDays(now));
}
