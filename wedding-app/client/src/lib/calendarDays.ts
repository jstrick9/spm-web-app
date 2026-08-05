/**
 * calendarDaysUntil — whole calendar days from today (local time) until a
 * date, for "X days away" / "day of" / "within N days" semantics.
 *
 * IMPORTANT: parsing a bare "YYYY-MM-DD" with `new Date(str)` treats it as
 * UTC midnight, which makes day counts drift by one (and "day of" fire up
 * to ~12h early) in non-UTC timezones. This helper compares LOCAL calendar
 * days instead, so "today" is always 0, tomorrow is 1, yesterday is -1.
 */
export function calendarDaysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr.trim());
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(y, m - 1, d);
    return Math.round((eventDay.getTime() - today.getTime()) / 86_400_000);
  }
  // Full ISO timestamp (e.g. "2026-09-01T10:00:00Z") — compare to now.
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 86_400_000);
}
