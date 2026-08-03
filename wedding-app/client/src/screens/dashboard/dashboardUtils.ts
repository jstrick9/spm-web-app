export const STATUS_COLORS: Record<string, string> = {
  lead: 'bg-slate-400', hold: 'bg-amber-400', booked: 'bg-blue-500', planning: 'bg-violet-500', completed: 'bg-green-500', cancelled: 'bg-rose-400', lost: 'bg-gray-400',
};
export function getGreeting(date = new Date()): string {
  const hour = date.getHours();
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}
export function safeJson(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  try { return JSON.parse(String(raw)); } catch { return {}; }
}

/** A space-calendar commitment row (from GET /api/orgs/:orgId/space-calendar). */
export interface SpaceCommitment {
  id: string;
  title: string;
  status: string;
  start_date: string;
  end_date: string | null;
  guest_count: number | null;
  venue_id: string | null;
  venue_name: string | null;
  venue_capacity: number | null;
}

/**
 * Detect venue-space double bookings within a commitment list: two active
 * events (not cancelled/lost) assigned to the same space whose date ranges
 * overlap. Returns pairs so the UI can warn where the server-side guard was
 * bypassed (e.g. bookings made before the guard shipped, or overridden).
 */
export function findSpaceConflicts(commitments: SpaceCommitment[]): Array<{ a: SpaceCommitment; b: SpaceCommitment }> {
  const active = commitments.filter((c) => c.venue_id && c.status !== 'cancelled' && c.status !== 'lost');
  const conflicts: Array<{ a: SpaceCommitment; b: SpaceCommitment }> = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.venue_id !== b.venue_id) continue;
      const aEnd = a.end_date ?? a.start_date;
      const bEnd = b.end_date ?? b.start_date;
      if (a.start_date <= bEnd && b.start_date <= aEnd) {
        conflicts.push({ a, b });
      }
    }
  }
  return conflicts;
}

/** Set of event ids involved in at least one space conflict. */
export function conflictedEventIds(commitments: SpaceCommitment[]): Set<string> {
  const ids = new Set<string>();
  for (const { a, b } of findSpaceConflicts(commitments)) {
    ids.add(a.id);
    ids.add(b.id);
  }
  return ids;
}
