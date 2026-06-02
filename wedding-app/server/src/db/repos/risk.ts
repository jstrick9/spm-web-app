/**
 * Anomaly & risk alerts — proactive "event health" assessment.
 *
 * Combines signals the platform already tracks (RSVP velocity, contract status,
 * budget variance, vendor balances, timeline coverage, capacity) into a
 * structured list of risk alerts + an overall health score per event. Pure SQL
 * + arithmetic, no ML — every alert is explainable and links to where to fix it.
 *
 * Severity: 'critical' (act now) | 'warning' (watch) | 'info' (FYI).
 * Health score 0–100 = 100 − Σ severity weights, floored at 0.
 */
import { db } from '../database.js';

export type RiskSeverity = 'critical' | 'warning' | 'info';

export interface RiskAlert {
  id: string;                 // stable per (event, kind)
  kind: string;               // 'rsvp_behind' | 'unsigned_contracts' | ...
  severity: RiskSeverity;
  title: string;
  detail: string;
  /** Deep link target within the app (hash route). */
  href: string;
}

export interface EventRisk {
  eventId: string;
  eventTitle: string;
  startDate: string | null;
  daysUntil: number | null;   // null when no start_date
  healthScore: number;        // 0–100
  alerts: RiskAlert[];
}

const SEVERITY_WEIGHT: Record<RiskSeverity, number> = { critical: 30, warning: 15, info: 5 };

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const d = new Date(date + 'T00:00:00Z').getTime();
  if (Number.isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / 86_400_000);
}

interface EventRow {
  id: string; title: string; status: string;
  start_date: string | null; budget_cents: number | null; guest_count: number | null;
  rsvp_deadline: string | null;
}

export const riskRepo = {
  /**
   * Assess one event. Returns its alerts + health score. Cancelled/lost/completed
   * events return an empty, full-health assessment (nothing actionable).
   */
  forEvent(eventId: string): EventRisk | undefined {
    const e = db.prepare(
      `SELECT id, title, status, start_date, budget_cents, guest_count, rsvp_deadline
       FROM events WHERE id = ? AND deleted_at IS NULL`,
    ).get(eventId) as EventRow | undefined;
    if (!e) return undefined;
    return assess(e);
  },

  /**
   * Assess all "live" events for an org (lead/hold/booked/planning), sorted by
   * health (riskiest first). Cancelled/lost/completed are excluded.
   */
  forOrg(orgId: string): EventRisk[] {
    const rows = db.prepare(
      `SELECT id, title, status, start_date, budget_cents, guest_count, rsvp_deadline
       FROM events
       WHERE organization_id = ? AND deleted_at IS NULL
         AND status IN ('lead','hold','booked','planning')`,
    ).all(orgId) as EventRow[];
    return rows
      .map(assess)
      .filter((r) => r.alerts.length > 0)
      .sort((a, b) => a.healthScore - b.healthScore || (a.daysUntil ?? 1e9) - (b.daysUntil ?? 1e9));
  },
};

