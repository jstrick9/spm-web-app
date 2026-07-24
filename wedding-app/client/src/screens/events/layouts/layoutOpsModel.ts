export const DEFAULT_ITEMS = [
  { id: 't1', type: 'round_table', x: 200, y: 200, radius: 40, label: 'Table 1', rotation: 0 },
  { id: 't2', type: 'rect_table', x: 400, y: 150, width: 120, height: 60, label: 'Head Table', rotation: 15 },
  { id: 'c1', type: 'chair', x: 200, y: 140, radius: 10, label: '', rotation: 0 },
  { id: 'd1', type: 'dance_floor', x: 400, y: 400, width: 150, height: 150, label: 'Dance Floor', rotation: 0 }
];

export function itemLabel(item: any): string {
  return String(item.label || item.vendorName || item.type || 'Object');
}

export function centerDistance(a: any, b: any): number {
  return Math.hypot(Number(a?.x ?? 0) - Number(b?.x ?? 0), Number(a?.y ?? 0) - Number(b?.y ?? 0));
}

export type FloorWalkCheckId = 'exits' | 'ada' | 'power' | 'tables' | 'vendor_zones' | 'rain_plan' | 'fire_marshal' | 'accessibility';

export interface ManagerLayoutOpsState {
  floorWalkChecks: Partial<Record<FloorWalkCheckId, boolean>>;
  floorWalkCompletedAt?: string;
  rainPlanActive?: boolean;
  rainPlanActivatedAt?: string;
  varianceEvidence: Array<{ id: string; at: string; note: string; status: 'open' | 'resolved'; photoUrl?: string | null }>;
}

export const FLOOR_WALK_CHECKS: Array<{ id: FloorWalkCheckId; label: string; detail: string }> = [
  { id: 'exits', label: 'Exits clear and marked', detail: 'Verify exit doors, exit signs, and egress paths are not blocked by tables, bars, decor, or vendor gear.' },
  { id: 'ada', label: 'ADA route / aisle verified', detail: 'Walk the accessible route from arrival through ceremony, reception, restrooms, and exits.' },
  { id: 'power', label: 'Power and cable paths safe', detail: 'Confirm DJ/band/catering/photo booth power, cable ramps, and no trip hazards.' },
  { id: 'tables', label: 'Tables/chairs match approved plan', detail: 'Count tables, chairs, head table, dance floor, and spacing against the printed packet.' },
  { id: 'vendor_zones', label: 'Vendor zones and load-in verified', detail: 'Confirm catering, DJ, bar, photo, florist, and rental zones with load-in/strike path.' },
  { id: 'rain_plan', label: 'Rain plan decision documented', detail: 'Confirm indoor/outdoor decision, moved zones, couple/planner communication, and signage.' },
  { id: 'fire_marshal', label: 'Fire marshal packet ready', detail: 'Check extinguishers, exits, occupancy, generator/candle/open-flame notes, and aisle clearance.' },
  { id: 'accessibility', label: 'Accessibility service notes ready', detail: 'Confirm ramps, reserved seating, restroom path, shuttle/golf cart needs, and guest assistance contacts.' },
];

export const DEFAULT_MANAGER_LAYOUT_OPS: ManagerLayoutOpsState = {
  floorWalkChecks: {},
  varianceEvidence: [],
  rainPlanActive: false,
};

export function managerLayoutOpsFromBackend(ops: any): ManagerLayoutOpsState {
  const floorWalkChecks: Partial<Record<FloorWalkCheckId, boolean>> = {};
  for (const check of ops.floorWalkChecks || []) {
    floorWalkChecks[check.check_id as FloorWalkCheckId] = check.status === 'verified';
  }
  return {
    floorWalkChecks,
    floorWalkCompletedAt: (ops.floorWalkChecks || []).every((check: any) => check.status === 'verified') && ops.floorWalkChecks?.length ? new Date().toISOString() : undefined,
    rainPlanActive: !!ops.rainPlan?.active,
    rainPlanActivatedAt: ops.rainPlan?.activated_at,
    varianceEvidence: (ops.varianceEvidence || []).map((item: any) => ({ id: item.id, at: item.created_at, note: item.note, status: item.status, photoUrl: item.photo_url })),
  };
}

