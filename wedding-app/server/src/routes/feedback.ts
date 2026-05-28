import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { eventsRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import { uuid } from '../lib/crypto.js';

const pollSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.object({ id: z.string(), text: z.string(), votes: z.number().default(0) })),
  status: z.enum(['active', 'closed']).default('active')
});

const feedbackSchema = z.object({
  target: z.string().min(1),
  rating: z.number().min(1).max(5),
  comments: z.string().optional().default(''),
  submittedBy: z.string()
});

export async function feedbackRoutes(app: FastifyInstance) {
  // Helpers to get/set metadata
  const getEventMeta = (eventId: string) => {
    const ev = eventsRepo.findById(eventId);
    if (!ev) throw NotFound('Event not found');
    let meta: any = {};
    try { meta = typeof ev.metadata === 'string' ? JSON.parse(ev.metadata) : ev.metadata; } catch {}
    return { ev, meta: meta || {} };
  };

  const saveEventMeta = (id: string, meta: any) => {
    eventsRepo.update(id, { metadata: meta });
  };

  // Polls
  app.get('/api/events/:eventId/polls', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const { meta } = getEventMeta(eventId);
    return { polls: meta.polls || [] };
  });

  app.post('/api/events/:eventId/polls', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const { ev, meta } = getEventMeta(eventId);
    if (!can(req.auth!.memberships, { eventId }, 'events.edit', eventsRepo.orgMapForUser(req.auth!.userId))) throw Forbidden();
    
    const parsed = pollSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input');

    const newPoll = { id: uuid(), ...parsed.data };
    meta.polls = [...(meta.polls || []), newPoll];
    saveEventMeta(eventId, meta);
    
    return { poll: newPoll };
  });

  app.post('/api/events/:eventId/polls/:pollId/vote', async (req) => {
    // Voting can be done by public guests, so no auth required here
    const { eventId, pollId } = req.params as { eventId: string; pollId: string };
    const { optionId } = req.body as { optionId: string };
    
    const { meta } = getEventMeta(eventId);
    const polls = meta.polls || [];
    const poll = polls.find((p: any) => p.id === pollId);
    if (!poll || poll.status !== 'active') throw BadRequest('poll-inactive');

    const option = poll.options.find((o: any) => o.id === optionId);
    if (option) {
      option.votes = (option.votes || 0) + 1;
      saveEventMeta(eventId, meta);
    }
    
    return { poll };
  });

  // Feedback
  app.get('/api/events/:eventId/feedback', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const { meta } = getEventMeta(eventId);
    return { feedback: meta.feedback || [] };
  });

  app.post('/api/events/:eventId/feedback', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const { ev, meta } = getEventMeta(eventId);
    
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input');

    const newFeedback = { id: uuid(), ...parsed.data };
    meta.feedback = [...(meta.feedback || []), newFeedback];
    saveEventMeta(eventId, meta);
    
    return { feedback: newFeedback };
  });
}
