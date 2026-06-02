/**
 * Vendor reliability scoring + smart matching.
 *
 * Turns the raw vendor_ratings (1–5 overall + quality/timeliness/communication
 * sub-scores) into an explainable 0–100 RELIABILITY SCORE and a tier label,
 * then ranks vendors for a given event by FIT (reliability + budget band +
 * category). Pure SQL + arithmetic — no ML — so a venue owner can trust it.
 *
 * Composite score (when sub-scores exist):
 *   base = 0.40·overall + 0.25·quality + 0.20·timeliness + 0.15·communication
 *   (each normalized 1–5 → 0–100)
 * Falls back to the overall rating alone when sub-scores are absent.
 *
 * Confidence factor tempers thin samples so a single 5★ doesn't outrank a
 * vendor with twenty 4.6★ reviews:
 *   confidence = min(1, ratingCount / 5)          // full weight at 5+ ratings
 *   score = round(base · (0.6 + 0.4·confidence))  // ≥60% of base even at n=1
 */
import { db } from '../database.js';

export type VendorTier = 'top_rated' | 'trusted' | 'promising' | 'unrated';

export interface VendorScore {
  vendorId: string;
  name: string;
  category: string;
  isPreferred: boolean;
  ratingCount: number;
  avgRating: number;          // 0–5, 1 dp
  avgQuality: number;
  avgTimeliness: number;
  avgCommunication: number;
  reliabilityScore: number;   // 0–100 (0 when unrated)
  tier: VendorTier;
  /** Historical contract amounts → typical price band (cents). */
  typicalContractCents: number | null;
}

interface RatingAgg {
  vendor_id: string;
  n: number;
  avg_rating: number | null;
  avg_quality: number | null;
  avg_timeliness: number | null;
  avg_communication: number | null;
}

const norm = (v: number) => Math.max(0, Math.min(100, ((v - 1) / 4) * 100)); // 1–5 → 0–100

function compositeScore(a: RatingAgg): number {
  if (!a.n || !a.avg_rating) return 0;
  const overall = norm(a.avg_rating);
  const hasSub = a.avg_quality != null || a.avg_timeliness != null || a.avg_communication != null;
  let base: number;
  if (hasSub) {
    const q = a.avg_quality != null ? norm(a.avg_quality) : overall;
    const t = a.avg_timeliness != null ? norm(a.avg_timeliness) : overall;
    const c = a.avg_communication != null ? norm(a.avg_communication) : overall;
    base = 0.40 * overall + 0.25 * q + 0.20 * t + 0.15 * c;
  } else {
    base = overall;
  }
  const confidence = Math.min(1, a.n / 5);
  return Math.round(base * (0.6 + 0.4 * confidence));
}

function tierFor(score: number, count: number): VendorTier {
  if (count === 0) return 'unrated';
  if (score >= 85) return 'top_rated';
  if (score >= 70) return 'trusted';
  return 'promising';
}

function round1(v: number | null): number {
  return v == null ? 0 : Math.round(v * 10) / 10;
}

