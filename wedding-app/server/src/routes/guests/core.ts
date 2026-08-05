import { auditRepo, eventsRepo, guestIdentityRepo, guestsRepo, jobsRepo, layoutsRepo, portalConfigRepo, rsvpRepo } from '../../db/repos/index.js';
import { db } from '../../db/database.js';
import { hashPassword, uuid } from '../../lib/crypto.js';
import { requireAuth } from '../../middleware/auth.js';
import { can } from '../../lib/rbac.js';
import { broadcastSSE } from '../sse.js';
import { z } from 'zod';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import { csvCell } from '../../lib/csv.js';
import type { FastifyInstance } from 'fastify';
import { guestSchema, portalConfigSchema, guestHelpUpdateSchema, guestHelpReplySchema, activeSmtpIntegrationId, activeSmsIntegrationId, addDaysIso, escapeHtml, safeGuestHelpRequest, safeGuestHelpReply, requireCoupleGuestManager } from './shared.js';

export async function guestCoreRoutes(app: FastifyInstance) {
  app.get('/api/events/:eventId/guest-portal-security', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'guests.view', orgMap)) throw Forbidden();
    const rows = db.prepare(`SELECT * FROM audit_logs WHERE organization_id = ? AND (target_id = ? OR details LIKE ?) AND (action LIKE 'public.portal.%' OR action LIKE 'public.rsvp.%' OR action LIKE 'public.abuse.%') ORDER BY created_at DESC LIMIT 250`)
      .all(event.organization_id, eventId, `%${eventId}%`) as any[];
    const parse = (value: string) => { try { return JSON.parse(value || '{}'); } catch { return {}; } };
    const audits = rows.map((row) => ({ id: row.id, action: row.action, targetType: row.target_type, targetId: row.target_id, ip: row.ip, userAgent: row.user_agent, deviceSession: parse(row.details).deviceSession || null, details: parse(row.details), createdAt: row.created_at }));
    const counts = audits.reduce((acc: Record<string, number>, row) => { acc[row.action] = (acc[row.action] || 0) + 1; return acc; }, {});
    const deviceCounts = audits.reduce((acc: Record<string, number>, row) => { const key = row.deviceSession || 'unknown'; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
    const suspicious = audits.filter((row) => row.action.includes('abuse') || row.action.includes('failed') || row.action.includes('suspicious') || row.action.includes('token_failed'));
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    return {
      summary: {
        totalAudits: audits.length,
        suspiciousCount: suspicious.length,
        uniqueDeviceSessions: Object.keys(deviceCounts).filter((k) => k !== 'unknown').length,
        genericGuestDirectoryExposed: portalConfig.allowGenericGuestDirectory === true,
        tokenizedLinksPreferred: true,
        rateLimitsAndHoneypotsActive: true,
      },
      counts,
      topDeviceSessions: Object.entries(deviceCounts).map(([deviceSession, count]) => ({ deviceSession, count })).sort((a, b) => b.count - a.count).slice(0, 8),
      suspicious: suspicious.slice(0, 25),
      audits: audits.slice(0, 80),
    };
  });

  app.get('/api/events/:eventId/guest-help-requests', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'guests.view', orgMap)) throw Forbidden();
    const rows = db.prepare(`SELECT * FROM guest_help_requests WHERE event_id = ? ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END, created_at DESC LIMIT 200`).all(eventId);
    return { requests: rows.map(safeGuestHelpRequest), counts: { open: rows.filter((r: any) => r.status === 'open').length, inReview: rows.filter((r: any) => r.status === 'in_review').length, resolved: rows.filter((r: any) => r.status === 'resolved').length, closed: rows.filter((r: any) => r.status === 'closed').length } };
  });

  app.get('/api/events/:eventId/catering-dietary-export.csv', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'guests.view', orgMap)) throw Forbidden();
    const rows = db.prepare(`SELECT g.full_name, g.email, g.phone, g.party_name, g.table_assignment, g.seat_assignment, g.room_assignment, g.dietary_restrictions, g.accessibility_notes, g.metadata, r.meal_choice, r.dietary_notes, r.special_needs, r.notes, r.submitted_at
      FROM guests g
      LEFT JOIN rsvp_submissions r ON r.id = (SELECT id FROM rsvp_submissions WHERE guest_id = g.id ORDER BY submitted_at DESC LIMIT 1)
      WHERE g.event_id = ? AND g.deleted_at IS NULL
      ORDER BY g.full_name`).all(eventId) as Array<Record<string, any>>;
    const rowsOut: Array<Record<string, any>> = rows.map((r) => {
      let meta: Record<string, any> = {};
      try { meta = JSON.parse(r.metadata || '{}'); } catch { /* ignore */ }
      // Couple-entered meal choices live in guest metadata; the RSVP
      // submission may be absent (e.g. RSVP captured by phone and entered by
      // the couple). Coalesce so catering always sees the effective choice.
      const mealChoice = r.meal_choice || meta.mealChoice || '';
      const cateringNotes = [r.special_needs, r.notes, meta.coupleNotes ? `Couple note: ${meta.coupleNotes}` : ''].filter(Boolean).join(' | ');
      return { ...r, mealChoice, cateringNotes };
    });
    const csv = [
      ['Guest','Email','Phone','Household','Table','Seat','Lodging','Meal choice','Dietary restrictions','Allergies / dietary notes','Accessibility needs','Catering notes','Submitted at'].map(csvCell).join(','),
      ...rowsOut.map((r) => [r.full_name, r.email, r.phone, r.party_name, r.table_assignment, r.seat_assignment, r.room_assignment, r.mealChoice, r.dietary_restrictions, r.dietary_notes, r.accessibility_notes, r.cateringNotes, r.submitted_at].map(csvCell).join(',')),
    ].join('\n');
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'guests.catering_dietary_export', targetType: 'event', targetId: eventId, ip: req.ip, details: { rows: rows.length } });
    return reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', `attachment; filename="catering-dietary-${eventId}.csv"`).send(csv);
  });

  app.patch('/api/events/:eventId/guest-help-requests/:requestId', { preHandler: requireAuth }, async (req) => {
    const { eventId, requestId } = req.params as { eventId: string; requestId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'guests.manage', orgMap)) throw Forbidden();
    const parsed = guestHelpUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const current = db.prepare(`SELECT * FROM guest_help_requests WHERE id = ? AND event_id = ?`).get(requestId, eventId) as any;
    if (!current) throw NotFound('guest-help-request-not-found');
    const nextStatus = parsed.data.status ?? current.status;
    const slaDueAt = parsed.data.slaDueAt || (parsed.data.slaDays ? addDaysIso(parsed.data.slaDays) : null);
    db.prepare(`UPDATE guest_help_requests SET status = ?, assigned_to = COALESCE(?, assigned_to), resolution_note = COALESCE(?, resolution_note), sla_due_at = COALESCE(?, sla_due_at), updated_at = datetime('now') WHERE id = ?`).run(nextStatus, parsed.data.assignedTo || null, parsed.data.resolutionNote || null, slaDueAt, requestId);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'portal.guest_help_request.update', targetType: 'guest_help_request', targetId: requestId, ip: req.ip, details: { status: nextStatus, assignedTo: parsed.data.assignedTo, slaDueAt } });
    return { request: safeGuestHelpRequest(db.prepare(`SELECT * FROM guest_help_requests WHERE id = ?`).get(requestId)) };
  });

  app.post('/api/events/:eventId/guest-help-requests/:requestId/reply', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId, requestId } = req.params as { eventId: string; requestId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'guests.manage', orgMap)) throw Forbidden();
    const parsed = guestHelpReplySchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const current = db.prepare(`SELECT * FROM guest_help_requests WHERE id = ? AND event_id = ?`).get(requestId, eventId) as any;
    if (!current) throw NotFound('guest-help-request-not-found');
    const guest = current.guest_id ? guestsRepo.findById(current.guest_id) : null;
    const recipient = parsed.data.channel === 'email' ? (current.email || guest?.email || null) : parsed.data.channel === 'sms' ? (guest?.phone || null) : null;
    let jobId: string | null = null;
    let status = parsed.data.channel === 'in_app' ? 'in_app_recorded' : 'missing_recipient';
    if (parsed.data.channel === 'email' && recipient) {
      const smtpId = activeSmtpIntegrationId(event.organization_id);
      if (smtpId) {
        const job = jobsRepo.enqueue({ kind: 'email.send', organizationId: event.organization_id, payload: { integrationId: smtpId, to: recipient, subject: `${event.title} guest portal help`, text: parsed.data.message, html: `<p>${escapeHtml(parsed.data.message).replace(/\n/g, '<br/>')}</p>` } });
        jobId = job.id; status = 'email_job_queued';
      } else status = 'email_provider_not_connected';
    }
    if (parsed.data.channel === 'sms' && recipient) {
      const smsId = activeSmsIntegrationId(event.organization_id);
      if (smsId) {
        const job = jobsRepo.enqueue({ kind: 'sms.send', organizationId: event.organization_id, payload: { integrationId: smsId, to: recipient, body: parsed.data.message } });
        jobId = job.id; status = 'sms_job_queued';
      } else status = 'sms_provider_not_connected';
    }
    const nextStatus = parsed.data.closeRequest ? 'resolved' : current.status === 'open' ? 'in_review' : current.status;
    db.prepare(`UPDATE guest_help_requests SET status = ?, last_reply_at = datetime('now'), last_reply_channel = ?, last_reply_job_id = ?, last_reply_status = ?, resolution_note = COALESCE(?, resolution_note), updated_at = datetime('now') WHERE id = ?`).run(nextStatus, parsed.data.channel, jobId, status, parsed.data.closeRequest ? 'Replied and resolved.' : null, requestId);
    const replyId = uuid();
    db.prepare(`INSERT INTO guest_help_request_replies (id, organization_id, event_id, request_id, guest_id, channel, body, dispatch_status, job_id, sent_by, sent_by_label, visible_to_guest) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
      .run(replyId, event.organization_id, eventId, requestId, current.guest_id || null, parsed.data.channel, parsed.data.message, status, jobId, req.auth!.userId, req.auth!.email);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'portal.guest_help_request.reply', targetType: 'guest_help_request', targetId: requestId, ip: req.ip, details: { channel: parsed.data.channel, status, jobId, recipient: !!recipient, replyId } });
    return reply.code(201).send({ request: safeGuestHelpRequest(db.prepare(`SELECT * FROM guest_help_requests WHERE id = ?`).get(requestId)), reply: safeGuestHelpReply(db.prepare(`SELECT * FROM guest_help_request_replies WHERE id = ?`).get(replyId)), jobId, dispatchStatus: status });
  });

  app.get('/api/events/:eventId/venue-guest-manifest', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId); if (!can(req.auth!.memberships, { eventId }, 'guests.view', orgMap)) throw Forbidden();
    const guests = guestsRepo.listForEvent(eventId).filter((guest: any) => guest.rsvp_status === 'attending').map((guest: any) => { let metadata: any = {}; try { metadata = JSON.parse(guest.metadata || '{}'); } catch {} return { id: guest.id, fullName: guest.full_name, rsvpStatus: guest.rsvp_status, partyName: guest.party_name, relationship: metadata.relationship || null, bridalParty: !!metadata.bridalParty, tableAssignment: guest.table_assignment, seatAssignment: guest.seat_assignment }; });
    return { guests, counts: guestsRepo.countByStatus(eventId) };
  });

  app.get('/api/events/:eventId/guests', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'guests.view', orgMap)) throw Forbidden();
    
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();

    const layouts = layoutsRepo.listForOrg(event.organization_id, { eventId });
    const layout = layouts.length > 0 ? layouts[0] : null;
    let layoutPayload = null;
    if (layout) {
       try { layoutPayload = typeof layout.payload === 'string' ? JSON.parse(layout.payload) : layout.payload; } catch {}
    }

    return {
      layout: layoutPayload,
      guests: guestsRepo.listForEvent(eventId),
      counts: guestsRepo.countByStatus(eventId),
    };
  });

  app.get("/api/orgs/:orgId/guests", { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, "guests.view")) throw Forbidden();

    const q = req.query as {
      search?: string;
      rsvpStatus?: string;
      eventId?: string;
      limit?: string;
      offset?: string;
    };
    const rsvpStatusList = q.rsvpStatus
      ? q.rsvpStatus.split(",").filter(Boolean)
      : undefined;

    const result = guestsRepo.listForOrg(orgId, {
      search: q.search,
      rsvpStatus: rsvpStatusList,
      eventId: q.eventId,
      limit: q.limit ? Number(q.limit) : undefined,
      offset: q.offset ? Number(q.offset) : undefined,
    });
    const counts = guestsRepo.countByStatusForOrg(orgId);

    return { guests: result.guests, total: result.total, counts };
  });

  app.get("/api/orgs/:orgId/guest-duplicates", { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, "guests.view")) throw Forbidden();
    return { clusters: guestIdentityRepo.findDuplicates(orgId) };
  });

  /**
   * Guest identity merge — owner/admin-only data-quality tool (blueprint §6).
   * The repo performs the merge safely: human-confirmed, org-scoped,
   * never deletes across orgs; RSVP/sub-event data is re-pointed to the
   * primary before the duplicates are soft-deleted.
   */
  app.post("/api/orgs/:orgId/guests/merge", { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, "org.manage")) throw Forbidden();
    const parsed = z.object({
      primaryId: z.string().min(1),
      duplicateIds: z.array(z.string().min(1)).min(1).max(50),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const result = guestIdentityRepo.merge(orgId, parsed.data.primaryId, parsed.data.duplicateIds);
    if ('error' in result) {
      if (result.error === 'primary-not-found' || result.error === 'no-valid-duplicates') throw NotFound(result.error);
      throw BadRequest(result.error);
    }
    auditRepo.log({
      organizationId: orgId, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'guest.identity.merge', targetType: 'guest', targetId: result.primary.id,
      ip: req.ip, details: { duplicateIds: parsed.data.duplicateIds, mergedCount: result.mergedCount },
    });
    for (const dupId of parsed.data.duplicateIds) {
      const dup = guestsRepo.findById(dupId);
      if (dup) broadcastSSE(dup.organization_id, "guest.updated", { guestId: dupId, eventId: dup.event_id, mergedInto: result.primary.id }, req.auth!.userId);
    }
    return reply.code(200).send(result);
  });

  app.post('/api/events/:eventId/guests/bulk', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    requireCoupleGuestManager(req.auth!.memberships, eventId, orgMap);
    
    const bulkSchema = z.object({
      mode: z.enum(['skip', 'replace', 'append']),
      guests: z.array(guestSchema),
    });
    
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    
    const result = guestsRepo.bulkCreate(event.organization_id, eventId, parsed.data.mode, parsed.data.guests);
    auditRepo.log({
      organizationId: event.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'guest.bulk_create',
      targetType: 'event', targetId: eventId, ip: req.ip,
      details: { mode: parsed.data.mode, ...result },
    });
    broadcastSSE(event.organization_id, "guest.updated", { eventId, bulk: true, ...result }, req.auth!.userId);
    return reply.code(201).send(result);
  });

  app.post('/api/events/:eventId/guests', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    requireCoupleGuestManager(req.auth!.memberships, eventId, orgMap);
    const parsed = guestSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const guest = guestsRepo.create(event.organization_id, eventId, parsed.data);
    auditRepo.log({
      organizationId: event.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'guest.create',
      targetType: 'guest', targetId: guest.id, ip: req.ip,
    });
    broadcastSSE(event.organization_id, "guest.created", { guestId: guest.id, eventId, name: guest.full_name }, req.auth!.userId);
    return reply.code(201).send({ guest });
  });

  app.patch('/api/guests/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const guest = guestsRepo.findById(id);
    if (!guest) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    requireCoupleGuestManager(req.auth!.memberships, guest.event_id, orgMap);
    const parsed = guestSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = guestsRepo.update(id, parsed.data);
    broadcastSSE(guest.organization_id, "guest.updated", { guestId: id, eventId: guest.event_id }, req.auth!.userId);
    return { guest: updated };
  });

  app.delete('/api/guests/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const guest = guestsRepo.findById(id);
    if (!guest) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    requireCoupleGuestManager(req.auth!.memberships, guest.event_id, orgMap);
    guestsRepo.softDelete(id);
    auditRepo.log({
      organizationId: guest.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'guest.delete',
      targetType: 'guest', targetId: id, ip: req.ip, details: { eventId: guest.event_id },
    });
    broadcastSSE(guest.organization_id, "guest.updated", { guestId: id, eventId: guest.event_id, deleted: true }, req.auth!.userId);
    return reply.code(204).send();
  });

  app.post('/api/guests/:id/portal-token', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const guest = guestsRepo.findById(id);
    if (!guest) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId); requireCoupleGuestManager(req.auth!.memberships, guest.event_id, orgMap);
    const token = guestsRepo.rotatePortalToken(id);
    auditRepo.log({
      organizationId: guest.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'guest.portal_token.rotate',
      targetType: 'guest', targetId: id, ip: req.ip, details: { eventId: guest.event_id },
    });
    return { token };
  });

  app.delete('/api/guests/:id/portal-token', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const guest = guestsRepo.findById(id);
    if (!guest) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId); requireCoupleGuestManager(req.auth!.memberships, guest.event_id, orgMap);
    guestsRepo.revokePortalToken(id);
    auditRepo.log({
      organizationId: guest.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'guest.portal_token.revoke',
      targetType: 'guest', targetId: id, ip: req.ip, details: { eventId: guest.event_id },
    });
    return reply.code(204).send();
  });

  app.get('/api/events/:eventId/rsvps', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'rsvp.view', orgMap)) throw Forbidden();
    return { rsvps: rsvpRepo.listForEvent(eventId) };
  });

  app.get('/api/events/:eventId/portal-config', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'portal.config.manage', orgMap)) throw Forbidden();
    return { config: portalConfigRepo.getForEvent(eventId) };
  });

  app.put('/api/events/:eventId/portal-config', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: event.organization_id }, 'portal.config.manage')) throw Forbidden();
    const parsed = portalConfigSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

    let passwordHash: string | null | undefined;
    let passwordSalt: string | null | undefined;
    if (parsed.data.password) {
      const rec = hashPassword(parsed.data.password);
      passwordHash = rec.passwordHash;
      passwordSalt = rec.passwordSalt;
    } else if (parsed.data.clearPassword) {
      passwordHash = null;
      passwordSalt = null;
    }

    const config = portalConfigRepo.upsert({
      organizationId: event.organization_id,
      eventId,
      enabled: parsed.data.enabled,
      passwordHash, passwordSalt,
      accessStartsAt: parsed.data.accessStartsAt,
      accessEndsAt: parsed.data.accessEndsAt,
      gracePeriodHours: parsed.data.gracePeriodHours,
      config: parsed.data.config,
      updatedBy: req.auth!.userId,
    });
    auditRepo.log({
      organizationId: event.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'portal_config.update',
      targetType: 'event', targetId: eventId, ip: req.ip,
    });
    return { config };
  });

}
