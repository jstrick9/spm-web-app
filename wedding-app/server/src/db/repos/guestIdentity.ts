/**
 * Guest identity resolution — cross-event duplicate detection + merge.
 *
 * Guests are stored per-event (the same person attending three weddings is
 * three rows). This module clusters rows that are likely the SAME PERSON using
 * fuzzy signals, so staff can:
 *   - see "repeat guest" insight (the same person across multiple events), and
 *   - merge true duplicates (e.g. an imported row + a hand-typed row).
 *
 * Matching signals (strongest first):
 *   - email   : normalized (trim+lowercase) exact match        → high
 *   - phone   : digits-only exact match (≥7 digits)            → high
 *   - name    : normalized (lowercase, strip punctuation/ws)   → medium
 *
 * Merging is ALWAYS human-confirmed (no silent auto-merge). The merge keeps a
 * chosen primary row, backfills its empty contact fields from the cluster, and
 * soft-deletes the rest. It never deletes across orgs and validates every id.
 */
import { db } from '../database.js';
import type { GuestRow } from './guests.js';

export type MatchSignal = 'email' | 'phone' | 'name';

export interface DuplicateMember {
  id: string;
  eventId: string;
  eventTitle: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  rsvpStatus: string;
  createdAt: string;
}

export interface DuplicateCluster {
  /** Stable key for the cluster (the matched value). */
  key: string;
  signals: MatchSignal[];
  confidence: 'high' | 'medium';
  members: DuplicateMember[];
  /** True when ≥2 members share the SAME event (a real in-event duplicate). */
  hasInEventDuplicate: boolean;
}

