import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { parseJson, stringifyJson } from '../../lib/json.js';

export interface EventQuestionRow {
  id: string;
  organization_id: string;
  question: string;
  group_name: string;
  answer_type: 'dropdown' | 'integer' | 'text' | 'date' | 'boolean' | 'multiselect';
  options: string;   // JSON array
  workflow: string;  // JSON object
  required: number;
  sort_order: number;
}

export const eventQuestionsRepo = {
  listForOrg(orgId: string): EventQuestionRow[] {
    return db.prepare(
      `SELECT * FROM event_questions WHERE organization_id = ? ORDER BY group_name, sort_order, question`
    ).all(orgId) as EventQuestionRow[];
  },

  create(orgId: string, input: {
    question: string; groupName?: string;
    answerType?: EventQuestionRow['answer_type'];
    options?: unknown[]; workflow?: Record<string, unknown>;
    required?: boolean; sortOrder?: number;
  }): EventQuestionRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO event_questions
         (id, organization_id, question, group_name, answer_type, options, workflow, required, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, orgId, input.question,
      input.groupName ?? 'Other',
      input.answerType ?? 'text',
      stringifyJson(input.options ?? []),
      stringifyJson(input.workflow ?? {}),
      input.required ? 1 : 0,
      input.sortOrder ?? 0,
    );
    return db.prepare(`SELECT * FROM event_questions WHERE id = ?`).get(id) as EventQuestionRow;
  },

  update(id: string, patch: Partial<{
    question: string; groupName: string;
    answerType: EventQuestionRow['answer_type'];
    options: unknown[]; workflow: Record<string, unknown>;
    required: boolean; sortOrder: number;
  }>): EventQuestionRow | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.question  !== undefined) { fields.push('question = ?');    values.push(patch.question); }
    if (patch.groupName !== undefined) { fields.push('group_name = ?');  values.push(patch.groupName); }
    if (patch.answerType!== undefined) { fields.push('answer_type = ?'); values.push(patch.answerType); }
    if (patch.options   !== undefined) { fields.push('options = ?');     values.push(stringifyJson(patch.options)); }
    if (patch.workflow  !== undefined) { fields.push('workflow = ?');    values.push(stringifyJson(patch.workflow)); }
    if (patch.required  !== undefined) { fields.push('required = ?');    values.push(patch.required ? 1 : 0); }
    if (patch.sortOrder !== undefined) { fields.push('sort_order = ?');  values.push(patch.sortOrder); }
    if (fields.length === 0) return db.prepare(`SELECT * FROM event_questions WHERE id = ?`).get(id) as EventQuestionRow | undefined;
    values.push(id);
    db.prepare(`UPDATE event_questions SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    return db.prepare(`SELECT * FROM event_questions WHERE id = ?`).get(id) as EventQuestionRow | undefined;
  },

  delete(id: string): boolean {
    return db.prepare(`DELETE FROM event_questions WHERE id = ?`).run(id).changes > 0;
  },
};

export const eventAnswersRepo = {
  listForEvent(eventId: string) {
    return db.prepare(
      `SELECT * FROM event_answers WHERE event_id = ?`
    ).all(eventId);
  },

  upsert(input: { eventId: string; questionId: string; answer: string; answeredBy?: string }) {
    const existing = db.prepare(
      `SELECT id FROM event_answers WHERE event_id = ? AND question_id = ?`
    ).get(input.eventId, input.questionId) as { id: string } | undefined;
    if (existing) {
      db.prepare(
        `UPDATE event_answers SET answer = ?, answered_by = ?, answered_at = datetime('now') WHERE id = ?`
      ).run(input.answer, input.answeredBy ?? null, existing.id);
      return db.prepare(`SELECT * FROM event_answers WHERE id = ?`).get(existing.id);
    }
    const id = uuid();
    db.prepare(
      `INSERT INTO event_answers (id, event_id, question_id, answer, answered_by) VALUES (?, ?, ?, ?, ?)`
    ).run(id, input.eventId, input.questionId, input.answer, input.answeredBy ?? null);
    return db.prepare(`SELECT * FROM event_answers WHERE id = ?`).get(id);
  },
};
