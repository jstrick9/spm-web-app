/**
 * Event readiness checks: timeline conflicts + layout readiness.
 *
 * Pure, explainable checks used by the event Timeline tab and future health
 * command actions. No external services; everything is derived from the event's
 * timeline, vendors, guests, and latest approved/event layout payload.
 */
import { db } from '../database.js';
import { parseJson } from '../../lib/json.js';
import type { TimelineEventRow } from './timeline.js';

export type ReadinessSeverity = 'critical' | 'warning' | 'info';
export type ReadinessCategory = 'timeline' | 'layout' | 'vendors' | 'guests' | 'staff';

export interface ReadinessIssue {
  id: string;
  severity: ReadinessSeverity;
  category: ReadinessCategory;
  title: string;
  detail: string;
  href: string;
  relatedIds: string[];
  ownerExplanation?: string;
}

export interface EventReadiness {
  eventId: string;
  score: number;
  summary: {
    timelineItems: number;
    vendors: number;
    attendingGuests: number;
    layoutSeats: number;
    assignedSeats: number;
    hasApprovedLayout: boolean;
  };
  issues: ReadinessIssue[];
}

interface EventRow { id: string; organization_id: string; title: string; start_date: string | null }
interface VendorRow { id: string; name: string; category: string }
interface GuestStatusRow { rsvp_status: string; n: number }
interface LayoutRow { id: string; approval_status: string; payload: string }

const WEIGHTS: Record<ReadinessSeverity, number> = { critical: 25, warning: 12, info: 4 };

function toMillis(value: string | null): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function intervalFor(item: TimelineEventRow): { start: number; end: number } | null {
  const start = toMillis(item.starts_at);
  if (start == null) return null;
  const end = toMillis(item.ends_at) ?? start + (item.duration_min ?? 30) * 60_000;
  return { start, end: Math.max(end, start + 5 * 60_000) };
}

function layoutPayload(payload: string): any {
  return parseJson(payload, {} as any);
}

function layoutItems(payload: string): any[] {
  const parsed = layoutPayload(payload);
  return Array.isArray(parsed?.items) ? parsed.items : [];
}

function isSeat(item: any): boolean {
  return item?.type === 'chair' || item?.type === 'seat';
}

function bounds(item: any): { x: number; y: number; w: number; h: number } | null {
  if (typeof item?.x !== 'number' || typeof item?.y !== 'number') return null;
  const w = Number(item.width ?? (item.radius ? item.radius * 2 : 24));
  const h = Number(item.height ?? (item.radius ? item.radius * 2 : 24));
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return { x: item.x - w / 2, y: item.y - h / 2, w, h };
}

