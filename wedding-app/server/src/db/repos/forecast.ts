/**
 * Predictive booking & revenue forecasting.
 *
 * No ML / external service — a transparent, explainable model built from the
 * org's own history with plain SQL + arithmetic (consistent with the rest of
 * the intelligence layer):
 *
 *   1. Build a monthly series (bookings + revenue) for the trailing N months.
 *   2. Fit a least-squares linear trend over the series to get direction/slope.
 *   3. Compute a per-calendar-month SEASONAL INDEX (that month's avg ÷ overall
 *      avg) so e.g. June projects higher than January.
 *   4. Project the next H months = baseline (trend value) × seasonal index.
 *   5. Surface a PIPELINE signal: revenue already in the funnel (future
 *      lead/hold/booked/planning events) — a leading indicator that bounds the
 *      statistical projection in reality.
 *
 * A `confidence` label (low/medium/high) is derived from how much history is
 * available, so the UI never over-promises on thin data.
 */
import { db } from '../database.js';

export interface MonthPoint {
  /** ISO 'YYYY-MM'. */
  ym: string;
  label: string;        // e.g. 'Jun 25'
  bookings: number;
  revenueCents: number;
}

export interface ForecastPoint extends MonthPoint {
  projected: true;
  /** seasonal multiplier applied (1.0 = average month). */
  seasonalIndex: number;
}

