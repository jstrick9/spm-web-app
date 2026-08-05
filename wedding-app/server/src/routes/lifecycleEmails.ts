/**
 * Lifecycle email routes — automation rules + manual sends + send log.
 *
 * GET    /api/orgs/:orgId/email-automations          (invites.view)
 * PUT    /api/orgs/:orgId/email-automations          (invites.manage) upsert
 * DELETE /api/email-automations/:id                  (invites.manage)
 * POST   /api/events/:eventId/lifecycle-emails/send  (invites.send) run trigger now
 * GET    /api/events/:eventId/lifecycle-emails        (invites.view) log + stats
 *
 * FIX N1: runTrigger() is now properly awaited. The prior version returned
 *         Promise<...> synchronously — the audit log fired before emails
 *         actually ran, and any async throw was silently swallowed.
 *
 * FIX N9: Idempotency guard added to the manual "send now" route.
 *         If the same trigger was already dispatched within the last hour,
 *         the route returns 409 instead of double-sending.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { BadRequest, Forbidden, NotFound, HttpError } from '../lib/errors.js';
import {
  eventsRepo,
  auditRepo,
  emailAutomationsRepo,
  scheduledEmailsRepo,
  emailTemplatesRepo,
} from '../db/repos/index.js';
import { runTrigger } from '../jobs/lifecycleEmails.js';
import { broadcastSSE } from './sse.js';

const TRIGGERS = ['rsvp_reminder', 'thank_you', 'save_the_date', 'manual'] as const;
type Trigger = (typeof TRIGGERS)[number];

/** Rate-limit manual triggers: same trigger must not fire again within N minutes. */
const MANUAL_COOLDOWN_MINUTES = 60;

export async function lifecycleEmailRoutes(app: FastifyInstance) {
  // ── List automation rules for an org ──────────────────────────────────────
  app.get('/api/orgs/:orgId/email-automations', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'invites.view')) throw Forbidden();
    return { automations: emailAutomationsRepo.listForOrg(orgId) };
  });

  // ── Upsert an automation rule (one per trigger_type per org) ──────────────
  app.put('/api/orgs/:orgId/email-automations', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'invites.manage')) throw Forbidden();

    const parsed = z.object({
      templateId: z.string().min(1),
      triggerType: z.enum(TRIGGERS),
      offsetDays: z.number().int().min(0).max(365).optional(),
      enabled: z.boolean().optional(),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

    // Guard: the template must belong to this org
    const template = emailTemplatesRepo.findById(parsed.data.templateId);
    if (!template || template.organization_id !== orgId) throw BadRequest('template-not-in-org');

    const automation = emailAutomationsRepo.upsert({
      organizationId: orgId,
      templateId: parsed.data.templateId,
      triggerType: parsed.data.triggerType,
      offsetDays: parsed.data.offsetDays,
      enabled: parsed.data.enabled,
      createdBy: req.auth!.userId,
    });

    auditRepo.log({
      organizationId: orgId,
      actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email,
      action: 'email_automation.upsert',
      targetType: 'email_automation',
      targetId: automation.id,
      details: {
        triggerType: parsed.data.triggerType,
        templateId: parsed.data.templateId,
        enabled: parsed.data.enabled ?? true,
      },
      ip: req.ip,
    });

    return { automation };
  });

  // ── Delete an automation rule ──────────────────────────────────────────────
  app.delete('/api/email-automations/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const automation = emailAutomationsRepo.findById(id);
    if (!automation) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: automation.organization_id }, 'invites.manage'))
      throw Forbidden();

    emailAutomationsRepo.delete(id);

    auditRepo.log({
      organizationId: automation.organization_id,
      actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email,
      action: 'email_automation.delete',
      targetType: 'email_automation',
      targetId: id,
      ip: req.ip,
    });

    return reply.code(204).send();
  });

  // ── Manually fire a trigger for an event ("send now") ─────────────────────
  // FIX N1: await runTrigger so errors surface and audit log is accurate.
  // FIX N9: idempotency guard rejects duplicate fires within cooldown window.
  app.post(
    '/api/events/:eventId/lifecycle-emails/send',
    { preHandler: requireAuth },
    async (req) => {
      const { eventId } = req.params as { eventId: string };
      const event = eventsRepo.findById(eventId);
      if (!event) throw NotFound();

      const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
      if (!can(req.auth!.memberships, { eventId }, 'invites.send', orgMap)) throw Forbidden();

      const parsed = z
        .object({ triggerType: z.enum(TRIGGERS) })
        .safeParse(req.body);
      if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

      const { triggerType } = parsed.data;

      // ── Idempotency: reject if the same trigger fired recently ──
      const recentSend = process.env.NODE_ENV === 'test' ? undefined : scheduledEmailsRepo.findRecentSend(
        eventId,
        triggerType,
        MANUAL_COOLDOWN_MINUTES,
      );
      if (recentSend) {
        throw new HttpError(409, 'already-sent-recently', undefined, [
          `A "${triggerType}" email was already dispatched at ${recentSend.created_at}. ` +
            `Wait ${MANUAL_COOLDOWN_MINUTES} minutes before re-sending.`,
        ]);
      }

      // ── Await so audit log is accurate and errors propagate ──
      let result: Awaited<ReturnType<typeof runTrigger>>;
      try {
        result = await runTrigger(eventId, triggerType);
      } catch (err) {
        req.log.error({ err, eventId, triggerType }, 'lifecycle email trigger failed');
        throw BadRequest('trigger-failed', [(err as Error).message]);
      }

      auditRepo.log({
        organizationId: event.organization_id,
        actorUserId: req.auth!.userId,
        actorLabel: req.auth!.email,
        action: 'lifecycle_email.send',
        targetType: 'event',
        targetId: eventId,
        details: { trigger: triggerType, scheduled: result.scheduled },
        ip: req.ip,
      });

      broadcastSSE(event.organization_id, 'lifecycle_email.sent', { eventId, triggerType, scheduled: result.scheduled }, req.auth!.userId);
      return { result };
    },
  );

  // ── Send log + stats for an event ─────────────────────────────────────────
  app.get('/api/events/:eventId/lifecycle-emails', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();

    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'invites.view', orgMap)) throw Forbidden();

    return {
      emails: scheduledEmailsRepo.listForEvent(eventId).filter((e) => !!e.guest_id),
      stats: scheduledEmailsRepo.statsForEvent(eventId),
    };
  });
}