function overlaps(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export const eventReadinessRepo = {
  forEvent(eventId: string): EventReadiness | undefined {
    const event = db.prepare(`SELECT id, organization_id, title, start_date FROM events WHERE id = ? AND deleted_at IS NULL`).get(eventId) as EventRow | undefined;
    if (!event) return undefined;

    const issues: ReadinessIssue[] = [];
    const add = (issue: ReadinessIssue) => issues.push(issue);

    const timeline = db.prepare(`SELECT * FROM timeline_events WHERE event_id = ? ORDER BY starts_at`).all(eventId) as TimelineEventRow[];
    const vendors = db.prepare(`SELECT id, name, category FROM vendors WHERE event_id = ? AND deleted_at IS NULL`).all(eventId) as VendorRow[];
    const guestCounts = db.prepare(`SELECT rsvp_status, COUNT(*) AS n FROM guests WHERE event_id = ? AND deleted_at IS NULL GROUP BY rsvp_status`).all(eventId) as GuestStatusRow[];
    const attending = guestCounts.find(g => g.rsvp_status === 'attending')?.n ?? 0;

    // ── Timeline overlap checks ─────────────────────────
    for (let i = 0; i < timeline.length; i++) {
      const a = intervalFor(timeline[i]);
      if (!a) continue;
      for (let j = i + 1; j < timeline.length; j++) {
        const b = intervalFor(timeline[j]);
        if (!b) continue;
        if (a.start < b.end && b.start < a.end) {
          add({
            id: `timeline-overlap:${timeline[i].id}:${timeline[j].id}`,
            severity: 'warning',
            category: 'timeline',
            title: 'Timeline items overlap',
            detail: `“${timeline[i].title}” overlaps with “${timeline[j].title}”. Confirm staffing/vendor coverage or adjust times.`,
            href: `#/events/${eventId}?tab=timeline`,
            relatedIds: [timeline[i].id, timeline[j].id],
          });
        }
      }
    }

    // ── Missing key timeline phases ──────────────────────
    const categories = new Set(timeline.map(t => (t.category || '').toLowerCase()));
    for (const phase of ['ceremony', 'reception']) {
      if (!categories.has(phase)) {
        add({
          id: `timeline-missing:${phase}`,
          severity: timeline.length === 0 ? 'critical' : 'warning',
          category: 'timeline',
          title: `Missing ${phase} timeline phase`,
          detail: `No ${phase} timeline item is scheduled yet. Add it to anchor vendor, staff, and guest logistics.`,
          href: `#/events/${eventId}?tab=timeline`,
          relatedIds: [],
        });
      }
    }

    // ── Vendor timeline coverage ─────────────────────────
    const timelineVendorIds = new Set(timeline.map(t => t.vendor_id).filter(Boolean));
    const vendorsWithoutTimeline = vendors.filter(v => !timelineVendorIds.has(v.id));
    if (vendors.length > 0 && vendorsWithoutTimeline.length > 0) {
      add({
        id: 'vendors-without-timeline',
        severity: vendorsWithoutTimeline.length === vendors.length ? 'warning' : 'info',
        category: 'vendors',
        title: 'Vendors missing timeline assignments',
        detail: `${vendorsWithoutTimeline.length} of ${vendors.length} assigned vendor(s) are not linked to timeline items.`,
        href: `#/events/${eventId}?tab=vendors`,
        relatedIds: vendorsWithoutTimeline.map(v => v.id),
      });
    }

    // ── Timeline dependency warnings ─────────────────────
    const lower = (v: string | null | undefined) => (v ?? '').toLowerCase();
    const byNeedle = (needles: string[]) => timeline.find(t => needles.some(n => lower(t.title).includes(n) || lower(t.category).includes(n)));
    const timeOf = (item?: TimelineEventRow) => item ? intervalFor(item)?.start ?? null : null;
    const dependencyChecks: Array<{ id: string; before: string[]; after: string[]; title: string; detail: string }> = [
      { id: 'dep-catering-before-dinner', before: ['catering setup', 'caterer arrival', 'catering arrival'], after: ['dinner', 'meal service'], title: 'Catering setup should happen before dinner', detail: 'Catering setup/load-in appears after or too close to dinner service.' },
      { id: 'dep-dj-soundcheck-before-ceremony', before: ['soundcheck', 'sound check'], after: ['ceremony', 'reception'], title: 'DJ soundcheck should happen before ceremony/reception', detail: 'Audio checks should happen before guests arrive for ceremony or reception programming.' },
      { id: 'dep-photos-before-grand-entrance', before: ['photos', 'portraits', 'photography'], after: ['grand entrance'], title: 'Photos should happen before grand entrance', detail: 'Photo timing appears after grand entrance. Confirm couple/family portraits happen before introductions.' },
      { id: 'dep-teardown-after-reception', before: ['reception', 'last dance', 'send off', 'send-off'], after: ['teardown', 'strike', 'load out', 'load-out'], title: 'Teardown should happen after reception ends', detail: 'Teardown/load-out appears before reception is complete.' },
    ];
    for (const check of dependencyChecks) {
      const beforeItem = byNeedle(check.before);
      const afterItem = byNeedle(check.after);
      const beforeTime = timeOf(beforeItem);
      const afterTime = timeOf(afterItem);
      if (beforeItem && afterItem && beforeTime != null && afterTime != null && beforeTime > afterTime) {
        add({ id: check.id, severity: 'warning', category: 'timeline', title: check.title, detail: check.detail, href: `#/events/${eventId}?tab=timeline`, relatedIds: [beforeItem.id, afterItem.id], ownerExplanation: 'This dependency prevents rushed setup, guest-facing delays, and vendor confusion on event day.' });
      }
    }

    // ── Staffing coverage by phase ───────────────────────
    const staffShifts = db.prepare(`SELECT * FROM staff_shifts WHERE event_id = ?`).all(eventId) as Array<{ id: string; role: string; starts_at: string; ends_at: string }>;
    for (const phase of timeline.filter(t => ['ceremony','reception','cocktail','prep'].includes(lower(t.category)))) {
      const p = intervalFor(phase);
      if (!p) continue;
      const covered = staffShifts.some(s => {
        const start = toMillis(s.starts_at); const end = toMillis(s.ends_at);
        return start != null && end != null && start <= p.start && end >= p.end;
      });
      if (!covered) add({ id: `staff-coverage:${phase.id}`, severity: 'warning', category: 'staff', title: `No full staff coverage for ${phase.title}`, detail: `No staff shift fully covers the ${phase.category} phase.`, href: `#/events/${eventId}?tab=staff`, relatedIds: [phase.id], ownerExplanation: 'Each major event phase should have staff assigned from before it starts until after it ends.' });
    }

    // ── Vendor arrival/departure conflicts ───────────────
    const vendorMoves = timeline.filter(t => t.vendor_id && ['vendor_arrival','load_in','load-out','load_out','teardown'].includes(lower(t.category)));
    for (let i = 0; i < vendorMoves.length; i++) {
      const a = intervalFor(vendorMoves[i]); if (!a) continue;
      for (let j = i + 1; j < vendorMoves.length; j++) {
        const b = intervalFor(vendorMoves[j]); if (!b) continue;
        if (a.start < b.end && b.start < a.end) add({ id: `vendor-load-conflict:${vendorMoves[i].id}:${vendorMoves[j].id}`, severity: 'warning', category: 'vendors', title: 'Vendor arrival/load-out conflict', detail: `“${vendorMoves[i].title}” overlaps with “${vendorMoves[j].title}”. Confirm dock/gate capacity and staffing.`, href: `#/events/${eventId}?tab=timeline`, relatedIds: [vendorMoves[i].id, vendorMoves[j].id], ownerExplanation: 'Overlapping load-in or departure windows can block driveways, loading docks, elevators, and vendor setup zones.' });
      }
    }

    // ── Layout readiness ─────────────────────────────────
    const layouts = db.prepare(
      `SELECT id, approval_status, payload FROM layouts WHERE event_id = ? ORDER BY CASE approval_status WHEN 'approved' THEN 0 ELSE 1 END, updated_at DESC`,
    ).all(eventId) as LayoutRow[];
    const layout = layouts[0];
    const hasApprovedLayout = layouts.some(l => l.approval_status === 'approved');
    let seats = 0;
    let assignedSeats = 0;

    if (!layout) {
      add({
        id: 'layout-missing',
        severity: attending > 0 ? 'critical' : 'warning',
        category: 'layout',
        title: 'No event layout exists',
        detail: 'Create a seating/floorplan layout so guest capacity, vendor zones, and setup paths can be verified.',
        href: `#/events/${eventId}?tab=layout`,
        relatedIds: [],
      });
    } else {
      if (!hasApprovedLayout) {
        add({
          id: 'layout-not-approved',
          severity: 'warning',
          category: 'layout',
          title: 'Layout is not approved',
          detail: 'A layout exists, but no approved version is available for operations. Submit/approve the final layout before event day.',
          href: `#/events/${eventId}?tab=layout`,
          relatedIds: [layout.id],
        });
      }

      const payload = layoutPayload(layout.payload);
      const items: any[] = Array.isArray(payload?.items) ? payload.items : [];
      const seatItems = items.filter(isSeat);
      seats = seatItems.length;
      assignedSeats = seatItems.filter((s: any) => s.guestId).length;

      if (attending > 0 && seats < attending) {
        add({
          id: 'layout-seat-shortage',
          severity: 'critical',
          category: 'layout',
          title: 'Not enough seats for attending guests',
          detail: `${attending} guests are attending, but the current layout has ${seats} seat(s).`,
          href: `#/events/${eventId}?tab=layout`,
          relatedIds: [layout.id],
        });
      }

      const seenGuests = new Set<string>();
      const duplicateGuests = new Set<string>();
      for (const seat of seatItems) {
        if (!seat.guestId) continue;
        if (seenGuests.has(seat.guestId)) duplicateGuests.add(seat.guestId);
        seenGuests.add(seat.guestId);
      }
      if (duplicateGuests.size > 0) {
        add({
          id: 'layout-duplicate-seating',
          severity: 'warning',
          category: 'layout',
          title: 'Duplicate guest seating assignments',
          detail: `${duplicateGuests.size} guest(s) appear assigned to more than one seat.`,
          href: `#/events/${eventId}?tab=layout`,
          relatedIds: [...duplicateGuests],
        });
      }

      const physical = items.filter((i: any) => ['round_table','rect_table','table','fixture','dance_floor','vendor_zone'].includes(i?.type));
      let collisionCount = 0;
      for (let i = 0; i < physical.length; i++) {
        const a = bounds(physical[i]);
        if (!a) continue;
        for (let j = i + 1; j < physical.length; j++) {
          const b = bounds(physical[j]);
          if (!b) continue;
          if (overlaps(a, b)) collisionCount++;
        }
      }
      if (collisionCount > 0) {
        add({
          id: 'layout-collisions',
          severity: collisionCount >= 3 ? 'critical' : 'warning',
          category: 'layout',
          title: 'Possible layout collisions detected',
          detail: `${collisionCount} possible object overlap(s) were detected in the floorplan. Review spacing and walkways.`,
          href: `#/events/${eventId}?tab=layout`,
          relatedIds: [layout.id],
          ownerExplanation: 'Overlapping floorplan objects can block guest flow, staff service paths, and vendor setup zones.',
        });
      }

      const getLabel = (i: any) => String(i?.label || i?.vendorName || i?.type || '').toLowerCase();
      const centerDistance = (a: any, b: any) => Math.hypot(Number(a?.x ?? 0) - Number(b?.x ?? 0), Number(a?.y ?? 0) - Number(b?.y ?? 0));
      const paths = items.filter((i: any) => ['ada_path','walkway','aisle','load_in_path'].includes(i?.type));
      const adaPaths = paths.filter((i: any) => i?.type === 'ada_path' || /ada|accessible|accessibility/.test(getLabel(i)));
      if (attending > 0 && adaPaths.length === 0) {
        add({ id: 'layout-ada-path-missing', severity: 'warning', category: 'layout', title: 'ADA/accessibility path not marked', detail: 'No ADA/accessibility path is marked on the layout.', href: `#/events/${eventId}?tab=layout`, relatedIds: [layout.id], ownerExplanation: 'Marking an accessibility path helps staff protect clear routes for wheelchairs, mobility devices, and guests needing assistance.' });
      }
      const narrowAda = adaPaths.filter((i: any) => Number(i.width ?? i.pathWidth ?? 0) > 0 && Number(i.width ?? i.pathWidth ?? 0) < 36);
      if (narrowAda.length > 0) {
        add({ id: 'layout-ada-path-narrow', severity: 'critical', category: 'layout', title: 'ADA path may be too narrow', detail: `${narrowAda.length} accessibility path segment(s) are below the 36 inch minimum marker.`, href: `#/events/${eventId}?tab=layout`, relatedIds: narrowAda.map((i: any) => i.id).filter(Boolean), ownerExplanation: 'Accessible routes should remain wide enough for mobility devices and staff assistance throughout the event.' });
      }

      const exits = items.filter((i: any) => ['fire_exit','exit'].includes(i?.type) || /fire exit|exit/.test(getLabel(i)));
      if (attending > 0 && exits.length === 0) {
        add({ id: 'layout-fire-exits-unmarked', severity: 'warning', category: 'layout', title: 'Fire exits are not marked', detail: 'No fire exits are marked on this layout.', href: `#/events/${eventId}?tab=layout`, relatedIds: [layout.id], ownerExplanation: 'Mark exits so tables, decor, catering, and dance floor items do not block emergency egress.' });
      }
      const blockedExits = exits.filter((exit: any) => physical.some((obj: any) => obj.id !== exit.id && centerDistance(exit, obj) < Number(exit.clearancePx ?? 72)));
      if (blockedExits.length > 0) {
        add({ id: 'layout-fire-exit-clearance', severity: 'critical', category: 'layout', title: 'Fire exit clearance risk', detail: `${blockedExits.length} marked exit(s) may have objects inside the clearance zone.`, href: `#/events/${eventId}?tab=layout`, relatedIds: blockedExits.map((i: any) => i.id).filter(Boolean), ownerExplanation: 'Exit paths must remain clear for guests, vendors, and emergency responders.' });
      }

      const danceFloors = items.filter((i: any) => i?.type === 'dance_floor');
      const serviceZones = items.filter((i: any) => i?.type === 'vendor_zone' && /catering|bar|service|prep/.test(getLabel(i)));
      const clearanceConflicts = [...danceFloors, ...serviceZones].filter((zone: any) => physical.some((obj: any) => obj.id !== zone.id && centerDistance(zone, obj) < Number(zone.clearancePx ?? 64)));
      if (clearanceConflicts.length > 0) {
        add({ id: 'layout-service-clearance', severity: 'warning', category: 'layout', title: 'Dance floor or service area clearance warning', detail: `${clearanceConflicts.length} dance floor/service zone(s) may not have enough surrounding clearance.`, href: `#/events/${eventId}?tab=layout`, relatedIds: clearanceConflicts.map((i: any) => i.id).filter(Boolean), ownerExplanation: 'Dance floors, catering stations, bars, and service lanes need extra buffer so guests and staff can move safely.' });
      }

      const outlets = items.filter((i: any) => ['power_outlet','high_voltage_source'].includes(i?.type));
      const poweredZones = items.filter((i: any) => i?.type === 'vendor_zone' && /dj|band|catering|bar|photo booth|lighting/.test(getLabel(i)));
      const zonesWithoutPower = poweredZones.filter((zone: any) => !outlets.some((outlet: any) => centerDistance(zone, outlet) <= Number(zone.powerRadiusPx ?? 180)));
      if (zonesWithoutPower.length > 0) {
        add({ id: 'layout-power-proximity', severity: 'warning', category: 'layout', title: 'Vendor zones may be too far from power', detail: `${zonesWithoutPower.length} DJ/band/catering/service zone(s) are not near a marked power source.`, href: `#/events/${eventId}?tab=layout`, relatedIds: zonesWithoutPower.map((i: any) => i.id).filter(Boolean), ownerExplanation: 'Power proximity prevents unsafe extension-cord runs and day-of setup delays.' });
      }

      const vendorZones = items.filter((i: any) => i?.type === 'vendor_zone');
      const vendorLines = Array.isArray(payload?.vendorLines) ? payload.vendorLines : [];
      const loadPaths = items.filter((i: any) => i?.type === 'load_in_path');
      if (vendorZones.length > 0 && vendorLines.length === 0 && loadPaths.length === 0) {
        add({ id: 'layout-vendor-load-path-missing', severity: 'warning', category: 'layout', title: 'Vendor load-in path not marked', detail: 'Vendor setup zones exist, but no load-in route/path is marked.', href: `#/events/${eventId}?tab=layout`, relatedIds: vendorZones.map((i: any) => i.id).filter(Boolean), ownerExplanation: 'A marked vendor route prevents trucks, carts, and equipment from crossing guest-facing areas.' });
      }

      const minTableSpacing = Number(payload?.minimumTableSpacingPx ?? 40);
      let tableSpacingConflicts = 0;
      const tables = items.filter((i: any) => ['round_table','rect_table','table'].includes(i?.type));
      for (let i = 0; i < tables.length; i++) {
        const aRadius = Number(tables[i].radius ?? Math.max(tables[i].width ?? 32, tables[i].height ?? 32) / 2);
        for (let j = i + 1; j < tables.length; j++) {
          const bRadius = Number(tables[j].radius ?? Math.max(tables[j].width ?? 32, tables[j].height ?? 32) / 2);
          if (centerDistance(tables[i], tables[j]) - (aRadius + bRadius) < minTableSpacing) tableSpacingConflicts++;
        }
      }
      if (tableSpacingConflicts > 0) {
        add({ id: 'layout-table-spacing', severity: 'warning', category: 'layout', title: 'Table spacing below venue minimum', detail: `${tableSpacingConflicts} table spacing pair(s) are below the configured minimum (${minTableSpacing}px).`, href: `#/events/${eventId}?tab=layout`, relatedIds: [layout.id], ownerExplanation: 'Minimum table spacing keeps servers, guests, and mobility devices from getting pinched between tables.' });
      }
    }

    const penalty = issues.reduce((sum, i) => sum + WEIGHTS[i.severity], 0);
    return {
      eventId,
      score: Math.max(0, 100 - penalty),
      summary: {
        timelineItems: timeline.length,
        vendors: vendors.length,
        attendingGuests: attending,
        layoutSeats: seats,
        assignedSeats,
        hasApprovedLayout,
      },
      issues: issues.sort((a, b) => WEIGHTS[b.severity] - WEIGHTS[a.severity] || a.title.localeCompare(b.title)),
    };
  },
};
