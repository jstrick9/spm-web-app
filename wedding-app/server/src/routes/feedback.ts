import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { eventsRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import { assertNoPublicHoneypot, auditPublicSubmission, publicRequestFingerprint } from '../lib/publicAbuse.js';
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

  // ─── Polls ──────────────────────────────────────────────
  // GET is PUBLIC on purpose: the guest portal renders polls for guests
  // (the vote endpoint below is public + rate-limited too), so requiring
  // auth here made the portal's poll section permanently empty — every
  // guest load fired a 403 that the client swallowed. Poll content lives in
  // event metadata and is guest-visible by design; the response returns
  // ONLY the polls (no other metadata).
  app.get('/api/events/:eventId/polls', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const { meta } = getEventMeta(eventId);
    return reply.send({ polls: meta.polls || [] });
  });

  app.post('/api/events/:eventId/polls', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'feedback.manage', orgMap)) throw Forbidden();
    const { ev, meta } = getEventMeta(eventId);
    
    const parsed = pollSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input');

    const newPoll = { id: uuid(), ...parsed.data };
    meta.polls = [...(meta.polls || []), newPoll];
    saveEventMeta(eventId, meta);
    
    return { poll: newPoll };
  });

  // Voting is intentionally public (guests vote from the portal without auth)
  app.post('/api/events/:eventId/polls/:pollId/vote', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (req) => {
    const { eventId, pollId } = req.params as { eventId: string; pollId: string };
    const { ev, meta } = getEventMeta(eventId);
    assertNoPublicHoneypot(req, { organizationId: ev.organization_id, action: 'poll.vote.blocked', targetType: 'poll', targetId: pollId });
    const { optionId } = req.body as { optionId: string };
    
    const polls = meta.polls || [];
    const poll = polls.find((p: any) => p.id === pollId);
    if (!poll || poll.status !== 'active') throw BadRequest('poll-inactive');

    const option = poll.options.find((o: any) => o.id === optionId);
    if (option) {
      // Dedup by device session so a single guest can't inflate results
      // by re-voting (the public endpoint is anonymous; rate limiting
      // alone only caps abuse to 30/min).
      const session = publicRequestFingerprint(req);
      const votedSessions: string[] = Array.isArray(poll.votedSessions) ? poll.votedSessions : [];
      // One vote per device session per poll (switching options doesn't
      // grant extra votes).
      if (votedSessions.includes(session)) throw BadRequest('already-voted');
      votedSessions.push(session);
      if (votedSessions.length > 500) votedSessions.splice(0, votedSessions.length - 500);
      poll.votedSessions = votedSessions;
      option.votes = (option.votes || 0) + 1;
      saveEventMeta(eventId, meta);
      auditPublicSubmission(req, {
        organizationId: ev.organization_id,
        action: 'poll.vote',
        targetType: 'poll',
        targetId: pollId,
        details: { eventId, optionId },
      });
    }
    
    return { poll };
  });

  // ─── Feedback ───────────────────────────────────────────
  app.get('/api/events/:eventId/feedback', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'feedback.view', orgMap)) throw Forbidden();
    const { meta } = getEventMeta(eventId);
    return { feedback: meta.feedback || [] };
  });

  app.post('/api/events/:eventId/feedback', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'feedback.manage', orgMap)) throw Forbidden();
    const { ev, meta } = getEventMeta(eventId);
    
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input');

    const newFeedback = { id: uuid(), ...parsed.data };
    meta.feedback = [...(meta.feedback || []), newFeedback];
    saveEventMeta(eventId, meta);
    
    return { feedback: newFeedback };
  });

  // ─── Public NPS / Feedback submission (no auth needed) ───
  app.post('/api/public/events/:eventId/nps', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const { ev, meta } = getEventMeta(eventId);
    assertNoPublicHoneypot(req, { organizationId: ev.organization_id, action: 'nps.blocked', targetType: 'event', targetId: eventId });
    const { score, comment, submittedBy } = req.body as { score: number; comment?: string; submittedBy?: string };

    if (typeof score !== 'number' || score < 0 || score > 10) {
      throw BadRequest('score-range-0-10');
    }
    // One NPS response per device session per event — otherwise a single
    // actor can skew the venue's scorecard by re-submitting (rate limiting
    // alone caps abuse at 10/min).
    const session = publicRequestFingerprint(req);
    const npsSessions: string[] = Array.isArray(meta.npsSessions) ? meta.npsSessions : [];
    if (npsSessions.includes(session)) throw BadRequest('already-submitted');
    npsSessions.push(session);
    if (npsSessions.length > 500) npsSessions.splice(0, npsSessions.length - 500);
    meta.npsSessions = npsSessions;

    const npsResponse = {
      id: uuid(),
      score,
      comment: comment || '',
      submittedBy: submittedBy || 'Anonymous Couple',
      submittedAt: new Date().toISOString()
    };

    meta.nps = [...(meta.nps || []), npsResponse];
    saveEventMeta(eventId, meta);
    auditPublicSubmission(req, {
      organizationId: ev.organization_id,
      action: 'nps.submit',
      targetType: 'event',
      targetId: eventId,
      details: { score },
    });

    return { nps: npsResponse };
  });

  // ─── Org-wide NPS stats (requires auth, reports.view) ───
  app.get('/api/orgs/:orgId/nps-stats', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'reports.view')) throw Forbidden();

    // Find all completed events in this org
    const events = eventsRepo.listForOrg(orgId, { status: 'completed' });

    let total = 0;
    let promoters = 0;
    let detractors = 0;
    const responses: Array<{ eventId: string; eventTitle: string; score: number; comment: string; submittedBy: string; submittedAt: string }> = [];

    for (const ev of events) {
      let meta: any = {};
      try { meta = typeof ev.metadata === 'string' ? JSON.parse(ev.metadata) : ev.metadata; } catch {}
      const npsList = meta?.nps || [];
      for (const res of npsList) {
        total++;
        if (res.score >= 9) promoters++;
        else if (res.score <= 6) detractors++;
        responses.push({
          eventId: ev.id,
          eventTitle: ev.title,
          ...res
        });
      }
    }

    const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : null;

    return {
      npsScore,
      totalResponses: total,
      promoters,
      detractors,
      responses: responses.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    };
  });
}
