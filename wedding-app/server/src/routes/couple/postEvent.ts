import { auditRepo, coupleRequestsRepo, eventsRepo, jobsRepo, usersRepo } from '../../db/repos/index.js';
import { db } from '../../db/database.js';
import { uuid } from '../../lib/crypto.js';
import { formatDateLong } from '../../lib/time.js';
import { requireAuth } from '../../middleware/auth.js';
import { can } from '../../lib/rbac.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import type { FastifyInstance } from 'fastify';
import { addDaysIso, canWriteCoupleData, connectedIntegrationId, couplePostEventSummary, enrichPostEventRequest, htmlEscape, parseEventMetadata, postEventBulkActionSchema, postEventFollowUpSchema, postEventLostItemSchema, postEventReviewLinksSchema, postEventReviewSchema, postEventSurveySchema, safeRequest } from './shared.js';

export async function couplePostEventRoutes(app: FastifyInstance) {
  app.get('/api/events/:eventId/couple-post-event', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    return couplePostEventSummary({ event, userId: req.auth!.userId });
  });

  app.patch('/api/events/:eventId/couple-post-event/survey', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = postEventSurveySchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = parseEventMetadata(event);
    const survey = { ...parsed.data, submittedAt: new Date().toISOString(), submittedBy: req.auth!.email };
    const updatedMetadata = {
      ...metadata,
      couplePostEvent: {
        ...(metadata.couplePostEvent ?? {}),
        survey,
        photoGalleryUrl: parsed.data.photoGalleryUrl || metadata.couplePostEvent?.photoGalleryUrl,
        memoryShareUrl: parsed.data.memoryShareUrl || metadata.couplePostEvent?.memoryShareUrl,
        anniversaryOptIn: parsed.data.anniversaryOptIn ?? metadata.couplePostEvent?.anniversaryOptIn,
      },
    };
    eventsRepo.update(eventId, { metadata: updatedMetadata } as never);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'post_event_feedback', status: 'completed', note: parsed.data.privateFeedback || parsed.data.whatCouldImprove || parsed.data.whatWentWell || 'Post-event survey submitted', metadata: { source: 'couple_post_event_closeout', npsScore: parsed.data.npsScore, overallRating: parsed.data.overallRating, mayUseTestimonial: !!parsed.data.mayUseTestimonial } });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.post_event.survey_submit', targetType: 'couple_portal_request', targetId: request.id, ip: req.ip, details: { eventId, npsScore: parsed.data.npsScore } });
    const refreshed = eventsRepo.findById(eventId)!;
    return { summary: couplePostEventSummary({ event: refreshed, userId: req.auth!.userId }), request: safeRequest(request) };
  });

  app.post('/api/events/:eventId/couple-post-event/lost-item', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = postEventLostItemSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'post_event_lost_item', note: parsed.data.itemDescription, metadata: { source: 'couple_post_event_closeout', lastSeenLocation: parsed.data.lastSeenLocation, contactPreference: parsed.data.contactPreference, contactValue: parsed.data.contactValue } });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.post_event.lost_item', targetType: 'couple_portal_request', targetId: request.id, ip: req.ip, details: { eventId } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.post('/api/events/:eventId/couple-post-event/review', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = postEventReviewSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = parseEventMetadata(event);
    const review = { ...parsed.data, submittedAt: new Date().toISOString(), submittedBy: req.auth!.email };
    eventsRepo.update(eventId, { metadata: { ...metadata, couplePostEvent: { ...(metadata.couplePostEvent ?? {}), review } } } as never);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'review_testimonial_request', status: parsed.data.permissionToPublish ? 'completed' : 'pending', note: parsed.data.testimonial || `Review workflow started for ${parsed.data.platform}`, metadata: { source: 'couple_post_event_closeout', platform: parsed.data.platform, rating: parsed.data.rating, permissionToPublish: !!parsed.data.permissionToPublish, reviewerName: parsed.data.reviewerName } });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.post_event.review_submit', targetType: 'couple_portal_request', targetId: request.id, ip: req.ip, details: { eventId, platform: parsed.data.platform } });
    return reply.code(201).send({ request: safeRequest(request), review });
  });

  app.get('/api/events/:eventId/couple-post-event/review-queue', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    const canReview = can(req.auth!.memberships, { eventId }, 'events.edit', orgMap) || can(req.auth!.memberships, { eventId }, 'feedback.manage', orgMap);
    if (!canReview) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const requests = coupleRequestsRepo.listForEvent(eventId).map(safeRequest).filter((r) => ['post_event_lost_item','post_event_feedback','review_testimonial_request'].includes(r.requestType)).map(enrichPostEventRequest);
    const openRequests = requests.filter((r) => ['pending','approved'].includes(r.status));
    const feedback = requests.filter((r) => r.requestType === 'post_event_feedback');
    const npsScores = feedback.map((r) => Number((r.metadata as any)?.npsScore)).filter((n) => Number.isFinite(n));
    return {
      event: { id: event.id, title: event.title, weddingDate: event.start_date },
      requests,
      openRequests,
      reviewLinks: metadata.couplePostEvent?.reviewLinks || metadata.reviewLinks || { google: '', theKnot: '', weddingwire: '', zola: '', other: '' },
      configuredReviewLinks: Object.values(metadata.couplePostEvent?.reviewLinks || metadata.reviewLinks || {}).filter(Boolean).length,
      nps: {
        totalResponses: npsScores.length,
        averageScore: npsScores.length ? Math.round((npsScores.reduce((a, b) => a + b, 0) / npsScores.length) * 10) / 10 : null,
        promoters: npsScores.filter((score) => score >= 9).length,
        detractors: npsScores.filter((score) => score <= 6).length,
      },
      closeoutApprovals: {
        lostItemsOpen: openRequests.filter((r) => r.requestType === 'post_event_lost_item').length,
        testimonialsAwaitingConsent: requests.filter((r) => r.requestType === 'review_testimonial_request' && !(r.metadata as any)?.permissionToPublish).length,
        feedbackToDebrief: feedback.length,
      },
      privacyBoundaries: ['Do not expose internal incident reports in couple replies.', 'Keep staff performance notes and owner financial/margin notes out of couple-facing packets.', 'Use testimonial text only when permissionToPublish/mayUseTestimonial is true.'],
    };
  });

  app.patch('/api/events/:eventId/couple-post-event/review-links', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    const canReview = can(req.auth!.memberships, { eventId }, 'events.edit', orgMap) || can(req.auth!.memberships, { eventId }, 'feedback.manage', orgMap);
    if (!canReview) throw Forbidden();
    const parsed = postEventReviewLinksSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = parseEventMetadata(event);
    const couplePostEvent = { ...(metadata.couplePostEvent ?? {}), reviewLinks: parsed.data, reviewLinksUpdatedAt: new Date().toISOString(), reviewLinksUpdatedBy: req.auth!.email };
    eventsRepo.update(eventId, { metadata: { ...metadata, couplePostEvent } } as never);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.post_event.review_links_update', targetType: 'event', targetId: eventId, ip: req.ip, details: { configured: Object.values(parsed.data).filter(Boolean).length } });
    return { reviewLinks: parsed.data, updatedAt: couplePostEvent.reviewLinksUpdatedAt, updatedBy: couplePostEvent.reviewLinksUpdatedBy };
  });

  app.patch('/api/events/:eventId/couple-post-event/review-queue/bulk', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    const canReview = can(req.auth!.memberships, { eventId }, 'events.edit', orgMap) || can(req.auth!.memberships, { eventId }, 'feedback.manage', orgMap);
    if (!canReview) throw Forbidden();
    const parsed = postEventBulkActionSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = [] as Array<ReturnType<typeof enrichPostEventRequest>>;
    for (const requestId of parsed.data.requestIds) {
      const current = coupleRequestsRepo.findById(requestId);
      if (!current || current.event_id !== eventId || !['post_event_lost_item','post_event_feedback','review_testimonial_request'].includes(current.request_type)) continue;
      const currentMetadata = (() => { try { return JSON.parse(current.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
      const nextMetadata = {
        ...currentMetadata,
        ...(parsed.data.assignedTo ? { assignedTo: parsed.data.assignedTo, assignedAt: new Date().toISOString(), assignedBy: req.auth!.email } : {}),
        ...(parsed.data.slaDays ? { slaDays: parsed.data.slaDays, slaDueAt: addDaysIso(parsed.data.slaDays) } : {}),
        ...(parsed.data.note ? { venueQueueNote: parsed.data.note } : {}),
        lastBulkActionAt: new Date().toISOString(),
        lastBulkActionBy: req.auth!.email,
      };
      const row = coupleRequestsRepo.updateStatus(requestId, parsed.data.status || current.status, req.auth!.userId, nextMetadata);
      if (row) updated.push(enrichPostEventRequest(safeRequest(row)));
    }
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.post_event.review_queue_bulk', targetType: 'event', targetId: eventId, ip: req.ip, details: { count: updated.length, status: parsed.data.status, assignedTo: parsed.data.assignedTo, slaDays: parsed.data.slaDays } });
    return { updated, count: updated.length };
  });

  app.post('/api/events/:eventId/couple-post-event/review-queue/follow-up', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    const canReview = can(req.auth!.memberships, { eventId }, 'events.edit', orgMap) || can(req.auth!.memberships, { eventId }, 'feedback.manage', orgMap);
    if (!canReview) throw Forbidden();
    const parsed = postEventFollowUpSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const queued = [] as Array<{ requestId: string; historyId: string; jobId: string | null; dispatchStatus: string; recipient: string | null }>;
    const smtpIntegrationId = parsed.data.channel === 'email' ? connectedIntegrationId(event.organization_id, 'email_smtp') : null;
    const smsIntegrationId = parsed.data.channel === 'sms' ? connectedIntegrationId(event.organization_id, 'sms_twilio') : null;
    for (const requestId of parsed.data.requestIds) {
      const current = coupleRequestsRepo.findById(requestId);
      if (!current || current.event_id !== eventId || !['post_event_lost_item','post_event_feedback','review_testimonial_request'].includes(current.request_type)) continue;
      const currentMetadata = (() => { try { return JSON.parse(current.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
      const requester = current.requester_user_id ? usersRepo.findById(current.requester_user_id) : null;
      const recipient = parsed.data.channel === 'email'
        ? (requester?.email || (typeof currentMetadata.contactValue === 'string' && currentMetadata.contactValue.includes('@') ? currentMetadata.contactValue : null))
        : parsed.data.channel === 'sms'
          ? (requester?.phone || (typeof currentMetadata.contactValue === 'string' ? currentMetadata.contactValue : null))
          : null;
      const historyId = uuid();
      let jobId: string | null = null;
      let dispatchStatus = parsed.data.channel === 'in_app' ? 'in_app_queued' : 'provider_not_configured';
      if (parsed.data.channel === 'email' && smtpIntegrationId && recipient) {
        const job = jobsRepo.enqueue({
          kind: 'email.send',
          organizationId: event.organization_id,
          payload: {
            integrationId: smtpIntegrationId,
            to: recipient,
            subject: `${event.title} post-event closeout follow-up`,
            text: parsed.data.message,
            html: `<p>${htmlEscape(parsed.data.message).replace(/\n/g, '<br/>')}</p>`,
          },
        });
        jobId = job.id;
        dispatchStatus = 'email_job_queued';
      } else if (parsed.data.channel === 'email' && !recipient) {
        dispatchStatus = 'missing_email_recipient';
      } else if (parsed.data.channel === 'email' && !smtpIntegrationId) {
        dispatchStatus = 'email_provider_not_connected';
      } else if (parsed.data.channel === 'sms' && smsIntegrationId && recipient) {
        const job = jobsRepo.enqueue({
          kind: 'sms.send',
          organizationId: event.organization_id,
          payload: {
            integrationId: smsIntegrationId,
            to: recipient,
            body: parsed.data.message,
          },
        });
        jobId = job.id;
        dispatchStatus = 'sms_job_queued';
      } else if (parsed.data.channel === 'sms' && !recipient) {
        dispatchStatus = 'missing_sms_recipient';
      } else if (parsed.data.channel === 'sms' && !smsIntegrationId) {
        dispatchStatus = 'sms_provider_not_connected';
      }
      db.prepare(`INSERT INTO couple_notification_history (id, organization_id, event_id, user_id, reminder_key, title, body, channel, status, recipient_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'queued', 'couple')`).run(historyId, event.organization_id, eventId, current.requester_user_id, `post-event-follow-up-${requestId}`, 'Post-event closeout follow-up', parsed.data.message, parsed.data.channel);
      coupleRequestsRepo.updateStatus(requestId, current.status, req.auth!.userId, { ...currentMetadata, lastFollowUpAt: new Date().toISOString(), lastFollowUpBy: req.auth!.email, lastFollowUpChannel: parsed.data.channel, followUpCount: Number(currentMetadata.followUpCount || 0) + 1, lastFollowUpMessagePreview: parsed.data.message.slice(0, 240), lastFollowUpJobId: jobId, lastFollowUpDispatchStatus: dispatchStatus });
      queued.push({ requestId, historyId, jobId, dispatchStatus, recipient });
    }
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.post_event.review_queue_follow_up', targetType: 'event', targetId: eventId, ip: req.ip, details: { count: queued.length, channel: parsed.data.channel, dispatched: queued.filter((q) => q.jobId).length } });
    return reply.code(201).send({ queued, count: queued.length, channel: parsed.data.channel, dispatchedJobs: queued.filter((q) => q.jobId).length });
  });

  app.get('/api/events/:eventId/couple-post-event/final-packet.txt', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const summary = couplePostEventSummary({ event, userId: req.auth!.userId });
    const packet = [
      `${event.title} — Post-event final packet`,
      `Wedding date: ${formatDateLong(event.start_date)}`,
      '',
      'Closeout checklist',
      ...summary.closeoutItems.map((item) => `- ${item.label}: ${item.status} — ${item.detail}`),
      '',
      `Final invoice status: ${summary.finalInvoice.status}`,
      `Open balance: $${(summary.finalInvoice.openBalanceCents / 100).toLocaleString()}`,
      `Damage/security deposit: ${summary.damageDeposit.status} — ${summary.damageDeposit.note}`,
      '',
      `NPS / feedback: ${summary.nps.label}${summary.nps.score === null ? '' : ` (${summary.nps.score}/10)`}`,
      `Review workflow: ${summary.reviewWorkflow.status}`,
      '',
      'Memory/photo links',
      ...(summary.photoSharing.links.length ? summary.photoSharing.links.map((link) => `- ${link.label}: ${link.url}`) : ['- No post-event gallery links have been added yet.']),
      '',
      `Thank-you message: ${summary.thankYouMessage}`,
      `Anniversary/future event nurture: ${summary.anniversaryNurture.optedIn ? 'opted in' : 'optional'}`,
      '',
      'Privacy note: This packet excludes internal incident reports, staff performance notes, vendor disputes, and owner financial details.',
    ].join('\n');
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.post_event.final_packet', targetType: 'event', targetId: eventId, ip: req.ip });
    return reply.header('content-type', 'text/plain; charset=utf-8').header('content-disposition', `attachment; filename="post-event-final-packet-${eventId}.txt"`).send(packet);
  });

}
