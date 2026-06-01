import type { FastifyInstance } from 'fastify';
import { broadcastSSE } from "./sse.js";
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { auditRepo, eventsRepo, guestsRepo, rsvpRepo, portalConfigRepo, layoutsRepo, orgsRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import { hashPassword, verifyPassword } from '../lib/crypto.js';

const guestSchema = z.object({
  fullName:             z.string().min(1).max(200),
  email:                z.string().email().max(254).optional(),
  phone:                z.string().max(40).optional(),
  partyName:            z.string().max(200).optional(),
  rsvpStatus:           z.enum(['pending','attending','declined','maybe']).optional(),
  dietaryRestrictions:  z.string().max(2000).optional(),
  accessibilityNotes:   z.string().max(2000).optional(),
  tableAssignment:      z.string().max(60).optional(),
  roomAssignment:       z.string().max(60).optional(),
  seatAssignment:       z.string().max(60).optional(),
  plusOneAllowed:       z.boolean().optional(),
  allowPortalAccess:    z.boolean().optional(),
  allowLodgingAccess:   z.boolean().optional(),
  metadata:             z.record(z.unknown()).optional(),
});

const rsvpSchema = z.object({
  guestId:           z.string().optional(),
  attending:         z.boolean(),
  attendingDays:     z.array(z.string()).optional(),
  mealChoice:        z.string().max(60).optional(),
  plusOneName:       z.string().max(200).optional(),
  plusOneMealChoice: z.string().max(60).optional(),
  dietaryNotes:      z.string().max(2000).optional(),
  specialNeeds:      z.string().max(2000).optional(),
  notes:             z.string().max(2000).optional(),
});

const portalConfigSchema = z.object({
  enabled:            z.boolean(),
  password:           z.string().min(4).max(200).optional(),
  clearPassword:      z.boolean().optional(),
  accessStartsAt:     z.string().optional(),
  accessEndsAt:       z.string().optional(),
  gracePeriodHours:   z.number().int().min(0).max(720).optional(),
  config:             z.record(z.unknown()).optional(),
});

export async function guestRoutes(app: FastifyInstance) {
  // ─── List guests for an event ─────────────────────────
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


  // ─── List guests across all events in an org ──────────
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

  
  app.post('/api/events/:eventId/guests/bulk', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'guests.manage', orgMap)) throw Forbidden();
    
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
    });
    return reply.code(201).send(result);
  });

  app.post('/api/events/:eventId/guests', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'guests.manage', orgMap)) throw Forbidden();
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
    if (!can(req.auth!.memberships, { organizationId: guest.organization_id }, 'guests.manage')) throw Forbidden();
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
    if (!can(req.auth!.memberships, { organizationId: guest.organization_id }, 'guests.manage')) throw Forbidden();
    guestsRepo.softDelete(id);
    return reply.code(204).send();
  });

  app.post('/api/guests/:id/portal-token', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const guest = guestsRepo.findById(id);
    if (!guest) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: guest.organization_id }, 'guests.manage')) throw Forbidden();
    const token = guestsRepo.rotatePortalToken(id);
    return { token };
  });

  app.delete('/api/guests/:id/portal-token', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const guest = guestsRepo.findById(id);
    if (!guest) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: guest.organization_id }, 'guests.manage')) throw Forbidden();
    guestsRepo.revokePortalToken(id);
    return reply.code(204).send();
  });

  // ─── RSVPs (authenticated list) ───────────────────────
  app.get('/api/events/:eventId/rsvps', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'rsvp.view', orgMap)) throw Forbidden();
    return { rsvps: rsvpRepo.listForEvent(eventId) };
  });

  // ─── Portal config (authenticated) ────────────────────
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

  // ─── PUBLIC portal endpoints ──────────────────────────
  app.get('/api/portal/:eventId/info', async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const cfg = portalConfigRepo.getForEvent(eventId) as { enabled: number; password_hash: string | null } | undefined;
    const requiresPassword = !!cfg?.password_hash;
    // Security: return 404 if portal is explicitly disabled
    if (cfg && !cfg.enabled) throw NotFound("portal-disabled");
    const guestList = guestsRepo.listForEvent(eventId)
      .filter((g) => g.allow_portal_access)
      .map((g) => ({ id: g.id, fullName: g.full_name, tableAssignment: g.table_assignment, seatAssignment: g.seat_assignment }));
    // Include org theme for portal styling
    const org = orgsRepo.findById(event.organization_id);
    let themeConfig = null;
    if (org) {
      try {
        const settings = typeof org.settings === "string" ? JSON.parse(org.settings) : org.settings;
        themeConfig = settings?.platformConfig?.theme ?? null;
      } catch {}
    }
    // Include layout for the map viewer
    const layouts = layoutsRepo.listForOrg(event.organization_id, { eventId });
    const layoutPayload = layouts.length > 0 ? (typeof layouts[0].payload === "string" ? JSON.parse(layouts[0].payload) : layouts[0].payload) : null;
    return {
      event: {
        id: event.id, title: event.title,
        startDate: event.start_date, endDate: event.end_date,
      },
      portalEnabled: !!cfg?.enabled,
      requiresPassword,
      guests: guestList,
      layout: layoutPayload,
      theme: themeConfig,
    };
  });

  app.post('/api/portal/:eventId/verify-password', async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const { password } = (req.body ?? {}) as { password?: string };
    const cfg = portalConfigRepo.getForEvent(eventId) as { password_hash: string | null; password_salt: string | null } | undefined;
    if (!cfg?.password_hash || !cfg.password_salt) return { ok: true }; // no password set
    if (!password) return reply.code(401).send({ ok: false });
    const ok = verifyPassword(password, {
      passwordHash: cfg.password_hash, passwordSalt: cfg.password_salt,
    });
    return reply.code(ok ? 200 : 401).send({ ok });
  });

  app.post('/api/portal/:eventId/rsvp', async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const parsed = rsvpSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

    if (parsed.data.guestId) {
      const g = guestsRepo.findById(parsed.data.guestId);
      if (!g || g.event_id !== eventId) throw BadRequest('guest-not-in-event');
      if (!g.allow_portal_access) throw new (await import('../lib/errors.js')).HttpError(403, 'portal-access-revoked');
    }

    const rsvpId = rsvpRepo.submit({
      organizationId: event.organization_id, eventId,
      guestId: parsed.data.guestId,
      attending: parsed.data.attending,
      attendingDays: parsed.data.attendingDays,
      mealChoice: parsed.data.mealChoice,
      plusOneName: parsed.data.plusOneName,
      plusOneMealChoice: parsed.data.plusOneMealChoice,
      dietaryNotes: parsed.data.dietaryNotes,
      specialNeeds: parsed.data.specialNeeds,
      notes: parsed.data.notes,
      ip: req.ip, userAgent: req.headers['user-agent'],
    });
    auditRepo.log({
      organizationId: event.organization_id, action: 'rsvp.submit',
      targetType: 'rsvp', targetId: rsvpId, ip: req.ip, userAgent: req.headers['user-agent'],
    });
    broadcastSSE(event.organization_id, "rsvp.submitted", { rsvpId, eventId, attending: parsed.data.attending });
    return reply.code(201).send({ ok: true, rsvpId });
  });
}
