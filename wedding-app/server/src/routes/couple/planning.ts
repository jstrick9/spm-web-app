import { auditRepo, catalogRepo, contractsRepo, coupleAppointmentsRepo, coupleDocumentsRepo, couplePlanningRepo, coupleRequestsRepo, eventsRepo, guestsRepo, jobsRepo, layoutsRepo, messagesRepo, paymentLinksRepo, rolesRepo, subEventsRepo, teamInvitationsRepo, timelineRepo, usersRepo, vendorsRepo, venuesRepo } from '../../db/repos/index.js';
import { localDateString } from '../../lib/time.js';
import { icsText } from '../../lib/ics.js';
import { formatDateLong } from '../../lib/time.js';
import { deliverTeamInvitation } from '../../lib/teamInviteDelivery.js';
import { db } from '../../db/database.js';
import { uuid } from '../../lib/crypto.js';
import { requireAuth } from '../../middleware/auth.js';
import { can } from '../../lib/rbac.js';
import { z } from 'zod';
import { BadRequest, Conflict, Forbidden, NotFound } from '../../lib/errors.js';
import type { FastifyInstance } from 'fastify';
import { createRequestSchema, updateRequestSchema, coupleTimelineChangeSchema, coupleTimelineApprovalSchema, coupleLayoutCommentSchema, coupleLayoutApprovalSchema, appointmentRequestSchema, appointmentStatusSchema, appointmentSignoffSchema, coupleInboxMessageSchema, coupleDecisionSchema, advancedPlanningSchema, conciergeEscalationSchema, updatePlanningTaskSchema, coupleDesignPreferencesSchema, coupleProfileSchema, parseEventMetadata, isCoupleTimelineItem, safeTimelineItem, layoutItems, summarizeLayoutItem, designSummary, safeVendor, safeGuest, safeRequest, coupleReminderItems, upsertNormalizedAdvancedSections, coupleAdvancedPlanningSummary, canWriteCoupleData } from './shared.js';
import { broadcastSSE } from '../sse.js';