export interface RevenueForecast {
  history: MonthPoint[];               // trailing actuals
  projection: ForecastPoint[];         // next H months
  trend: {
    direction: 'up' | 'down' | 'flat';
    /** monthly revenue slope in cents (least squares). */
    monthlySlopeCents: number;
    /** % change of the projected window vs the trailing window. */
    growthPct: number;
  };
  totals: {
    trailingRevenueCents: number;      // sum of history window
    projectedRevenueCents: number;     // sum of projection window
    trailingBookings: number;
    projectedBookings: number;
  };
  pipeline: {
    /** future, not-yet-completed events already in the funnel. */
    openEvents: number;
    openRevenueCents: number;
  };
  meta: {
    monthsOfHistory: number;
    horizonMonths: number;
    confidence: 'low' | 'medium' | 'high';
  };
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ymLabel(year: number, month1: number): string {
  return `${MONTH_NAMES[month1 - 1]} ${String(year).slice(2)}`;
}

/** Least-squares slope + intercept for y over x = 0..n-1. */
function linregress(ys: number[]): { slope: number; intercept: number } {
  const n = ys.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: ys[0] };
  const xs = ys.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumXX = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export const forecastRepo = {
  /**
   * @param historyMonths trailing window to learn from (default 24)
   * @param horizonMonths months to project forward (default 6)
   */
  forOrg(orgId: string, historyMonths = 24, horizonMonths = 6): RevenueForecast {
    const now = new Date();
    const startYear = now.getUTCFullYear();
    const startMonth = now.getUTCMonth() + 1; // 1-based

    // ── 1. Pull monthly aggregates from completed/booked/planning events that
    //      have a start_date. Revenue = budget_cents. ──
    const rows = db.prepare(
      `SELECT strftime('%Y-%m', start_date) AS ym,
              COUNT(*) AS bookings,
              COALESCE(SUM(budget_cents), 0) AS revenue
       FROM events
       WHERE organization_id = ?
         AND deleted_at IS NULL
         AND start_date IS NOT NULL
         AND status IN ('booked','planning','completed')
       GROUP BY ym`,
    ).all(orgId) as Array<{ ym: string; bookings: number; revenue: number }>;
    const byYm = new Map(rows.map(r => [r.ym, r]));

    // ── 2. Build a dense trailing series (fill gaps with zeros) ending last month ──
    const history: MonthPoint[] = [];
    for (let i = historyMonths; i >= 1; i--) {
      const d = new Date(Date.UTC(startYear, startMonth - 1 - i, 1));
      const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
      const ym = `${y}-${String(m).padStart(2, '0')}`;
      const found = byYm.get(ym);
      history.push({
        ym, label: ymLabel(y, m),
        bookings: found?.bookings ?? 0,
        revenueCents: found?.revenue ?? 0,
      });
    }

    // ── 3. Seasonal index per calendar month (avg month ÷ overall avg) ──
    const perMonthRev: number[][] = Array.from({ length: 12 }, () => []);
    const perMonthBook: number[][] = Array.from({ length: 12 }, () => []);
    for (const pt of history) {
      const m = Number(pt.ym.slice(5, 7)) - 1;
      perMonthRev[m].push(pt.revenueCents);
      perMonthBook[m].push(pt.bookings);
    }
    const overallAvgRev = avg(history.map(h => h.revenueCents)) || 0;
    const seasonalIndex = perMonthRev.map((vals) => {
      const a = avg(vals);
      return overallAvgRev > 0 ? a / overallAvgRev : 1;
    });

    // ── 4. Trend from the trailing 12 months (more responsive than full window) ──
    const recent = history.slice(-12);
    const revReg = linregress(recent.map(h => h.revenueCents));
    const bookReg = linregress(recent.map(h => h.bookings));
    const nRecent = recent.length;

    // ── 5. Project the next H months ──
    const projection: ForecastPoint[] = [];
    for (let i = 0; i < horizonMonths; i++) {
      const d = new Date(Date.UTC(startYear, startMonth - 1 + i, 1));
      const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
      const seas = seasonalIndex[m - 1] ?? 1;
      // baseline = regression value extrapolated past the recent window
      const baseRev = Math.max(0, revReg.intercept + revReg.slope * (nRecent + i));
      const baseBook = Math.max(0, bookReg.intercept + bookReg.slope * (nRecent + i));
      projection.push({
        ym: `${y}-${String(m).padStart(2, '0')}`,
        label: ymLabel(y, m),
        revenueCents: Math.round(baseRev * seas),
        bookings: Math.round(baseBook * seas),
        projected: true,
        seasonalIndex: Math.round(seas * 100) / 100,
      });
    }

    // ── Trend summary ──
    const trailingRevenueCents = sum(history.slice(-horizonMonths).map(h => h.revenueCents));
    const projectedRevenueCents = sum(projection.map(p => p.revenueCents));
    const growthPct = trailingRevenueCents > 0
      ? Math.round(((projectedRevenueCents - trailingRevenueCents) / trailingRevenueCents) * 100)
      : 0;
    const direction: 'up' | 'down' | 'flat' =
      revReg.slope > overallAvgRev * 0.02 ? 'up'
        : revReg.slope < -overallAvgRev * 0.02 ? 'down'
          : 'flat';

    // ── Pipeline (leading indicator): future open events ──
    const pipe = db.prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(budget_cents),0) AS rev
       FROM events
       WHERE organization_id = ? AND deleted_at IS NULL
         AND status IN ('lead','hold','booked','planning')
         AND start_date IS NOT NULL
         AND date(start_date) >= date('now')`,
    ).get(orgId) as { n: number; rev: number };

    // ── Confidence from amount of non-empty history ──
    const monthsWithData = history.filter(h => h.bookings > 0).length;
    const confidence: 'low' | 'medium' | 'high' =
      monthsWithData >= 12 ? 'high' : monthsWithData >= 6 ? 'medium' : 'low';

    return {
      history,
      projection,
      trend: {
        direction,
        monthlySlopeCents: Math.round(revReg.slope),
        growthPct,
      },
      totals: {
        trailingRevenueCents,
        projectedRevenueCents,
        trailingBookings: sum(history.slice(-horizonMonths).map(h => h.bookings)),
        projectedBookings: sum(projection.map(p => p.bookings)),
      },
      pipeline: { openEvents: pipe.n, openRevenueCents: pipe.rev },
      meta: { monthsOfHistory: monthsWithData, horizonMonths, confidence },
    };
  },
};

function sum(a: number[]): number { return a.reduce((x, y) => x + y, 0); }
function avg(a: number[]): number { return a.length ? sum(a) / a.length : 0; }
