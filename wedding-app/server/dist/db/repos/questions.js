import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';
export const eventQuestionsRepo = {
    listForOrg(orgId) {
        return db.prepare(`SELECT * FROM event_questions WHERE organization_id = ? ORDER BY group_name, sort_order, question`).all(orgId);
    },
    create(orgId, input) {
        const id = uuid();
        db.prepare(`INSERT INTO event_questions
         (id, organization_id, question, group_name, answer_type, options, workflow, required, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, orgId, input.question, input.groupName ?? 'Other', input.answerType ?? 'text', stringifyJson(input.options ?? []), stringifyJson(input.workflow ?? {}), input.required ? 1 : 0, input.sortOrder ?? 0);
        return db.prepare(`SELECT * FROM event_questions WHERE id = ?`).get(id);
    },
    update(id, patch) {
        const fields = [];
        const values = [];
        if (patch.question !== undefined) {
            fields.push('question = ?');
            values.push(patch.question);
        }
        if (patch.groupName !== undefined) {
            fields.push('group_name = ?');
            values.push(patch.groupName);
        }
        if (patch.answerType !== undefined) {
            fields.push('answer_type = ?');
            values.push(patch.answerType);
        }
        if (patch.options !== undefined) {
            fields.push('options = ?');
            values.push(stringifyJson(patch.options));
        }
        if (patch.workflow !== undefined) {
            fields.push('workflow = ?');
            values.push(stringifyJson(patch.workflow));
        }
        if (patch.required !== undefined) {
            fields.push('required = ?');
            values.push(patch.required ? 1 : 0);
        }
        if (patch.sortOrder !== undefined) {
            fields.push('sort_order = ?');
            values.push(patch.sortOrder);
        }
        if (fields.length === 0)
            return db.prepare(`SELECT * FROM event_questions WHERE id = ?`).get(id);
        values.push(id);
        db.prepare(`UPDATE event_questions SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
        return db.prepare(`SELECT * FROM event_questions WHERE id = ?`).get(id);
    },
    delete(id) {
        return db.prepare(`DELETE FROM event_questions WHERE id = ?`).run(id).changes > 0;
    },
};
export const eventAnswersRepo = {
    listForEvent(eventId) {
        return db.prepare(`SELECT * FROM event_answers WHERE event_id = ?`).all(eventId);
    },
    upsert(input) {
        const existing = db.prepare(`SELECT id FROM event_answers WHERE event_id = ? AND question_id = ?`).get(input.eventId, input.questionId);
        if (existing) {
            db.prepare(`UPDATE event_answers SET answer = ?, answered_by = ?, answered_at = datetime('now') WHERE id = ?`).run(input.answer, input.answeredBy ?? null, existing.id);
            return db.prepare(`SELECT * FROM event_answers WHERE id = ?`).get(existing.id);
        }
        const id = uuid();
        db.prepare(`INSERT INTO event_answers (id, event_id, question_id, answer, answered_by) VALUES (?, ?, ?, ?, ?)`).run(id, input.eventId, input.questionId, input.answer, input.answeredBy ?? null);
        return db.prepare(`SELECT * FROM event_answers WHERE id = ?`).get(id);
    },
};
//# sourceMappingURL=questions.js.map