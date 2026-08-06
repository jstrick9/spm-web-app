import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';
import { addDaysDateOnly } from '../../lib/time.js';

export type CoupleTaskOwner = 'couple' | 'venue' | 'planner' | 'vendor';
export type CoupleTaskStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';
export type CoupleTaskApprovalStatus = 'not_required' | 'pending' | 'approved' | 'changes_requested';
export type CoupleDecisionCategory = 'ceremony' | 'reception' | 'menu' | 'music' | 'floor_plan' | 'decor' | 'signage' | 'transportation' | 'lodging' | 'documents' | 'guest_list' | 'timeline' | 'other';

export interface CouplePlanningTaskRow {
  id: string;
  organization_id: string;
  event_id: string;
  template_key: string;
  title: string;
  description: string | null;
  owner: CoupleTaskOwner;
  due_date: string | null;
  status: CoupleTaskStatus;
  approval_status: CoupleTaskApprovalStatus;
  decision_category: CoupleDecisionCategory | null;
  attachments: string;
  history: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface TemplateTask {
  key: string;
  title: string;
  description: string;
  owner: CoupleTaskOwner;
  offsetDays: number;
  approval: CoupleTaskApprovalStatus;
  decisionCategory: CoupleDecisionCategory;
}

const BASE_TEMPLATES: TemplateTask[] = [
  { key: 'contract-signed', title: 'Sign venue agreement', description: 'Review and sign the venue agreement or confirm the signed copy is uploaded.', owner: 'couple', offsetDays: -180, approval: 'approved', decisionCategory: 'documents' },
  { key: 'deposit-payment', title: 'Review deposit and payment schedule', description: 'Confirm deposit/payment milestones and ask the venue about any invoice questions.', owner: 'couple', offsetDays: -150, approval: 'not_required', decisionCategory: 'documents' },
  { key: 'guest-list-started', title: 'Start guest list', description: 'Add guests, households, emails/phones, mailing addresses, meal notes, and accessibility needs.', owner: 'couple', offsetDays: -120, approval: 'not_required', decisionCategory: 'guest_list' },
  { key: 'room-block', title: 'Confirm lodging / room block details', description: 'Confirm hotel/lodging links, booking deadline, shuttle notes, and guest-facing instructions.', owner: 'couple', offsetDays: -100, approval: 'pending', decisionCategory: 'lodging' },
  { key: 'menu-tasting', title: 'Complete menu / tasting decisions', description: 'Submit menu choices, allergy notes, bar preferences, and vendor/venue approvals.', owner: 'couple', offsetDays: -75, approval: 'pending', decisionCategory: 'menu' },
  { key: 'music-notes', title: 'Submit music notes', description: 'Share must-play/do-not-play songs, ceremony music, and special dance notes.', owner: 'couple', offsetDays: -60, approval: 'not_required', decisionCategory: 'music' },
  { key: 'decor-signage', title: 'Confirm decor and signage', description: 'Confirm signage, table numbers, escort cards, decor plan, personal items, and delivery timing.', owner: 'couple', offsetDays: -50, approval: 'pending', decisionCategory: 'decor' },
  { key: 'floor-plan-review', title: 'Review floor plan and seating', description: 'Review floor plan, table assignments, guest flow, ADA needs, and requested changes.', owner: 'couple', offsetDays: -45, approval: 'pending', decisionCategory: 'floor_plan' },
  { key: 'timeline-review', title: 'Review wedding timeline', description: 'Review ceremony, cocktail hour, reception, speeches, dances, last call, send-off, and after-party timing.', owner: 'planner', offsetDays: -30, approval: 'pending', decisionCategory: 'timeline' },
  { key: 'transportation', title: 'Confirm transportation / shuttle plan', description: 'Confirm shuttle schedule, parking details, rideshare instructions, and guest communication.', owner: 'couple', offsetDays: -25, approval: 'pending', decisionCategory: 'transportation' },
  { key: 'final-count', title: 'Submit final guest count', description: 'Confirm final attending count, meals, vendor meals, children, and accessibility notes.', owner: 'couple', offsetDays: -21, approval: 'pending', decisionCategory: 'guest_list' },
  { key: 'final-payment', title: 'Final payment confirmation', description: 'Confirm final balance, receipts, and any approved change orders.', owner: 'couple', offsetDays: -21, approval: 'pending', decisionCategory: 'documents' },
  { key: 'final-walkthrough', title: 'Complete final walkthrough', description: 'Walk spaces with venue/planner, confirm rain plan, floor plan, vendor load-in, and open questions.', owner: 'venue', offsetDays: -14, approval: 'pending', decisionCategory: 'ceremony' },
  { key: 'ceremony-rehearsal', title: 'Confirm ceremony rehearsal', description: 'Confirm rehearsal time, wedding party participants, processional order, and family cues.', owner: 'couple', offsetDays: -1, approval: 'not_required', decisionCategory: 'ceremony' },
];

function dueDate(weddingDate: string | null | undefined, offset: number): string | null {
  // Local calendar arithmetic: the old UTC-slice output shifted a day for
  // UTC-positive timezones (local noon → next-day UTC) and confused
  // "due" day comparisons.
  return addDaysDateOnly(weddingDate, offset);
}

function appendHistory(row: CouplePlanningTaskRow, actor: string, action: string, note?: string) {
  let history: unknown[] = [];
  try { history = JSON.parse(row.history || '[]'); } catch { history = []; }
  return [...history, { at: new Date().toISOString(), actor, action, note }];
}

export const couplePlanningRepo = {
  ensureDefaults(input: { organizationId: string; eventId: string; weddingDate?: string | null; packageKey?: string | null; cultureKey?: string | null }): CouplePlanningTaskRow[] {
    const existing = this.listForEvent(input.eventId);
    if (existing.length > 0) return existing;
    const tx = db.transaction(() => {
      BASE_TEMPLATES.forEach((template, index) => {
        const id = uuid();
        db.prepare(
          `INSERT OR IGNORE INTO couple_planning_tasks
           (id, organization_id, event_id, template_key, title, description, owner, due_date, approval_status, decision_category, sort_order, history)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          input.organizationId,
          input.eventId,
          template.key,
          template.title,
          template.description,
          template.owner,
          dueDate(input.weddingDate, template.offsetDays),
          template.approval,
          template.decisionCategory,
          index + 1,
          stringifyJson([{ at: new Date().toISOString(), actor: 'template', action: `created from ${input.packageKey || 'standard'} ${input.cultureKey || 'wedding'} template` }]),
        );
      });
    });
    tx();
    return this.listForEvent(input.eventId);
  },

  listForEvent(eventId: string): CouplePlanningTaskRow[] {
    return db.prepare(`SELECT * FROM couple_planning_tasks WHERE event_id = ? ORDER BY sort_order, due_date IS NULL, due_date`).all(eventId) as CouplePlanningTaskRow[];
  },

  findById(id: string): CouplePlanningTaskRow | undefined {
    return db.prepare(`SELECT * FROM couple_planning_tasks WHERE id = ?`).get(id) as CouplePlanningTaskRow | undefined;
  },

  update(id: string, patch: Partial<{ status: CoupleTaskStatus; approvalStatus: CoupleTaskApprovalStatus; dueDate: string | null; attachments: unknown[]; note: string }>, actor: string): CouplePlanningTaskRow | undefined {
    const current = this.findById(id);
    if (!current) return undefined;
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.status) { fields.push('status = ?'); values.push(patch.status); }
    if (patch.approvalStatus) { fields.push('approval_status = ?'); values.push(patch.approvalStatus); }
    if ('dueDate' in patch) { fields.push('due_date = ?'); values.push(patch.dueDate ?? null); }
    if (patch.attachments) { fields.push('attachments = ?'); values.push(stringifyJson(patch.attachments)); }
    fields.push('history = ?');
    values.push(stringifyJson(appendHistory(current, actor, 'task.update', patch.note)));
    fields.push(`updated_at = datetime('now')`);
    values.push(id);
    db.prepare(`UPDATE couple_planning_tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.findById(id);
  },
};
