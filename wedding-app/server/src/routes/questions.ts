import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { eventQuestionsRepo, eventAnswersRepo, eventsRepo } from '../db/repos/index.js';
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
  app.get('/api/events/:eventId/answers', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    return { answers: eventAnswersRepo.listForEvent(eventId) };
  });

  app.put('/api/events/:eventId/answers/:questionId', { preHandler: requireAuth }, async (req) => {
    const { eventId, questionId } = req.params as { eventId: string; questionId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.edit', orgMap)) throw Forbidden();
    const parsed = z.object({ answer: z.string() }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return {
      answer: eventAnswersRepo.upsert({
        eventId, questionId, answer: parsed.data.answer, answeredBy: req.auth!.userId,
      }),
    };
  });
}
