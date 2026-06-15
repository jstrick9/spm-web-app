import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';

export type LayoutFloorWalkStatus = 'pending' | 'verified' | 'issue';
export type LayoutVarianceStatus = 'open' | 'resolved';
export type LayoutPacketAudience = 'setup_crew' | 'vendors' | 'planner' | 'fire_marshal';

export interface LayoutFloorWalkCheckRow {
  id: string;
  organization_id: string;
  event_id: string | null;
  layout_id: string;
  check_id: string;
  status: LayoutFloorWalkStatus;
  note: string | null;
  verified_by: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LayoutVarianceEvidenceRow {
  id: string;
  organization_id: string;
  event_id: string | null;
  layout_id: string;
  note: string;
  photo_url: string | null;
  status: LayoutVarianceStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface LayoutRainPlanActivationRow {
  id: string;
  organization_id: string;
  event_id: string | null;
  layout_id: string;
  active: number;
  note: string | null;
  activated_by: string | null;
  activated_at: string;
}

export interface LayoutVendorZoneInspectionRow {
  id: string;
  organization_id: string;
  event_id: string | null;
  layout_id: string;
  vendor_id: string | null;
  status: LayoutFloorWalkStatus;
  zone_label: string | null;
  note: string | null;
  inspected_by: string | null;
  inspected_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LayoutSetupPacketRow {
  id: string;
  organization_id: string;
  event_id: string | null;
  layout_id: string;
  token: string;
  audience: LayoutPacketAudience;
  payload: string;
  expires_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function packetToken(): string {
  return `${uuid()}${uuid()}`.replace(/-/g, '');
}

export const layoutOpsRepo = {
  listForLayout(layoutId: string) {
    const rainPlan = db.prepare(`SELECT * FROM layout_rain_plan_activations WHERE layout_id = ? ORDER BY activated_at DESC, id DESC LIMIT 1`).get(layoutId) as LayoutRainPlanActivationRow | undefined;
    return {
      floorWalkChecks: db.prepare(`SELECT * FROM layout_floor_walk_checks WHERE layout_id = ? ORDER BY check_id`).all(layoutId) as LayoutFloorWalkCheckRow[],
      varianceEvidence: db.prepare(`SELECT * FROM layout_variance_evidence WHERE layout_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`).all(layoutId) as LayoutVarianceEvidenceRow[],
      rainPlan: rainPlan ?? null,
      vendorZoneInspections: db.prepare(`SELECT * FROM layout_vendor_zone_inspections WHERE layout_id = ? ORDER BY updated_at DESC, id DESC LIMIT 100`).all(layoutId) as LayoutVendorZoneInspectionRow[],
      setupPackets: db.prepare(`SELECT * FROM layout_setup_packets WHERE layout_id = ? ORDER BY updated_at DESC`).all(layoutId) as LayoutSetupPacketRow[],
    };
  },

  setFloorWalkCheck(input: { orgId: string; eventId?: string | null; layoutId: string; checkId: string; status: LayoutFloorWalkStatus; note?: string; actorId?: string | null }): LayoutFloorWalkCheckRow {
    const existing = db.prepare(`SELECT * FROM layout_floor_walk_checks WHERE layout_id = ? AND check_id = ?`).get(input.layoutId, input.checkId) as LayoutFloorWalkCheckRow | undefined;
    const verifiedAt = input.status === 'verified' ? new Date().toISOString() : null;
    if (existing) {
      db.prepare(`UPDATE layout_floor_walk_checks SET status = ?, note = ?, verified_by = ?, verified_at = ?, updated_at = datetime('now') WHERE id = ?`).run(
        input.status, input.note ?? existing.note, input.actorId ?? existing.verified_by, verifiedAt, existing.id,
      );
      return db.prepare(`SELECT * FROM layout_floor_walk_checks WHERE id = ?`).get(existing.id) as LayoutFloorWalkCheckRow;
    }
    const id = uuid();
    db.prepare(`INSERT INTO layout_floor_walk_checks (id, organization_id, event_id, layout_id, check_id, status, note, verified_by, verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, input.orgId, input.eventId ?? null, input.layoutId, input.checkId, input.status, input.note ?? null, input.actorId ?? null, verifiedAt,
    );
    return db.prepare(`SELECT * FROM layout_floor_walk_checks WHERE id = ?`).get(id) as LayoutFloorWalkCheckRow;
  },

  addVarianceEvidence(input: { orgId: string; eventId?: string | null; layoutId: string; note: string; photoUrl?: string | null; actorId?: string | null }): LayoutVarianceEvidenceRow {
    const id = uuid();
    db.prepare(`INSERT INTO layout_variance_evidence (id, organization_id, event_id, layout_id, note, photo_url, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      id, input.orgId, input.eventId ?? null, input.layoutId, input.note, input.photoUrl ?? null, input.actorId ?? null,
    );
    return db.prepare(`SELECT * FROM layout_variance_evidence WHERE id = ?`).get(id) as LayoutVarianceEvidenceRow;
  },

  activateRainPlan(input: { orgId: string; eventId?: string | null; layoutId: string; active: boolean; note?: string; actorId?: string | null }): LayoutRainPlanActivationRow {
    const id = uuid();
    db.prepare(`INSERT INTO layout_rain_plan_activations (id, organization_id, event_id, layout_id, active, note, activated_by) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      id, input.orgId, input.eventId ?? null, input.layoutId, input.active ? 1 : 0, input.note ?? null, input.actorId ?? null,
    );
    return db.prepare(`SELECT * FROM layout_rain_plan_activations WHERE id = ?`).get(id) as LayoutRainPlanActivationRow;
  },

  setVendorZoneInspection(input: { orgId: string; eventId?: string | null; layoutId: string; vendorId?: string | null; status: LayoutFloorWalkStatus; zoneLabel?: string; note?: string; actorId?: string | null }): LayoutVendorZoneInspectionRow {
    const existing = input.vendorId ? db.prepare(`SELECT * FROM layout_vendor_zone_inspections WHERE layout_id = ? AND vendor_id = ?`).get(input.layoutId, input.vendorId) as LayoutVendorZoneInspectionRow | undefined : undefined;
    const inspectedAt = input.status === 'verified' ? new Date().toISOString() : null;
    if (existing) {
      db.prepare(`UPDATE layout_vendor_zone_inspections SET status = ?, zone_label = ?, note = ?, inspected_by = ?, inspected_at = ?, updated_at = datetime('now') WHERE id = ?`).run(
        input.status, input.zoneLabel ?? existing.zone_label, input.note ?? existing.note, input.actorId ?? existing.inspected_by, inspectedAt, existing.id,
      );
      return db.prepare(`SELECT * FROM layout_vendor_zone_inspections WHERE id = ?`).get(existing.id) as LayoutVendorZoneInspectionRow;
    }
    const id = uuid();
    db.prepare(`INSERT INTO layout_vendor_zone_inspections (id, organization_id, event_id, layout_id, vendor_id, status, zone_label, note, inspected_by, inspected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, input.orgId, input.eventId ?? null, input.layoutId, input.vendorId ?? null, input.status, input.zoneLabel ?? null, input.note ?? null, input.actorId ?? null, inspectedAt,
    );
    return db.prepare(`SELECT * FROM layout_vendor_zone_inspections WHERE id = ?`).get(id) as LayoutVendorZoneInspectionRow;
  },

  upsertSetupPacket(input: { orgId: string; eventId?: string | null; layoutId: string; audience: LayoutPacketAudience; payload?: Record<string, unknown>; expiresAt?: string | null; actorId?: string | null }): LayoutSetupPacketRow {
    const existing = db.prepare(`SELECT * FROM layout_setup_packets WHERE layout_id = ? AND audience = ?`).get(input.layoutId, input.audience) as LayoutSetupPacketRow | undefined;
    if (existing) {
      db.prepare(`UPDATE layout_setup_packets SET payload = ?, expires_at = ?, revoked_at = NULL, created_by = ?, updated_at = datetime('now') WHERE id = ?`).run(
        stringifyJson(input.payload ?? {}), input.expiresAt ?? existing.expires_at, input.actorId ?? existing.created_by, existing.id,
      );
      return db.prepare(`SELECT * FROM layout_setup_packets WHERE id = ?`).get(existing.id) as LayoutSetupPacketRow;
    }
    const id = uuid();
    db.prepare(`INSERT INTO layout_setup_packets (id, organization_id, event_id, layout_id, token, audience, payload, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      id, input.orgId, input.eventId ?? null, input.layoutId, packetToken(), input.audience, stringifyJson(input.payload ?? {}), input.expiresAt ?? null, input.actorId ?? null,
    );
    return db.prepare(`SELECT * FROM layout_setup_packets WHERE id = ?`).get(id) as LayoutSetupPacketRow;
  },

  findPacketByToken(token: string): LayoutSetupPacketRow | undefined {
    return db.prepare(`SELECT * FROM layout_setup_packets WHERE token = ? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > datetime('now'))`).get(token) as LayoutSetupPacketRow | undefined;
  },
};