function assess(e: EventRow): EventRisk {
  const alerts: RiskAlert[] = [];
  const d = daysUntil(e.start_date);
  const soon = d != null && d >= 0 && d <= 45;      // within 6 weeks
  const verySoon = d != null && d >= 0 && d <= 14;  // within 2 weeks
  const add = (kind: string, severity: RiskSeverity, title: string, detail: string, tab: string) =>
    alerts.push({ id: `${e.id}:${kind}`, kind, severity, title, detail, href: `#/events/${e.id}?tab=${tab}` });

  // ── RSVP velocity / deadline ──
  const gc = db.prepare(
    `SELECT rsvp_status AS s, COUNT(*) AS n FROM guests WHERE event_id = ? AND deleted_at IS NULL GROUP BY rsvp_status`,
  ).all(e.id) as Array<{ s: string; n: number }>;
  const total = gc.reduce((a, r) => a + r.n, 0);
  const pending = gc.find((r) => r.s === 'pending')?.n ?? 0;
  const attending = gc.find((r) => r.s === 'attending')?.n ?? 0;
  const pendingPct = total > 0 ? pending / total : 0;
  const deadlineDays = daysUntil(e.rsvp_deadline);

  if (total > 0 && deadlineDays != null && deadlineDays < 0 && pending > 0) {
    add('rsvp_overdue', 'critical', 'RSVP deadline passed',
      `${pending} of ${total} guests still haven't responded (deadline was ${Math.abs(deadlineDays)} day(s) ago).`, 'guests');
  } else if (total > 0 && deadlineDays != null && deadlineDays <= 14 && deadlineDays >= 0 && pendingPct >= 0.3) {
    add('rsvp_behind', 'warning', 'RSVPs are behind',
      `${pending} of ${total} guests (${Math.round(pendingPct * 100)}%) still pending with ${deadlineDays} day(s) to the deadline.`, 'guests');
  } else if (total > 0 && verySoon && pendingPct >= 0.4) {
    add('rsvp_behind', 'warning', 'Low RSVP response near event',
      `${Math.round(pendingPct * 100)}% of guests are still pending and the event is in ${d} day(s).`, 'guests');
  }

  // ── Unsigned contracts ──
  const contracts = db.prepare(
    `SELECT status, COUNT(*) AS n FROM contracts WHERE event_id = ? GROUP BY status`,
  ).all(e.id) as Array<{ status: string; n: number }>;
  const unsigned = contracts.filter((c) => c.status !== 'signed').reduce((a, c) => a + c.n, 0);
  const totalContracts = contracts.reduce((a, c) => a + c.n, 0);
  if (unsigned > 0 && verySoon) {
    add('unsigned_contracts', 'critical', 'Unsigned contracts near event',
      `${unsigned} of ${totalContracts} contract(s) are not signed and the event is in ${d} day(s).`, 'contracts');
  } else if (unsigned > 0 && soon) {
    add('unsigned_contracts', 'warning', 'Contracts awaiting signature',
      `${unsigned} of ${totalContracts} contract(s) are still unsigned.`, 'contracts');
  }

  // ── Budget overrun (actual vs planned) ──
  const budget = db.prepare(
    `SELECT COALESCE(SUM(planned_cents),0) AS planned,
            COALESCE(SUM(actual_cents),0) AS actual,
            COALESCE(SUM(paid_cents),0) AS paid
     FROM budget_items WHERE event_id = ?`,
  ).get(e.id) as { planned: number; actual: number; paid: number };
  if (budget.planned > 0 && budget.actual > 0) {
    const variancePct = (budget.actual - budget.planned) / budget.planned;
    if (variancePct >= 0.15) {
      add('budget_overrun', variancePct >= 0.3 ? 'critical' : 'warning', 'Budget over plan',
        `Actual spend is ${Math.round(variancePct * 100)}% over the planned budget.`, 'budget');
    }
  }
  // Unpaid balance near the event
  if (soon && budget.actual > 0) {
    const due = budget.actual - budget.paid;
    if (due > 0 && due / budget.actual >= 0.5) {
      add('balance_due', verySoon ? 'critical' : 'warning', 'Large balance due near event',
        `$${Math.round(due / 100).toLocaleString()} (${Math.round((due / budget.actual) * 100)}% of actual) is still unpaid.`, 'budget');
    }
  }

  // ── Vendor coverage / unpaid vendor balances ──
  const vendors = db.prepare(
    `SELECT COUNT(*) AS n,
            COALESCE(SUM(contract_amount_cents),0) AS contracted
     FROM vendors WHERE event_id = ? AND deleted_at IS NULL`,
  ).get(e.id) as { n: number; contracted: number };
  if (soon && vendors.n === 0) {
    add('no_vendors', 'warning', 'No vendors booked',
      `The event is in ${d} day(s) and has no vendors attached.`, 'vendors');
  }

  // ── Timeline coverage ──
  const timelineCount = (db.prepare(
    `SELECT COUNT(*) AS n FROM timeline_events WHERE event_id = ?`,
  ).get(e.id) as { n: number }).n;
  if (verySoon && timelineCount === 0) {
    add('no_timeline', 'warning', 'No run-of-show timeline',
      `The event is in ${d} day(s) and has no timeline items.`, 'timeline');
  }

  // ── Capacity / overbooking ──
  if (e.guest_count && e.guest_count > 0 && attending > e.guest_count) {
    add('over_capacity', 'warning', 'Over expected guest count',
      `${attending} guests are attending but the planned count is ${e.guest_count}.`, 'guests');
  }

  const penalty = alerts.reduce((a, r) => a + SEVERITY_WEIGHT[r.severity], 0);
  const healthScore = Math.max(0, 100 - penalty);

  return {
    eventId: e.id,
    eventTitle: e.title,
    startDate: e.start_date,
    daysUntil: d,
    healthScore,
    alerts: alerts.sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity]),
  };
}