export async function couplePlanningRoutes(app: FastifyInstance) {
  app.get('/api/events/:eventId/couple-advanced-planning', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    return coupleAdvancedPlanningSummary(event, req.auth!.userId);
  });

  app.patch('/api/events/:eventId/couple-advanced-planning', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = advancedPlanningSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    upsertNormalizedAdvancedSections(event, parsed.data as Record<string, unknown>, req.auth!.userId);
    const metadata = parseEventMetadata(event);
    const normalizedKeys = ['ceremony','weddingParty','vipNotes','transportation','memoryBook'];
    const metadataPatch = Object.fromEntries(Object.entries(parsed.data).filter(([key]) => !normalizedKeys.includes(key)));
    const nextPlan = { ...(metadata.coupleAdvancedPlanning ?? {}), ...metadataPatch };
    eventsRepo.update(eventId, { metadata: { ...metadata, coupleAdvancedPlanning: nextPlan, coupleAdvancedPlanningUpdatedAt: new Date().toISOString(), coupleAdvancedPlanningUpdatedBy: req.auth!.email } } as never);
    const refreshed = eventsRepo.findById(eventId)!;
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.advanced_planning.update', targetType: 'event', targetId: eventId, ip: req.ip, details: { fields: Object.keys(parsed.data) } });
    return coupleAdvancedPlanningSummary(refreshed, req.auth!.userId);
  });

  app.post('/api/events/:eventId/couple-advanced-planning/concierge/escalate', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = conciergeEscalationSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'venue_question', note: parsed.data.question, metadata: { source: 'couple_advanced_planning', moduleKey: parsed.data.moduleKey, urgency: parsed.data.urgency, needsVenueApprovedAnswer: true } });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.advanced_planning.escalate', targetType: 'couple_portal_request', targetId: request.id, ip: req.ip, details: { eventId, moduleKey: parsed.data.moduleKey } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.get('/api/events/:eventId/couple-advanced-planning/travel-microsite.txt', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const summary = coupleAdvancedPlanningSummary(event, req.auth!.userId);
    const plan = summary.plan as any;
    const packet = [
      `${event.title} — Personalized guest travel microsite packet`,
      `Wedding date: ${formatDateLong(event.start_date)}`,
      '',
      `Welcome: ${plan.travelMicrosite?.welcome || 'Welcome family and friends.'}`,
      `Travel tips: ${plan.travelMicrosite?.travelTips || 'Venue travel guidance pending.'}`,
      `Lodging: ${plan.travelMicrosite?.lodging || 'Room block/lodging details pending.'}`,
      `Weekend schedule: ${plan.travelMicrosite?.schedule || 'Weekend schedule pending.'}`,
      '',
      `Transportation: ${JSON.stringify(plan.transportation || {})}`,
      `Accessibility and guest care: ${JSON.stringify(plan.accessibility || {})}`,
      `Rain-plan communication: ${plan.rainPlan?.communicationDraft || 'Rain-plan communication pending.'}`,
      '',
      'Privacy note: VIP/family dynamics notes and couple-only planning notes are excluded from this guest-facing packet.',
    ].join('\n');
    return reply.header('content-type', 'text/plain; charset=utf-8').header('content-disposition', `attachment; filename="guest-travel-microsite-${eventId}.txt"`).send(packet);
  });

  app.get('/api/events/:eventId/couple-reminders', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const planning = couplePlanningRepo.ensureDefaults({ organizationId: event.organization_id, eventId, weddingDate: event.start_date });
    const reminders = coupleReminderItems({ event, guests: guestsRepo.listForEvent(eventId), planning, payments: paymentLinksRepo.listForEvent(eventId), contracts: contractsRepo.listForEvent(eventId), documents: coupleDocumentsRepo.listForEvent(eventId), appointments: coupleAppointmentsRepo.listForEvent(eventId) });
    const history = db.prepare(`SELECT * FROM couple_notification_history WHERE event_id = ? AND (user_id = ? OR user_id IS NULL) ORDER BY created_at DESC LIMIT 100`).all(eventId, req.auth!.userId);
    return { reminders, history, language: 'couple-friendly', avoidsInternalLanguage: true };
  });

  app.post('/api/events/:eventId/couple-reminders/digest', { preHandler: requireAuth, config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const planning = couplePlanningRepo.ensureDefaults({ organizationId: event.organization_id, eventId, weddingDate: event.start_date });
    const reminders = coupleReminderItems({ event, guests: guestsRepo.listForEvent(eventId), planning, payments: paymentLinksRepo.listForEvent(eventId), contracts: contractsRepo.listForEvent(eventId), documents: coupleDocumentsRepo.listForEvent(eventId), appointments: coupleAppointmentsRepo.listForEvent(eventId) });
    const digest = [`${event.title} — Wedding planning digest`, '', ...reminders.slice(0, 10).map((r) => `- ${r.title}: ${r.body}`)].join('\n');
    const id = uuid();
    // Honest delivery: the digest is recorded in the couple's notification
    // history. If the org has SMTP connected AND the couple has an email on
    // file, we also queue a real email; otherwise `delivered` stays false so
    // the UI doesn't claim anything was sent.
    let delivered = false;
    let deliveryNote = 'recorded_in_history';
    const smtp = db.prepare(`SELECT id FROM integrations WHERE organization_id = ? AND provider = 'email_smtp' AND status = 'connected' LIMIT 1`).get(event.organization_id) as { id: string } | undefined;
    const requesterEmail = req.auth!.email;
    if (smtp && requesterEmail) {
      const job = jobsRepo.enqueue({
        kind: 'email.send',
        organizationId: event.organization_id,
        payload: {
          integrationId: smtp.id,
          to: requesterEmail,
          subject: `${event.title} — wedding planning digest`,
          text: digest,
          html: `<pre style="font-family: ui-monospace, monospace; white-space: pre-wrap;">${digest.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`,
          headers: { 'X-WVI-Email-Type': 'couple-digest' },
        },
        maxAttempts: 3,
      });
      void job;
      delivered = true;
      deliveryNote = 'email_job_queued';
    }
    db.prepare(`INSERT INTO couple_notification_history (id, organization_id, event_id, user_id, reminder_key, title, body, channel, status, recipient_role) VALUES (?, ?, ?, ?, ?, ?, ?, 'digest', ?, 'couple')`).run(id, event.organization_id, eventId, req.auth!.userId, 'planning-digest', 'Wedding planning digest', digest, delivered ? 'sent' : 'queued');
    return reply.code(201).send({ digest, sent: delivered, delivered, deliveryNote, historyId: id });
  });

  app.get('/api/events/:eventId/couple-privacy', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const requests = coupleRequestsRepo.listForRequester(eventId, req.auth!.userId).map(safeRequest);
    return {
      scope: { eventId, eventTitle: event.title, access: 'event_scoped_couple_access_only' },
      policyPack: {
        allowed: ['Private wedding hub', 'Client-safe event details', 'Guest list center for this wedding', 'RSVP portal preview', 'Client-safe timeline/floorplan/vendor/finance/document views', 'Venue/planner messaging'],
        blocked: ['Venue administration', 'Other weddings', 'Org-wide guest/vendor/event lists', 'Staff operations', 'Audit logs', 'Health/intelligence dashboards', 'Internal budgets', 'Vendor margins', 'Owner finance notes'],
      },
      fieldFiltering: {
        vendors: ['No COI/no-show risk/internal vendor payments unless venue explicitly shares client-safe documents.'],
        finance: ['Only client-safe contracts, invoices, receipts, due dates, balances, and policies. No internal budget/margins/forecasts.'],
        guests: ['Guest notes, allergies, accessibility requests, and meal choices are event-scoped and only shared with venue/planner/vendor teams as needed for service.'],
        staffAuditHealth: ['Staff, audit, and operational health records are not exposed in the couple hub.'],
      },
      exports: [
        { label: 'Privacy-safe guest CSV', href: `/api/events/${eventId}/couple-guests/export.csv` },
        { label: 'Contract/payment packet', href: `/api/events/${eventId}/couple-finance/packet.txt` },
        { label: 'Final document packet', href: `/api/events/${eventId}/couple-documents/final-packet.txt` },
        { label: 'Couple calendar', href: `/api/events/${eventId}/couple-calendar.ics` },
      ],
      secureGuestLinks: 'Guest RSVP links can be generated per guest with tokenized portal access. Do not share admin/couple planning links with guests.',
      collaboratorControls: requests.filter((r) => ['partner_invite', 'planner_request', 'planner_collaboration'].includes(r.requestType)),
    };
  });

  app.get('/api/events/:eventId/couple-calendar', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const appointments = coupleAppointmentsRepo.listForEvent(eventId).map((a) => ({
      id: a.id,
      appointmentType: a.appointment_type,
      title: a.title,
      status: a.status,
      startsAt: a.starts_at,
      endsAt: a.ends_at,
      location: a.location,
      note: a.note,
      preparation: (() => { try { return JSON.parse(a.preparation || '[]'); } catch { return []; } })(),
      reminders: (() => { try { return JSON.parse(a.reminders || '[]'); } catch { return []; } })(),
      availabilityWindow: a.availability_window,
      providerSync: (() => { try { return JSON.parse(a.provider_sync || '{}'); } catch { return {}; } })(),
      signoff: (() => { try { return JSON.parse(a.signoff || '{}'); } catch { return {}; } })(),
      updatedAt: a.updated_at,
    }));
    const planning = couplePlanningRepo.ensureDefaults({ organizationId: event.organization_id, eventId, weddingDate: event.start_date, packageKey: metadata.package || metadata.packageName, cultureKey: metadata.cultureKey });
    const payments = paymentLinksRepo.listForEvent(eventId);
    const calendarItems = [
      ...appointments.map((a) => ({ source: 'appointment', id: a.id, title: a.title, startsAt: a.startsAt, endsAt: a.endsAt, status: a.status, type: a.appointmentType })),
      ...planning.filter((t) => t.due_date).map((t) => ({ source: 'deadline', id: t.id, title: t.title, startsAt: t.due_date, endsAt: t.due_date, status: t.status, type: t.decision_category || 'planning' })),
      ...payments.map((p) => ({ source: 'payment', id: p.id, title: (() => { try { return JSON.parse(p.metadata || '{}').label || 'Payment due'; } catch { return 'Payment due'; } })(), startsAt: (() => { try { return JSON.parse(p.metadata || '{}').dueDate || null; } catch { return null; } })(), endsAt: null, status: p.status, type: 'payment' })),
      event.start_date ? { source: 'wedding', id: event.id, title: event.title, startsAt: event.start_date, endsAt: event.end_date, status: event.status, type: 'wedding_day' } : null,
    ].filter(Boolean);
    const availabilityWindows = metadata.coupleAppointmentAvailability || {
      tasting: 'Tuesdays–Thursdays, 1–4 PM, subject to venue confirmation',
      planning_meeting: 'Weekdays, 10 AM–4 PM',
      final_walkthrough: 'Two weeks before wedding week, weekday mornings preferred',
      rehearsal: 'Usually the day before the wedding, venue-confirmed time',
    };
    return { appointments, calendarItems, availabilityWindows, providerSync: { status: 'not_connected', note: 'Scheduling provider sync placeholder; venue can connect Calendly/Google/Microsoft later.' } };
  });

  app.post('/api/events/:eventId/couple-appointments', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = appointmentRequestSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    if (parsed.data.startsAt && parsed.data.endsAt) {
      const conflicting = coupleAppointmentsRepo.findConflicting(eventId, parsed.data.startsAt, parsed.data.endsAt);
      if (conflicting) {
        throw Conflict('appointment-time-conflict', {
          conflicting: { id: conflicting.id, title: conflicting.title, status: conflicting.status, startsAt: conflicting.starts_at, endsAt: conflicting.ends_at },
        });
      }
    }
    const appointment = coupleAppointmentsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, ...parsed.data });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.appointment.request', targetType: 'couple_appointment', targetId: appointment.id, ip: req.ip, details: { eventId, appointmentType: appointment.appointment_type } });
    return reply.code(201).send({ appointment });
  });

  app.patch('/api/events/:eventId/couple-appointments/:appointmentId', { preHandler: requireAuth }, async (req) => {
    const { eventId, appointmentId } = req.params as { eventId: string; appointmentId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    // Couples reschedule/cancel their own appointments; venue confirms them —
    // staff (view-only) is excluded either way.
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const appointment = coupleAppointmentsRepo.findById(appointmentId);
    if (!appointment || appointment.event_id !== eventId) throw NotFound('appointment-not-found');
    const parsed = appointmentStatusSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    // Confirming a meeting must not double-book the couple: check the
    // appointment's own time window against other live appointments.
    if (parsed.data.status === 'confirmed' && appointment.starts_at && appointment.ends_at) {
      const conflicting = coupleAppointmentsRepo.findConflicting(eventId, appointment.starts_at, appointment.ends_at, appointmentId);
      if (conflicting) {
        throw Conflict('appointment-time-conflict', {
          conflicting: { id: conflicting.id, title: conflicting.title, status: conflicting.status, startsAt: conflicting.starts_at, endsAt: conflicting.ends_at },
        });
      }
    }
    return { appointment: coupleAppointmentsRepo.updateStatus(appointmentId, parsed.data.status, parsed.data.note) };
  });

  app.post('/api/events/:eventId/couple-appointments/:appointmentId/signoff', { preHandler: requireAuth }, async (req) => {
    const { eventId, appointmentId } = req.params as { eventId: string; appointmentId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const appointment = coupleAppointmentsRepo.findById(appointmentId);
    if (!appointment || appointment.event_id !== eventId) throw NotFound('appointment-not-found');
    const parsed = appointmentSignoffSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return { appointment: coupleAppointmentsRepo.signoff(appointmentId, { signedBy: req.auth!.email, note: parsed.data.note }) };
  });

  app.get('/api/events/:eventId/couple-calendar.ics', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const appts = coupleAppointmentsRepo.listForEvent(eventId).filter((a) => a.starts_at);
    const events = appts.map((a) => ['BEGIN:VEVENT', `UID:${a.id}@wvi-couple-calendar`, `DTSTAMP:${now}`, `DTSTART:${String(a.starts_at).replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`, a.ends_at ? `DTEND:${String(a.ends_at).replace(/[-:]/g, '').replace(/\.\d{3}/, '')}` : '', `SUMMARY:${icsText(a.title)}`, a.location ? `LOCATION:${icsText(a.location)}` : '', 'END:VEVENT'].filter(Boolean).join('\r\n'));
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wedding Venue Intelligence Couple Calendar//EN', ...events, 'END:VCALENDAR'].join('\r\n');
    reply.header('Content-Type', 'text/calendar; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="couple_calendar_${eventId}.ics"`);
    return reply.send(ics);
  });

  app.get('/api/events/:eventId/couple-inbox', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const threadDefs = [
      { type: 'venue', label: 'Venue Q&A', expectedResponse: metadata.venueResponseTime || '1 business day' },
      { type: 'planner', label: 'Planner thread', expectedResponse: metadata.plannerResponseTime || '1 business day' },
      { type: 'urgent', label: 'Urgent venue questions', expectedResponse: metadata.urgentResponseTime || 'same business day' },
      { type: 'decision', label: 'Decision needed', expectedResponse: 'tracked until resolved' },
    ];
    const threads = threadDefs.map((thread) => {
      const threadId = `${eventId}:couple-${thread.type}`;
      const messages = messagesRepo.listForThread(threadId, 20);
      return { ...thread, threadId, unread: messagesRepo.unreadCount(threadId, req.auth!.userId), messages };
    });
    const decisions = coupleRequestsRepo.listForEvent(eventId).map(safeRequest).filter((r) => r.requestType === 'decision_needed');
    const org = await Promise.resolve(null).then(() => db.prepare(`SELECT settings, branding FROM organizations WHERE id = ?`).get(event.organization_id) as any);
    const settings = (() => { try { return JSON.parse(org?.settings || '{}'); } catch { return {}; } })();
    const policies = settings?.admin?.venuePolicies || settings?.venuePolicies || [];
    const faq = [
      { q: 'Who sees my messages?', a: 'Venue/planner messages are visible to authorized venue collaborators assigned to your wedding.' },
      { q: 'When should I mark something urgent?', a: 'Use urgent for time-sensitive questions that affect contracts, guest care, safety, final count, or event-week decisions.' },
      ...policies.slice(0, 8).map((p: any) => ({ q: p.label || p.key || 'Venue policy', a: p.value || p.ownerHelp || 'Ask the venue for details.' })),
    ];
    return {
      threads,
      decisions,
      venueContact: { name: metadata.venueContactName || 'Venue coordinator', email: metadata.venueContactEmail || settings?.supportEmail || null, expectedResponse: metadata.venueResponseTime || '1 business day' },
      templates: [
        { id: 'guest_count', label: 'Guest count question', body: 'Can you confirm how final guest count changes affect seating, catering, and invoice timing?' },
        { id: 'payment', label: 'Payment question', body: 'Can you help us understand our next payment due date, balance, or receipt?' },
        { id: 'vendor', label: 'Vendor question', body: 'Can you confirm whether this vendor detail is approved by the venue?' },
        { id: 'timeline', label: 'Timeline change', body: 'We would like to request a timeline change. What is the venue/planner approval process?' },
        { id: 'layout', label: 'Layout change', body: 'We have a floor plan or seating question. Can you review the requested change?' },
        { id: 'accessibility', label: 'Accessibility need', body: 'We have a guest accessibility need to confirm. What details should we provide?' },
      ],
      notificationSummary: { newVenueMessages: threads.reduce((sum, t) => sum + t.unread, 0), dueTasks: couplePlanningRepo.listForEvent(eventId).filter((t) => t.due_date && t.status !== 'completed').length },
      aiDraft: 'Draft answer: Based on venue policy, ask the venue to confirm the specific deadline, approval owner, and whether this affects guest-facing details. Escalate urgent event-week or accessibility issues to the coordinator.',
    };
  });

  app.post('/api/events/:eventId/couple-inbox/messages', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'messages.send', orgMap)) throw Forbidden();
    const parsed = coupleInboxMessageSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const threadType = parsed.data.urgency === 'urgent' ? 'urgent' : parsed.data.threadType;
    const message = messagesRepo.send({ threadId: `${eventId}:couple-${threadType}`, senderId: req.auth!.userId, senderRole: 'couple', body: parsed.data.body });
    return reply.code(201).send({ message });
  });

  app.post('/api/events/:eventId/couple-inbox/decisions', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = coupleDecisionSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'decision_needed', note: parsed.data.detail, metadata: { title: parsed.data.title, dueDate: parsed.data.dueDate, source: 'couple_inbox' } });
    broadcastSSE(event.organization_id, 'couple.decision_created', { eventId, requestId: request.id, title: parsed.data.title }, req.auth!.userId);
    return reply.code(201).send({ decision: safeRequest(request) });
  });

  app.get('/api/events/:eventId/couple-template-gallery', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId); if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const templates = catalogRepo.listForOrg(event.organization_id, 'template').filter((item) => item.visible).map((item) => { const spec: any = item.spec || {}; const minGuests = Number(spec.minGuests ?? 0); const maxGuests = Number(spec.maxGuests ?? 0); const count = event.guest_count || 0; return { id: item.id, name: item.name, moment: spec.moment || 'reception', serviceStyle: spec.serviceStyle || null, minGuests, maxGuests, recommended: (!minGuests || count >= minGuests) && (!maxGuests || count <= maxGuests), description: spec.description || '', venueId: spec.venueId || null }; });
    return { templates, guestCount: event.guest_count, spaces: venuesRepo.listForOrg(event.organization_id).filter((venue) => venue.approval_status === 'approved').map((venue) => ({ id: venue.id, name: venue.name, category: venue.category, capacity: venue.capacity })) };
  });

  app.get('/api/events/:eventId/couple-design', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const preferences = metadata.coupleDesignPreferences ?? {};
    const reviewRequest = coupleRequestsRepo.listForRequester(eventId, req.auth!.userId).map(safeRequest).find((r) => r.requestType === 'design_preferences_review' && ['pending', 'approved', 'rejected'].includes(r.status));
    const fields = Object.keys(coupleDesignPreferencesSchema.shape);
    const completeCount = fields.filter((field) => String(preferences[field] ?? '').trim()).length;
    return {
      preferences,
      progress: { completeCount, total: fields.length, percent: Math.round((completeCount / fields.length) * 100) },
      review: { status: reviewRequest?.status ?? metadata.coupleDesignReviewStatus ?? 'draft', requestId: reviewRequest?.id ?? null, updatedAt: metadata.coupleDesignUpdatedAt ?? null, updatedBy: metadata.coupleDesignUpdatedBy ?? null },
      moodBoard: String(preferences.moodBoardLinks || '').split(/\n|,/).map((s) => s.trim()).filter(Boolean),
      aiSummary: designSummary(preferences),
      venueTemplateHints: ['Ceremony style', 'Rain plan preference', 'Floorplan preference', 'Linens and colors', 'Bar/menu notes', 'Signage and rentals', 'Music restrictions', 'Cultural traditions', 'VIP family / wedding party / photo shot list'],
    };
  });

  app.patch('/api/events/:eventId/couple-design', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = coupleDesignPreferencesSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = parseEventMetadata(event);
    const preferences = { ...(metadata.coupleDesignPreferences ?? {}), ...parsed.data };
    const updatedMetadata = { ...metadata, coupleDesignPreferences: preferences, coupleDesignReviewStatus: 'draft', coupleDesignUpdatedAt: new Date().toISOString(), coupleDesignUpdatedBy: req.auth!.email };
    eventsRepo.update(eventId, { metadata: updatedMetadata } as never);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.design.save_draft', targetType: 'event', targetId: eventId, ip: req.ip, details: { fields: Object.keys(parsed.data) } });
    return { preferences, progress: { percent: Math.round((Object.values(preferences).filter((v) => String(v ?? '').trim()).length / Object.keys(coupleDesignPreferencesSchema.shape).length) * 100) }, reviewStatus: 'draft', aiSummary: designSummary(preferences) };
  });

  app.post('/api/events/:eventId/couple-design/submit-review', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = z.object({ note: z.string().max(2000).optional() }).safeParse(req.body ?? {});
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = parseEventMetadata(event);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'design_preferences_review', note: parsed.data.note, metadata: { source: 'couple_design_preferences', preferences: metadata.coupleDesignPreferences ?? {}, aiSummary: designSummary(metadata.coupleDesignPreferences ?? {}) } });
    eventsRepo.update(eventId, { metadata: { ...metadata, coupleDesignReviewStatus: 'pending', coupleDesignReviewRequestId: request.id, coupleDesignUpdatedAt: new Date().toISOString(), coupleDesignUpdatedBy: req.auth!.email } } as never);
    broadcastSSE(event.organization_id, 'couple.design_submitted', { eventId, requestId: request.id }, req.auth!.userId);
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.get('/api/events/:eventId/couple-vendors', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const vendors = vendorsRepo.listForOrg(event.organization_id, { eventId }).map(safeVendor);
    const requests = coupleRequestsRepo.listForRequester(eventId, req.auth!.userId).map(safeRequest);
    return {
      vendors,
      planner: {
        name: metadata.plannerName || metadata.plannerContactName || null,
        email: metadata.plannerEmail || null,
        phone: metadata.plannerPhone || null,
        status: requests.find((r) => r.requestType === 'planner_collaboration')?.status || (metadata.plannerName ? 'connected' : 'not_connected'),
      },
      requests: requests.filter((r) => ['vendor_request', 'vendor_question', 'planner_collaboration'].includes(r.requestType)),
      recommendationsEnabled: metadata.preferredVendorRecommendationsEnabled !== false,
      visibleDocumentTypes: ['menu', 'floorplan', 'ceremony_music', 'floral_proposal', 'photography_shot_list'],
      hiddenFields: ['COI / insurance files', 'vendor no-show risk', 'internal vendor payment details', 'vendor contract amount', 'internal venue/vendor notes'],
      comparison: vendors.map((v) => ({ id: v.id, name: v.name, category: v.category, status: v.confirmedStatus, documents: v.visibleDocuments.length })),
    };
  });

  app.post('/api/events/:eventId/couple-vendors/request', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = z.object({ category: z.string().min(1).max(120), note: z.string().max(2000).optional(), preferredVendorId: z.string().optional() }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'vendor_request', note: parsed.data.note, metadata: { category: parsed.data.category, preferredVendorId: parsed.data.preferredVendorId, source: 'couple_vendor_board' } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.post('/api/events/:eventId/couple-vendors/question', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = z.object({ vendorId: z.string().optional(), question: z.string().min(1).max(2000) }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'vendor_question', note: parsed.data.question, metadata: { vendorId: parsed.data.vendorId, source: 'couple_vendor_board' } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.post('/api/events/:eventId/couple-planner/collaboration-request', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = z.object({ plannerName: z.string().max(160).optional(), plannerEmail: z.string().email().optional(), note: z.string().max(2000).optional() }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'planner_collaboration', targetEmail: parsed.data.plannerEmail, targetName: parsed.data.plannerName, note: parsed.data.note, metadata: { source: 'couple_planner_hub' } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.get('/api/events/:eventId/couple-layout', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const layouts = layoutsRepo.listForOrg(event.organization_id, { eventId });
    const layout = layouts[0] ?? null;
    const items = layoutItems(layout);
    const summarized = items.map(summarizeLayoutItem);
    const guests = guestsRepo.listForEvent(eventId).map(safeGuest);
    const tables = summarized.filter((i) => ['round_table', 'rect_table', 'table'].includes(i.type));
    const seats = summarized.filter((i) => ['chair', 'seat'].includes(i.type));
    const assignedSeatGuestIds = seats.map((s) => s.guestId).filter(Boolean) as string[];
    const duplicateSeatAssignments = Array.from(new Set(assignedSeatGuestIds.filter((id, index, arr) => arr.indexOf(id) !== index)));
    const unseatedGuests = guests.filter((g) => !g.tableAssignment && !assignedSeatGuestIds.includes(g.id));
    const comments = coupleRequestsRepo.listForEvent(eventId).map(safeRequest).filter((r) => r.requestType === 'event_change_request' && (r.metadata as any)?.source === 'couple_layout_comment');
    const versions = layout ? layoutsRepo.listVersions(layout.id).slice(0, 5).map((v) => ({ revision: v.revision, createdAt: v.created_at, summary: v.change_description || `Revision ${v.revision} saved` })) : [];
    return {
      layout: layout ? { id: layout.id, name: layout.name, approvalStatus: layout.approval_status, revision: layout.revision, updatedAt: layout.updated_at } : null,
      summary: {
        tables: tables.length,
        seats: seats.length,
        assignedSeats: assignedSeatGuestIds.length,
        unseatedGuests: unseatedGuests.length,
        duplicateSeatAssignments: duplicateSeatAssignments.length,
        vendorZones: summarized.filter((i) => i.type === 'vendor_zone').length,
        exits: summarized.filter((i) => /exit/i.test(i.type) || /exit/i.test(i.label)).length,
        adaRoutes: summarized.filter((i) => /ada|access|aisle|walkway/i.test(`${i.type} ${i.label}`)).length,
      },
      visibleItems: {
        tables,
        seats,
        danceFloor: summarized.filter((i) => /dance/i.test(`${i.type} ${i.label}`)),
        ceremonySeating: summarized.filter((i) => /ceremony/i.test(`${i.type} ${i.label}`)),
        bars: summarized.filter((i) => /bar/i.test(`${i.type} ${i.label}`)),
        buffet: summarized.filter((i) => /buffet|catering/i.test(`${i.type} ${i.label}`)),
        restrooms: summarized.filter((i) => /restroom|bathroom/i.test(`${i.type} ${i.label}`)),
        entrances: summarized.filter((i) => /entrance|entry|exit/i.test(`${i.type} ${i.label}`)),
        adaRoutes: summarized.filter((i) => /ada|access|aisle|walkway/i.test(`${i.type} ${i.label}`)),
        photoBooth: summarized.filter((i) => /photo/i.test(`${i.type} ${i.label}`)),
        djBand: summarized.filter((i) => /dj|band|music/i.test(`${i.type} ${i.label}`)),
        sweetheartHeadTable: summarized.filter((i) => /sweetheart|head table|family table/i.test(`${i.type} ${i.label}`)),
      },
      seating: { unseatedGuests, duplicateSeatAssignments, tableAssignments: guests.filter((g) => g.tableAssignment || g.seatAssignment).map((g) => ({ guestId: g.id, fullName: g.fullName, tableAssignment: g.tableAssignment, seatAssignment: g.seatAssignment, tags: g.tags })) },
      comments,
      approval: metadata.coupleLayoutApproval ?? { status: 'not_requested', updatedAt: null, note: null },
      versionHistory: versions,
      guidance: ['Seat VIP/family guests where they have clear ceremony/reception access.', 'Confirm ADA routes before final seating.', 'Place guests needing mobility support near accessible paths, restrooms, and exits.', 'Use venue/planner approval before treating seating as final.'],
      walkthrough3d: { status: 'concept', note: '3D walkthrough placeholder; use the visual preview and venue floor walk for now.' },
    };
  });

  app.post('/api/events/:eventId/couple-layout/comment', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = coupleLayoutCommentSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'event_change_request', note: parsed.data.note, metadata: { source: 'couple_layout_comment', x: parsed.data.x, y: parsed.data.y, areaLabel: parsed.data.areaLabel } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.post('/api/events/:eventId/couple-layout/approval', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = coupleLayoutApprovalSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = parseEventMetadata(event);
    const approval = { status: parsed.data.status, note: parsed.data.note ?? null, updatedAt: new Date().toISOString(), updatedBy: req.auth!.email };
    eventsRepo.update(eventId, { metadata: { ...metadata, coupleLayoutApproval: approval, layoutLastUpdatedAt: approval.updatedAt } } as never);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.layout.approval', targetType: 'event', targetId: eventId, ip: req.ip, details: approval });
    return { approval };
  });

  app.get('/api/events/:eventId/couple-timeline', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const allItems = timelineRepo.listForEvent(eventId);
    const items = allItems.filter(isCoupleTimelineItem).map(safeTimelineItem);
    const subEvents = subEventsRepo.listForEvent(eventId).map((s) => ({ id: s.id, title: s.title, startsAt: s.starts_at, endsAt: s.ends_at, inviteOnly: !!s.invite_only }));
    const requests = coupleRequestsRepo.listForRequester(eventId, req.auth!.userId).map(safeRequest);
    const changeRequests = requests.filter((r) => r.requestType === 'event_change_request' && (r.metadata as any)?.source === 'couple_timeline');
    return {
      items,
      hiddenInternalCount: allItems.length - items.length,
      subEvents,
      rehearsal: subEvents.find((s) => /rehearsal/i.test(s.title)) ?? metadata.rehearsalTimeline ?? null,
      approval: metadata.coupleTimelineApproval ?? { status: 'not_requested', updatedAt: null, note: null },
      changeRequests,
      versionHistory: [
        { at: metadata.timelineLastUpdatedAt || (event as any).updated_at || event.created_at, summary: 'Venue timeline shared for couple review.' },
        ...changeRequests.slice(0, 5).map((r) => ({ at: r.createdAt, summary: `Couple requested timeline change: ${r.note || (r.metadata as any)?.requestedChange || 'change requested'}` })),
      ],
      education: [
        'Sunset photos: confirm photo timing against sunset before finalizing ceremony/cocktail hour.',
        'Photography windows: leave enough buffer for family, wedding party, and couple portraits.',
        'Catering service timing: dinner, speeches, and dances should align with meal service and room reset needs.',
        'Venue noise cutoff: last call, final song, and send-off must respect venue quiet-hour rules.',
      ],
    };
  });

  app.post('/api/events/:eventId/couple-timeline/request-change', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = coupleTimelineChangeSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'event_change_request', note: parsed.data.reason || parsed.data.requestedChange, metadata: { source: 'couple_timeline', timelineItemId: parsed.data.timelineItemId, requestedChange: parsed.data.requestedChange } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.post('/api/events/:eventId/couple-timeline/approval', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = coupleTimelineApprovalSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = parseEventMetadata(event);
    const approval = { status: parsed.data.status, note: parsed.data.note ?? null, updatedAt: new Date().toISOString(), updatedBy: req.auth!.email };
    eventsRepo.update(eventId, { metadata: { ...metadata, coupleTimelineApproval: approval, timelineLastUpdatedAt: approval.updatedAt } } as never);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.timeline.approval', targetType: 'event', targetId: eventId, ip: req.ip, details: approval });
    return { approval };
  });

  app.get('/api/events/:eventId/couple-timeline/export.ics', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const events = timelineRepo.listForEvent(eventId).filter(isCoupleTimelineItem).map((item) => {
      const start = item.starts_at.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const end = (item.ends_at || item.starts_at).replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      return ['BEGIN:VEVENT', `UID:${item.id}@wvi-couple`, `DTSTAMP:${now}`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${icsText(item.title)}`, item.location ? `LOCATION:${icsText(item.location)}` : '', 'END:VEVENT'].filter(Boolean).join('\r\n');
    });
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wedding Venue Intelligence Couple Timeline//EN', ...events, 'END:VCALENDAR'].join('\r\n');
    reply.header('Content-Type', 'text/calendar; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="couple_timeline_${eventId}.ics"`);
    return reply.send(ics);
  });

  app.get('/api/events/:eventId/couple-planning', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    const tasks = couplePlanningRepo.ensureDefaults({ organizationId: event.organization_id, eventId, weddingDate: event.start_date, packageKey: metadata.package || metadata.packageName, cultureKey: metadata.cultureKey });
    const today = localDateString();
    return {
      tasks: tasks.map((t) => ({
        id: t.id,
        eventId: t.event_id,
        templateKey: t.template_key,
        title: t.title,
        description: t.description,
        owner: t.owner,
        dueDate: t.due_date,
        status: t.status,
        approvalStatus: t.approval_status,
        decisionCategory: t.decision_category,
        attachments: (() => { try { return JSON.parse(t.attachments || '[]'); } catch { return []; } })(),
        history: (() => { try { return JSON.parse(t.history || '[]'); } catch { return []; } })(),
        isOverdue: !!t.due_date && t.due_date < today && t.status !== 'completed',
        isUpcoming: !!t.due_date && t.due_date >= today && t.due_date <= localDateString(new Date(Date.now() + 14 * 86400000)) && t.status !== 'completed',
        updatedAt: t.updated_at,
      })),
      template: { packageKey: metadata.package || metadata.packageName || 'standard', cultureKey: metadata.cultureKey || 'default', source: 'venue-controlled-default-deadline-template' },
    };
  });

  app.patch('/api/events/:eventId/couple-planning/:taskId', { preHandler: requireAuth }, async (req) => {
    const { eventId, taskId } = req.params as { eventId: string; taskId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = updatePlanningTaskSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const task = couplePlanningRepo.findById(taskId);
    if (!task || task.event_id !== eventId) throw NotFound('task-not-found');
    const updated = couplePlanningRepo.update(taskId, parsed.data, req.auth!.email);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.planning_task.update', targetType: 'couple_planning_task', targetId: taskId, ip: req.ip, details: { eventId, status: parsed.data.status, approvalStatus: parsed.data.approvalStatus } });
    return { task: updated };
  });

  app.post('/api/events/:eventId/couple-planning/:taskId/question', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId, taskId } = req.params as { eventId: string; taskId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const task = couplePlanningRepo.findById(taskId);
    if (!task || task.event_id !== eventId) throw NotFound('task-not-found');
    const parsed = z.object({ question: z.string().min(1).max(2000) }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'venue_question', note: parsed.data.question, metadata: { source: 'couple_planning_task', taskId, taskTitle: task.title } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.get('/api/events/:eventId/couple-profile', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = parseEventMetadata(event);
    return {
      profile: metadata.coupleProfile ?? {},
      lastUpdatedAt: metadata.coupleProfileUpdatedAt ?? null,
      lastUpdatedBy: metadata.coupleProfileUpdatedBy ?? null,
    };
  });

  app.patch('/api/events/:eventId/couple-profile', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = coupleProfileSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = parseEventMetadata(event);
    const nextProfile = { ...(metadata.coupleProfile ?? {}), ...parsed.data };
    const updatedMetadata = {
      ...metadata,
      coupleProfile: nextProfile,
      coupleProfileUpdatedAt: new Date().toISOString(),
      coupleProfileUpdatedBy: req.auth!.email,
    };
    eventsRepo.update(eventId, { metadata: updatedMetadata } as never);
    auditRepo.log({
      organizationId: event.organization_id,
      actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email,
      action: 'couple.profile.update',
      targetType: 'event',
      targetId: eventId,
      ip: req.ip,
      details: { fields: Object.keys(parsed.data) },
    });
    return { profile: nextProfile, lastUpdatedAt: updatedMetadata.coupleProfileUpdatedAt, lastUpdatedBy: updatedMetadata.coupleProfileUpdatedBy };
  });

  app.get('/api/events/:eventId/couple-requests', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const canReview = can(req.auth!.memberships, { eventId }, 'events.members.invite', orgMap) || can(req.auth!.memberships, { eventId }, 'events.edit', orgMap);
    const rows = canReview ? coupleRequestsRepo.listForEvent(eventId) : coupleRequestsRepo.listForRequester(eventId, req.auth!.userId);
    return { requests: rows.map(safeRequest), canReview };
  });

  app.post('/api/events/:eventId/couple-requests', { preHandler: requireAuth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const parsed = createRequestSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    if (['partner_invite', 'planner_request'].includes(parsed.data.requestType) && !parsed.data.targetEmail) {
      throw BadRequest('target-email-required');
    }
    const request = coupleRequestsRepo.create({
      organizationId: event.organization_id,
      eventId,
      requesterUserId: req.auth!.userId,
      requestType: parsed.data.requestType,
      targetEmail: parsed.data.targetEmail,
      targetName: parsed.data.targetName,
      note: parsed.data.note,
      metadata: {
        ...(parsed.data.metadata ?? {}),
        submittedByRole: req.auth!.memberships.find((m) => m.eventId === eventId)?.roleKey ?? 'member',
      },
    });
    auditRepo.log({
      organizationId: event.organization_id,
      actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email,
      action: 'couple.request.create',
      targetType: 'couple_portal_request',
      targetId: request.id,
      ip: req.ip,
      details: { eventId, requestType: request.request_type, targetEmail: request.target_email },
    });
    broadcastSSE(event.organization_id, 'couple.request_created', { eventId, requestId: request.id, requestType: request.request_type }, req.auth!.userId);
    return reply.code(201).send({ request: safeRequest(request) });
  });

  // CP-07: best-effort email delivery of the generated invitation link.
  const deliverInvitation = async (token: string, event: any, email: string, logger: { error: (obj: unknown, msg: string) => void }) => {
    try {
      const invitation = teamInvitationsRepo.findValidByToken(token);
      if (invitation) await deliverTeamInvitation({ invitation, token });
    } catch (err) {
      logger.error({ err, eventId: event.id, email }, 'partner/planner invitation delivery failed');
    }
  };

  app.patch('/api/events/:eventId/couple-requests/:requestId', { preHandler: requireAuth }, async (req) => {
    const { eventId, requestId } = req.params as { eventId: string; requestId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.members.invite', orgMap) && !can(req.auth!.memberships, { eventId }, 'events.edit', orgMap)) throw Forbidden();
    const parsed = updateRequestSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const current = coupleRequestsRepo.findById(requestId);
    if (!current || current.event_id !== eventId) throw NotFound('request-not-found');
    const metadata = { ...(() => { try { return JSON.parse(current.metadata || '{}'); } catch { return {}; } })(), ...(parsed.data.metadata ?? {}), reviewNote: parsed.data.note };
    const updated = coupleRequestsRepo.updateStatus(requestId, parsed.data.status, req.auth!.userId, metadata)!;

    // MODULE-07 CP-07: partner/planner invitations must work for people who
    // don't have an account yet — approval silently did nothing before.
    let inviteToken: string | null = null;
    if (parsed.data.status === 'approved' && ['partner_invite', 'planner_request'].includes(updated.request_type) && updated.target_email) {
      const existing = usersRepo.findByEmail(updated.target_email);
      const role = rolesRepo.findByKey(null, updated.request_type === 'partner_invite' ? 'couple' : 'planner');
      if (existing && role) {
        eventsRepo.addMember({ eventId, userId: existing.id, roleId: role.id });
      } else if (role) {
        const invite = teamInvitationsRepo.create({
          organizationId: event.organization_id,
          email: updated.target_email,
          roleId: role.id,
          invitedBy: req.auth!.userId,
          eventId,
          invitationType: 'event',
        });
        inviteToken = invite.token;
        deliverInvitation(invite.token, event, updated.target_email, req.log);
      }
    }

    auditRepo.log({
      organizationId: event.organization_id,
      actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email,
      action: 'couple.request.update',
      targetType: 'couple_portal_request',
      targetId: requestId,
      ip: req.ip,
      details: { eventId, requestType: updated.request_type, status: updated.status },
    });
    broadcastSSE(event.organization_id, 'couple.request_updated', { eventId, requestId, requestType: updated.request_type, status: updated.status, invitationToken: inviteToken ?? null }, req.auth!.userId);
    return { request: safeRequest(updated), invitationToken: inviteToken ?? null };
  });

}
