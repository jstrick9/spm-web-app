import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { eventQuestionsRepo, eventAnswersRepo, eventsRepo } from '../db/repos/index.js';
import { db } from '../db/database.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';

const questionSchema = z.object({
  question:    z.string().min(1).max(500),
  groupName:   z.string().max(120).optional(),
  answerType:  z.enum(['dropdown','integer','text','date','boolean','multiselect']).optional(),
  options:     z.array(z.unknown()).optional(),
  workflow:    z.record(z.unknown()).optional(),
  required:    z.boolean().optional(),
  sortOrder:   z.number().int().optional(),
});

export async function questionRoutes(app: FastifyInstance) {
  app.get('/api/orgs/:orgId/questions', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'questions.view')) throw Forbidden();
    return { questions: eventQuestionsRepo.listForOrg(orgId) };
  });

  app.post('/api/orgs/:orgId/questions', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'questions.manage')) throw Forbidden();
    const parsed = questionSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return reply.code(201).send({ question: eventQuestionsRepo.create(orgId, parsed.data) });
  });

  app.patch('/api/questions/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const q = eventQuestionsRepo.findById(id);
    if (!q) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: q.organization_id }, "questions.manage")) throw Forbidden();
    const parsed = questionSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = eventQuestionsRepo.update(id, parsed.data);
    if (!updated) throw NotFound();
    return { question: updated };
  });

  app.delete('/api/questions/:id', { preHandler: requireAuth }, async (req, reply) => {
    const qd = eventQuestionsRepo.findById((req.params as { id: string }).id);
    if (qd && !can(req.auth!.memberships, { organizationId: qd.organization_id }, "questions.manage")) throw Forbidden();
    eventQuestionsRepo.delete((req.params as { id: string }).id);
    return reply.code(204).send();
  });

  // ─── Answers ───────────────────────────────────────────
  // Couples answer the venue's intake questions for THEIR event (the
  // feature was dead-ended: the studio created questions and the answers
  // API existed, but no UI let couples fill them and the SDK had zero
  // callers). Questions are org-level; answers are per-event.
  app.get('/api/events/:eventId/questions', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    return { questions: eventQuestionsRepo.listForOrg(event.organization_id) };
  });

  // Org-wide answers for one question (venue Questions Studio viewer) —
  // avoids the client scanning every event one-by-one.
  app.get('/api/orgs/:orgId/questions/:questionId/answers', { preHandler: requireAuth }, async (req) => {
    const { orgId, questionId } = req.params as { orgId: string; questionId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'questions.view')) throw Forbidden();
    const rows = db.prepare(`
      SELECT a.event_id, e.title AS event_title, a.answer, a.answered_at
      FROM event_answers a
      JOIN events e ON e.id = a.event_id AND e.organization_id = ?
      WHERE a.question_id = ?
      ORDER BY a.answered_at DESC
      LIMIT 50
    `).all(orgId, questionId) as Array<{ event_id: string; event_title: string; answer: string; answered_at: string }>;
    return { answers: rows };
  });

  app.get('/api/events/:eventId/answers', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    return { answers: eventAnswersRepo.listForEvent(eventId) };
  });

  app.put('/api/events/:eventId/answers/:questionId', { preHandler: requireAuth }, async (req) => {
    const { eventId, questionId } = req.params as { eventId: string; questionId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    // The event's COUPLE members answer their own intake forms (same rule
    // as canWriteCoupleData); venue roles with events.edit may also record
    // answers in a support capacity.
    const isCoupleMember = req.auth!.memberships.some(
      (m) => m.eventId === eventId && String((m as any).roleKey ?? '').toLowerCase() === 'couple',
    );
    if (!isCoupleMember && !can(req.auth!.memberships, { eventId }, 'events.edit', orgMap)) throw Forbidden();
    // The question must exist AND belong to the event's org — otherwise a
    // couple could attach answers to a question from a foreign org, and that
    // org's "View answers" would show a contaminated answer row for an event
    // it does not own.
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const question = eventQuestionsRepo.findById(questionId);
    if (!question) throw NotFound('question-not-found');
    if (question.organization_id !== event.organization_id) throw BadRequest('question-org-mismatch');
    const parsed = z.object({ answer: z.string() }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return {
      answer: eventAnswersRepo.upsert({
        eventId, questionId, answer: parsed.data.answer, answeredBy: req.auth!.userId,
      }),
    };
  });
}