export const vendorScoringRepo = {
  /** Score every (non-deleted) vendor in an org, joined with rating aggregates. */
  scoreAll(orgId: string): VendorScore[] {
    const vendors = db.prepare(
      `SELECT id, name, category, is_preferred, contract_amount_cents
       FROM vendors WHERE organization_id = ? AND deleted_at IS NULL`,
    ).all(orgId) as Array<{ id: string; name: string; category: string; is_preferred: number; contract_amount_cents: number | null }>;

    const aggs = db.prepare(
      `SELECT vendor_id, COUNT(*) AS n,
              AVG(rating) AS avg_rating, AVG(quality_score) AS avg_quality,
              AVG(timeliness_score) AS avg_timeliness, AVG(communication_score) AS avg_communication
       FROM vendor_ratings WHERE organization_id = ? GROUP BY vendor_id`,
    ).all(orgId) as RatingAgg[];
    const aggByVendor = new Map(aggs.map(a => [a.vendor_id, a]));

    // Typical contract amount = median of this vendor's recorded contract amounts
    // across all its rows (vendors can recur per event). Cheap: group + collect.
    const contractRows = db.prepare(
      `SELECT id, name, contract_amount_cents FROM vendors
       WHERE organization_id = ? AND deleted_at IS NULL AND contract_amount_cents > 0`,
    ).all(orgId) as Array<{ name: string; contract_amount_cents: number }>;
    const byName = new Map<string, number[]>();
    for (const r of contractRows) {
      const arr = byName.get(r.name) ?? [];
      arr.push(r.contract_amount_cents);
      byName.set(r.name, arr);
    }

    return vendors.map((v) => {
      const a = aggByVendor.get(v.id) ?? { vendor_id: v.id, n: 0, avg_rating: null, avg_quality: null, avg_timeliness: null, avg_communication: null };
      const score = compositeScore(a);
      const amounts = (byName.get(v.name) ?? []).sort((x, y) => x - y);
      const typical = amounts.length
        ? amounts[Math.floor((amounts.length - 1) / 2)]
        : (v.contract_amount_cents && v.contract_amount_cents > 0 ? v.contract_amount_cents : null);
      return {
        vendorId: v.id,
        name: v.name,
        category: v.category,
        isPreferred: v.is_preferred === 1,
        ratingCount: a.n,
        avgRating: round1(a.avg_rating),
        avgQuality: round1(a.avg_quality),
        avgTimeliness: round1(a.avg_timeliness),
        avgCommunication: round1(a.avg_communication),
        reliabilityScore: score,
        tier: tierFor(score, a.n),
        typicalContractCents: typical,
      };
    }).sort((x, y) =>
      // preferred first, then reliability, then rating count
      (Number(y.isPreferred) - Number(x.isPreferred)) ||
      (y.reliabilityScore - x.reliabilityScore) ||
      (y.ratingCount - x.ratingCount) ||
      x.name.localeCompare(y.name),
    );
  },

  /** One vendor's score (or undefined if not in org). */
  scoreOne(orgId: string, vendorId: string): VendorScore | undefined {
    return this.scoreAll(orgId).find(s => s.vendorId === vendorId);
  },

  /**
   * Smart matching: rank vendors as candidates for an event. Fit blends:
   *   - reliability score (primary)
   *   - budget-band fit: how close the vendor's typical contract is to a
   *     plausible per-vendor slice of the event budget (penalize over-budget)
   *   - category filter (optional hard filter)
   *
   * Returns scored candidates (best first), each with a `matchReasons` list.
   */
  matchForEvent(orgId: string, opts: { category?: string; budgetCents?: number; limit?: number }): Array<VendorScore & {
    fitScore: number;
    budgetFit: 'under' | 'within' | 'over' | 'unknown';
    matchReasons: string[];
  }> {
    let candidates = this.scoreAll(orgId);
    if (opts.category) {
      const cat = opts.category.toLowerCase();
      candidates = candidates.filter(c => c.category.toLowerCase() === cat);
    }
    // De-duplicate recurring vendors by name (keep the best-scored instance).
    const bestByName = new Map<string, VendorScore>();
    for (const c of candidates) {
      const prev = bestByName.get(c.name);
      if (!prev || c.reliabilityScore > prev.reliabilityScore) bestByName.set(c.name, c);
    }
    const unique = [...bestByName.values()];

    // A rough per-vendor budget envelope: 35% of total event budget is a generous
    // ceiling for any single vendor (covers big-ticket catering/venue).
    const envelope = opts.budgetCents && opts.budgetCents > 0 ? opts.budgetCents * 0.35 : null;

    const ranked = unique.map((c) => {
      const reasons: string[] = [];
      let fit = c.reliabilityScore; // 0–100 base

      if (c.isPreferred) { fit += 8; reasons.push('Preferred vendor'); }
      if (c.tier === 'top_rated') reasons.push(`Top rated (${c.avgRating}★, ${c.ratingCount} reviews)`);
      else if (c.tier === 'trusted') reasons.push(`Trusted (${c.avgRating}★, ${c.ratingCount} reviews)`);
      else if (c.ratingCount > 0) reasons.push(`${c.avgRating}★ from ${c.ratingCount} review${c.ratingCount === 1 ? '' : 's'}`);

      let budgetFit: 'under' | 'within' | 'over' | 'unknown' = 'unknown';
      if (envelope && c.typicalContractCents != null) {
        if (c.typicalContractCents <= envelope * 1.05) {
          budgetFit = c.typicalContractCents >= envelope * 0.4 ? 'within' : 'under';
          fit += budgetFit === 'within' ? 10 : 4;
          reasons.push(budgetFit === 'within' ? 'Fits the budget band' : 'Budget-friendly');
        } else {
          budgetFit = 'over';
          fit -= 12;
          reasons.push('Above typical budget for this event');
        }
      }

      return {
        ...c,
        fitScore: Math.max(0, Math.round(fit)),
        budgetFit,
        matchReasons: reasons.length ? reasons : ['No reviews yet'],
      };
    }).sort((a, b) => b.fitScore - a.fitScore || b.reliabilityScore - a.reliabilityScore);

    return typeof opts.limit === 'number' ? ranked.slice(0, opts.limit) : ranked;
  },
};
