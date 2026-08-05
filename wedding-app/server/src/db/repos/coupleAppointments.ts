import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';

export type CoupleAppointmentType = 'tasting' | 'planning_meeting' | 'final_walkthrough' | 'rehearsal' | 'payment' | 'tour' | 'other';
export type CoupleAppointmentStatus = 'requested' | 'confirmed' | 'reschedule_requested' | 'cancel_requested' | 'completed' | 'cancelled';

export interface CoupleAppointmentRow {
  id: string;
  organization_id: string;
  event_id: string;
  requester_user_id: string | null;
  appointment_type: CoupleAppointmentType;
  title: string;
  status: CoupleAppointmentStatus;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  note: string | null;
  preparation: string;
  reminders: string;
  availability_window: string | null;
  provider_sync: string;
  signoff: string;
  created_at: string;
  updated_at: string;
}

const PREP: Record<CoupleAppointmentType, string[]> = {
  tasting: ['Confirm attendee count', 'Share allergies and dietary restrictions', 'Review menu/bar questions', 'Bring tasting notes'],
  planning_meeting: ['Review guest count', 'Bring open questions', 'Review floor plan/timeline changes', 'Confirm decisions needed'],
  final_walkthrough: ['Walk ceremony and reception spaces', 'Confirm rain plan', 'Review vendor load-in basics', 'Confirm final guest count and accessibility needs'],
  rehearsal: ['Confirm wedding party arrival time', 'Bring processional order', 'Confirm readers/family cues', 'Confirm ceremony music notes'],
  payment: ['Review invoice amount', 'Confirm due date', 'Download receipt after payment'],
  tour: ['Confirm arrival time', 'Bring questions about spaces and guest flow'],
  other: ['Review agenda', 'Bring open questions'],
};

function defaultReminders(startsAt?: string | null) {
  return startsAt ? [
    { offsetHours: 72, channel: 'email', status: 'scheduled' },
    { offsetHours: 24, channel: 'in_app', status: 'scheduled' },
  ] : [];
}

export const coupleAppointmentsRepo = {
  listForEvent(eventId: string): CoupleAppointmentRow[] {
    return db.prepare(`SELECT * FROM couple_appointments WHERE event_id = ? ORDER BY starts_at IS NULL, starts_at, created_at`).all(eventId) as CoupleAppointmentRow[];
  },

  findById(id: string): CoupleAppointmentRow | undefined {
    return db.prepare(`SELECT * FROM couple_appointments WHERE id = ?`).get(id) as CoupleAppointmentRow | undefined;
  },

  /**
   * Find the first non-cancelled appointment for the same event whose
   * [starts_at, ends_at) window overlaps the given window. Cancelled
   * appointments never conflict; back-to-back (end === start) is allowed.
   */
  findConflicting(eventId: string, startsAt: string, endsAt: string, excludeId?: string): CoupleAppointmentRow | undefined {
    const start = Date.parse(startsAt);
    const end = Date.parse(endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return undefined;
    const rows = db.prepare(
      `SELECT * FROM couple_appointments
       WHERE event_id = ? AND status != 'cancelled' AND starts_at IS NOT NULL AND ends_at IS NOT NULL`,
    ).all(eventId) as CoupleAppointmentRow[];
    return rows.find((r) => {
      if (r.id === excludeId) return false;
      const rStart = Date.parse(r.starts_at!);
      const rEnd = Date.parse(r.ends_at!);
      if (!Number.isFinite(rStart) || !Number.isFinite(rEnd) || rEnd <= rStart) return false;
      return start < rEnd && end > rStart;
    });
  },

  create(input: {
    organizationId: string;
    eventId: string;
    requesterUserId?: string | null;
    appointmentType: CoupleAppointmentType;
    title?: string;
    startsAt?: string | null;
    endsAt?: string | null;
    location?: string | null;
    note?: string | null;
    availabilityWindow?: string | null;
  }): CoupleAppointmentRow {
    const id = uuid();
    const title = input.title || input.appointmentType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    db.prepare(
      `INSERT INTO couple_appointments
       (id, organization_id, event_id, requester_user_id, appointment_type, title, starts_at, ends_at, location, note, preparation, reminders, availability_window)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      input.organizationId,
      input.eventId,
      input.requesterUserId ?? null,
      input.appointmentType,
      title,
      input.startsAt ?? null,
      input.endsAt ?? null,
      input.location ?? null,
      input.note ?? null,
      stringifyJson(PREP[input.appointmentType] ?? PREP.other),
      stringifyJson(defaultReminders(input.startsAt)),
      input.availabilityWindow ?? null,
    );
    return this.findById(id)!;
  },

  updateStatus(id: string, status: CoupleAppointmentStatus, note?: string | null): CoupleAppointmentRow | undefined {
    db.prepare(`UPDATE couple_appointments SET status = ?, note = COALESCE(?, note), updated_at = datetime('now') WHERE id = ?`).run(status, note ?? null, id);
    return this.findById(id);
  },

  signoff(id: string, input: { signedBy: string; note?: string | null }): CoupleAppointmentRow | undefined {
    db.prepare(`UPDATE couple_appointments SET status = 'completed', signoff = ?, updated_at = datetime('now') WHERE id = ?`).run(stringifyJson({ signedBy: input.signedBy, note: input.note ?? null, signedAt: new Date().toISOString() }), id);
    return this.findById(id);
  },
};