function normEmail(e: string | null): string | null {
  if (!e) return null;
  const t = e.trim().toLowerCase();
  return t.includes('@') ? t : null;
}
function normPhone(p: string | null): string | null {
  if (!p) return null;
  const digits = p.replace(/\D+/g, '');
  return digits.length >= 7 ? digits : null;
}
function normName(n: string): string {
  return n.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

interface Row {
  id: string; event_id: string; event_title: string;
  full_name: string; email: string | null; phone: string | null;
  rsvp_status: string; created_at: string;
}

export const guestIdentityRepo = {
  /**
   * Find duplicate-candidate clusters across all of an org's events.
   * Uses a union-find over rows linked by any shared signal, then summarizes.
   */
  findDuplicates(orgId: string): DuplicateCluster[] {
    const rows = db.prepare(
      `SELECT g.id, g.event_id, g.full_name, g.email, g.phone, g.rsvp_status, g.created_at,
              COALESCE(e.title, '(unknown event)') AS event_title
       FROM guests g
       LEFT JOIN events e ON e.id = g.event_id
       WHERE g.organization_id = ? AND g.deleted_at IS NULL`,
    ).all(orgId) as Row[];

    if (rows.length < 2) return [];

    // ── Union-Find ──
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      let r = x;
      while (parent.get(r) !== r) r = parent.get(r)!;
      // path compression
      let c = x;
      while (parent.get(c) !== r) { const next = parent.get(c)!; parent.set(c, r); c = next; }
      return r;
    };
    const union = (a: string, b: string) => { parent.set(find(a), find(b)); };
    for (const r of rows) parent.set(r.id, r.id);

    // Index rows by each signal value; union rows that share a value.
    const byEmail = new Map<string, string[]>();
    const byPhone = new Map<string, string[]>();
    const byName = new Map<string, string[]>();
    const push = (m: Map<string, string[]>, k: string, id: string) => {
      const a = m.get(k) ?? []; a.push(id); m.set(k, a);
    };
    for (const r of rows) {
      const e = normEmail(r.email); if (e) push(byEmail, e, r.id);
      const p = normPhone(r.phone); if (p) push(byPhone, p, r.id);
      push(byName, normName(r.full_name), r.id);
    }
    const unionGroup = (m: Map<string, string[]>) => {
      for (const ids of m.values()) {
        for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]);
      }
    };
    unionGroup(byEmail); unionGroup(byPhone); unionGroup(byName);

    // ── Group rows by root; keep only multi-row clusters ──
    const byRoot = new Map<string, Row[]>();
    for (const r of rows) {
      const root = find(r.id);
      const a = byRoot.get(root) ?? []; a.push(r); byRoot.set(root, a);
    }

    const rowById = new Map(rows.map(r => [r.id, r]));
    const clusters: DuplicateCluster[] = [];
    for (const group of byRoot.values()) {
      if (group.length < 2) continue;

      // Determine which signals actually link this group.
      const signals = new Set<MatchSignal>();
      const emails = new Set(group.map(g => normEmail(g.email)).filter(Boolean));
      const phones = new Set(group.map(g => normPhone(g.phone)).filter(Boolean));
      const names = new Set(group.map(g => normName(g.full_name)));
      if (emails.size === 1 && [...emails][0]) signals.add('email');
      if (phones.size === 1 && [...phones][0]) signals.add('phone');
      if (names.size === 1) signals.add('name');
      // A signal also counts if it's the bridge even when not globally singular
      // (e.g. email links A-B, name links B-C). Recompute per-pair presence:
      if (!signals.size) {
        // fall back: at least the union linked them — attribute to name
        signals.add('name');
      }

      const confidence: 'high' | 'medium' =
        signals.has('email') || signals.has('phone') ? 'high' : 'medium';

      const events = group.map(g => g.event_id);
      const hasInEventDuplicate = new Set(events).size < events.length;

      const key = [...emails][0] || [...phones][0] || [...names][0] || group[0].id;
      clusters.push({
        key: String(key),
        signals: [...signals],
        confidence,
        hasInEventDuplicate,
        members: group
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map(g => ({
            id: g.id, eventId: g.event_id, eventTitle: g.event_title,
            fullName: g.full_name, email: g.email, phone: g.phone,
            rsvpStatus: g.rsvp_status, createdAt: g.created_at,
          })),
      });
    }

    // Highest-confidence, most-members first.
    return clusters.sort((a, b) =>
      (a.confidence === b.confidence ? 0 : a.confidence === 'high' ? -1 : 1) ||
      (b.members.length - a.members.length),
    );
  },

  /**
   * Merge a set of guest ids into a primary. Backfills the primary's empty
   * contact fields (email/phone/party/dietary/accessibility) from the others,
   * then soft-deletes the non-primary rows. All ids must belong to the org.
   * Returns the updated primary row, or throws via the caller's validation.
   */
  merge(orgId: string, primaryId: string, duplicateIds: string[]): { primary: GuestRow; mergedCount: number } | { error: string } {
    const ids = [primaryId, ...duplicateIds];
    const placeholders = ids.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT * FROM guests WHERE id IN (${placeholders}) AND organization_id = ? AND deleted_at IS NULL`,
    ).all(...ids, orgId) as GuestRow[];

    const byId = new Map(rows.map(r => [r.id, r]));
    const primary = byId.get(primaryId);
    if (!primary) return { error: 'primary-not-found' };
    const dups = duplicateIds.filter(id => byId.has(id) && id !== primaryId);
    if (dups.length === 0) return { error: 'no-valid-duplicates' };

    const tx = db.transaction(() => {
      // Backfill empty primary fields from the first duplicate that has them.
      const fill: Record<string, string> = {};
      const cols = ['email', 'phone', 'party_name', 'dietary_restrictions', 'accessibility_notes'] as const;
      for (const col of cols) {
        if (!(primary as any)[col]) {
          for (const d of dups) {
            const v = (byId.get(d) as any)[col];
            if (v) { fill[col] = v; break; }
          }
        }
      }
      if (Object.keys(fill).length) {
        const setSql = Object.keys(fill).map(c => `${c} = ?`).join(', ');
        db.prepare(`UPDATE guests SET ${setSql} WHERE id = ?`).run(...Object.values(fill), primaryId);
      }
      // Soft-delete the duplicates.
      db.prepare(
        `UPDATE guests SET deleted_at = datetime('now') WHERE id IN (${dups.map(() => '?').join(',')})`,
      ).run(...dups);
    });
    tx();

    const updated = db.prepare(`SELECT * FROM guests WHERE id = ?`).get(primaryId) as GuestRow;
    return { primary: updated, mergedCount: dups.length };
  },
};
