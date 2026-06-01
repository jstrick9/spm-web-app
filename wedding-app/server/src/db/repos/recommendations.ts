/**
 * Recommendations Engine — statistical analysis of historical event data.
 *
 * No ML involved — uses percentiles, medians, and frequency counts
 * to generate data-driven suggestions for new events.
 */
import { db } from '../database.js';

export interface EventRecommendations {
  budgetRange: { p25: number; median: number; p75: number; count: number };
  guestCountRange: { p25: number; median: number; p75: number };
  topVendorCategories: Array<{ category: string; count: number; avgRating: number }>;
  seasonalDemand: Array<{ month: number; monthName: string; count: number; percentage: number }>;
  avgTimelineItems: number;
  popularMealChoices: Array<{ choice: string; count: number }>;
  leadSourceEffectiveness: Array<{ source: string; totalLeads: number; converted: number; conversionRate: number }>;
}

export const recommendationsRepo = {
  /** Generate recommendations based on historical org data. */
  forOrg(orgId: string): EventRecommendations {
    // Budget analysis (from completed/booked events)
    const budgets = db.prepare(
      `SELECT budget_cents FROM events WHERE organization_id = ? AND budget_cents > 0 AND status IN ('booked','planning','completed') AND deleted_at IS NULL ORDER BY budget_cents`
    ).all(orgId) as Array<{ budget_cents: number }>;

    const budgetValues = budgets.map(b => b.budget_cents);
    const budgetRange = {
      p25: percentile(budgetValues, 25),
      median: percentile(budgetValues, 50),
      p75: percentile(budgetValues, 75),
      count: budgetValues.length,
    };

    // Guest count analysis
    const guests = db.prepare(
      `SELECT guest_count FROM events WHERE organization_id = ? AND guest_count > 0 AND status IN ('booked','planning','completed') AND deleted_at IS NULL ORDER BY guest_count`
    ).all(orgId) as Array<{ guest_count: number }>;

    const guestValues = guests.map(g => g.guest_count);
    const guestCountRange = {
      p25: percentile(guestValues, 25),
      median: percentile(guestValues, 50),
      p75: percentile(guestValues, 75),
    };

    // Top vendor categories (most frequently booked)
    const topVendors = db.prepare(
      `SELECT v.category, COUNT(*) as count,
              COALESCE(AVG(vr.rating), 0) as avg_rating
       FROM vendors v
       LEFT JOIN vendor_ratings vr ON vr.vendor_id = v.id
       WHERE v.organization_id = ? AND v.deleted_at IS NULL AND v.category != 'other'
       GROUP BY v.category ORDER BY count DESC LIMIT 10`
    ).all(orgId) as Array<{ category: string; count: number; avg_rating: number }>;

    const topVendorCategories = topVendors.map(v => ({
      category: v.category,
      count: v.count,
      avgRating: Math.round(v.avg_rating * 10) / 10,
    }));

    // Seasonal demand (which months have the most events)
    const seasonal = db.prepare(
      `SELECT CAST(strftime('%m', start_date) AS INTEGER) as month, COUNT(*) as count
       FROM events WHERE organization_id = ? AND start_date IS NOT NULL AND deleted_at IS NULL
       GROUP BY month ORDER BY month`
    ).all(orgId) as Array<{ month: number; count: number }>;

    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const totalEvents = seasonal.reduce((s, m) => s + m.count, 0) || 1;
    const seasonalDemand = Array.from({ length: 12 }, (_, i) => {
      const found = seasonal.find(s => s.month === i + 1);
      return {
        month: i + 1,
        monthName: monthNames[i + 1],
        count: found?.count ?? 0,
        percentage: Math.round(((found?.count ?? 0) / totalEvents) * 100),
      };
    });

    // Average timeline items per event
    const avgTimeline = db.prepare(
      `SELECT AVG(item_count) as avg FROM (
        SELECT COUNT(*) as item_count FROM timeline_events
        WHERE organization_id = ? GROUP BY event_id
      )`
    ).get(orgId) as { avg: number | null };

    // Popular meal choices from RSVPs
    const meals = db.prepare(
      `SELECT meal_choice, COUNT(*) as count FROM rsvp_submissions
       WHERE organization_id = ? AND meal_choice IS NOT NULL AND meal_choice != ''
       GROUP BY meal_choice ORDER BY count DESC LIMIT 5`
    ).all(orgId) as Array<{ meal_choice: string; count: number }>;

    // Lead source effectiveness
    const leadSources = db.prepare(
      `SELECT lead_source as source,
              COUNT(*) as total_leads,
              SUM(CASE WHEN status IN ('booked','planning','completed') THEN 1 ELSE 0 END) as converted
       FROM events WHERE organization_id = ? AND lead_source IS NOT NULL AND deleted_at IS NULL
       GROUP BY lead_source ORDER BY converted DESC`
    ).all(orgId) as Array<{ source: string; total_leads: number; converted: number }>;

    const leadSourceEffectiveness = leadSources.map(ls => ({
      source: ls.source,
      totalLeads: ls.total_leads,
      converted: ls.converted,
      conversionRate: Math.round((ls.converted / ls.total_leads) * 100),
    }));

    return {
      budgetRange,
      guestCountRange,
      topVendorCategories,
      seasonalDemand,
      avgTimelineItems: Math.round(avgTimeline.avg ?? 0),
      popularMealChoices: meals.map(m => ({ choice: m.meal_choice, count: m.count })),
      leadSourceEffectiveness,
    };
  },
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return Math.round(sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower));
}
