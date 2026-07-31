import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { venuesRepo, layoutsRepo, auditRepo, catalogRepo, eventsRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import { saveDataUri, savePublicDocumentDataUri } from '../lib/fileStorage.js';
import { db } from '../db/database.js';

const venueSchema = z.object({
  name:          z.string().min(1).max(200),
  category:      z.string().max(40).optional(),
  environment:   z.enum(['indoor','outdoor','both']).optional(),
  description:   z.string().max(4000).optional(),
  capacity:      z.number().int().min(0).optional(),
  width:         z.number().min(0).optional(),
  height:        z.number().min(0).optional(),
  canvasWidth:   z.number().min(0).optional(),
  canvasHeight:  z.number().min(0).optional(),
  shape:         z.record(z.unknown()).optional(),
  style:         z.record(z.unknown()).optional(),
  masterLayout:  z.record(z.unknown()).optional(),
  metadata:      z.record(z.unknown()).optional(),
  unitSystem:    z.enum(['imperial','metric']).optional(),
  templateKey:   z.enum(['custom','ceremony','cocktail','reception','outdoor_tent']).optional(),
  approvalStatus:z.enum(['draft','approved','archived']).optional(),
  underlay:      z.record(z.unknown()).optional(),
});

export async function venueRoutes(app: FastifyInstance) {
  app.get('/api/events/:eventId/venue-templates', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId); if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const approvedVenues = venuesRepo.listForOrg(event.organization_id).filter((venue) => venue.approval_status === 'approved');
    const approvedVenueIds = new Set(approvedVenues.map((venue) => venue.id));
    const templates = catalogRepo.listForOrg(event.organization_id, 'template').filter((item: any) => {
      if (!item.visible) return false;
      const spec = typeof item.spec === 'string' ? (() => { try { return JSON.parse(item.spec); } catch { return {}; } })() : (item.spec || {});
      return typeof spec.venueId === 'string' && approvedVenueIds.has(spec.venueId);
    }).map((item: any) => ({ id: item.id, name: item.name, spec: item.spec }));
    const spaces = approvedVenues.map((venue) => ({ id: venue.id, name: venue.name, category: venue.category, capacity: venue.capacity, templateKey: venue.template_key }));
    return { templates, spaces, guestCount: event.guest_count };
  });

  app.post('/api/events/:eventId/venue-templates/:templateId/apply', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId, templateId } = req.params as { eventId: string; templateId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId); if (!can(req.auth!.memberships, { eventId }, 'layouts.create', orgMap)) throw Forbidden();
    const template = catalogRepo.findById(templateId) as any; if (!template || (template.organizationId ?? template.organization_id) !== event.organization_id || template.kind !== 'template' || !template.visible) throw NotFound('venue-template-not-found');
    let spec: any = {}; try { spec = typeof template.spec === 'string' ? JSON.parse(template.spec || '{}') : (template.spec || {}); } catch {}
    const venue = spec.venueId ? venuesRepo.findById(spec.venueId) : venuesRepo.listForOrg(event.organization_id).find((item) => item.approval_status === 'approved');
    if (!venue || venue.approval_status !== 'approved') throw BadRequest('approved-venue-space-required');
    const scaffold = (() => { try { return JSON.parse(venue.master_layout || '{}'); } catch { return {}; } })();
    const minGuests = Number(spec.minGuests ?? 0); const maxGuests = Number(spec.maxGuests ?? Infinity);
    const capacityWarning = event.guest_count > 0 && (event.guest_count < minGuests || event.guest_count > maxGuests);
    const payload = { ...scaffold, ...(spec.payload || spec.masterLayout || {}), venueScaffoldId: venue.id, venueRevision: venue.revision, templateId: template.id, templateName: template.name, serviceStyle: spec.serviceStyle || null, allowedObjectCategories: spec.allowedObjectCategories || null, allowedInventoryItemIds: spec.allowedInventoryItemIds || null, templateCapacityWarning: capacityWarning ? { guestCount: event.guest_count, minGuests, maxGuests } : null };
    const layout = layoutsRepo.create({ organizationId: event.organization_id, eventId, venueId: venue.id, name: `${template.name} proposal`, visibility: 'event', payload, createdBy: req.auth!.userId });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'venue.template.apply', targetType: 'layout', targetId: layout.id, ip: req.ip, details: { eventId, templateId, venueId: venue.id, capacityWarning } });
    return reply.code(201).send({ layout });
  });

  app.get('/api/orgs/:orgId/space-calendar', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string }; if (!can(req.auth!.memberships, { organizationId: orgId }, 'venues.view')) throw Forbidden();
    const { startsAt, endsAt } = req.query as { startsAt?: string; endsAt?: string }; const start = startsAt || new Date().toISOString().slice(0, 10); const end = endsAt || new Date(Date.now() + 31 * 86400000).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) throw BadRequest('invalid-calendar-range');
    const spaces = venuesRepo.listForOrg(orgId).filter((venue) => venue.approval_status === 'approved').map((venue) => ({ id: venue.id, name: venue.name, capacity: venue.capacity, category: venue.category }));
    const commitments = db.prepare(`SELECT e.id, e.title, e.status, e.start_date, e.end_date, e.guest_count, e.venue_id, v.name AS venue_name, v.capacity AS venue_capacity FROM events e LEFT JOIN venues v ON v.id=e.venue_id WHERE e.organization_id=? AND e.deleted_at IS NULL AND e.start_date <= ? AND COALESCE(e.end_date, e.start_date) >= ? ORDER BY e.start_date`).all(orgId, end, start);
    return { calendar: { startsAt: start, endsAt: end, spaces, commitments } };
  });

  app.get('/api/orgs/:orgId/venues', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'venues.view')) throw Forbidden();
    return { venues: venuesRepo.listForOrg(orgId) };
  });

  app.post('/api/orgs/:orgId/venues', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'venues.manage')) throw Forbidden();
    const parsed = venueSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const venue = venuesRepo.create(orgId, req.auth!.userId, parsed.data);
    auditRepo.log({
      organizationId: orgId, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'venue.create', targetType: 'venue', targetId: venue.id, ip: req.ip,
    });
    return reply.code(201).send({ venue });
  });

  app.patch('/api/venues/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const venue = venuesRepo.findById(id);
    if (!venue) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: venue.organization_id }, 'venues.manage')) throw Forbidden();
    const parsed = venueSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    if (parsed.data.approvalStatus === 'approved') {
      const masterLayout = (() => { try { return JSON.parse(venue.master_layout || '{}'); } catch { return {}; } })() as { zones?: Array<{ type?: string }> };
      const zoneTypes = new Set((masterLayout.zones || []).map((zone) => zone.type));
      const missing = ['exit', 'accessible_route', 'power', 'loading'].filter((type) => !zoneTypes.has(type));
      const overrideReason = typeof parsed.data.metadata?.approvalOverrideReason === 'string' ? parsed.data.metadata.approvalOverrideReason.trim() : '';
      if (missing.length && !overrideReason) throw BadRequest('venue-readiness-override-required', { missing });
    }
    return { venue: venuesRepo.update(id, parsed.data) };
  });

  app.get('/api/venues/:id/space-detail', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string }; const venue = venuesRepo.findById(id); if (!venue) throw NotFound(); if (!can(req.auth!.memberships, { organizationId: venue.organization_id }, 'venues.view')) throw Forbidden();
    const commitments = db.prepare(`SELECT id, title, status, start_date, end_date, guest_count FROM events WHERE venue_id=? AND deleted_at IS NULL AND start_date >= date('now') ORDER BY start_date LIMIT 20`).all(id);
    const templates = catalogRepo.listForOrg(venue.organization_id, 'template').filter((template: any) => { const spec = typeof template.spec === 'string' ? (() => { try { return JSON.parse(template.spec); } catch { return {}; } })() : (template.spec || {}); return spec.venueId === id; }).map((template: any) => ({ id: template.id, name: template.name, visible: template.visible, spec: template.spec }));
    return { space: { id: venue.id, name: venue.name, capacity: venue.capacity, approvalStatus: venue.approval_status, commitments, templates } };
  });

  app.get('/api/venues/:id/scaffold/versions', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string }; const venue = venuesRepo.findById(id);
    if (!venue) throw NotFound(); if (!can(req.auth!.memberships, { organizationId: venue.organization_id }, 'venues.view')) throw Forbidden();
    return { versions: db.prepare(`SELECT * FROM venue_space_versions WHERE venue_id = ? ORDER BY revision DESC`).all(id) };
  });

  app.post('/api/venues/:id/scaffold/save', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string }; const venue = venuesRepo.findById(id);
    if (!venue) throw NotFound(); if (!can(req.auth!.memberships, { organizationId: venue.organization_id }, 'venues.manage')) throw Forbidden();
    const parsed = z.object({ masterLayout: z.record(z.unknown()), canvasWidth: z.number().positive().optional(), canvasHeight: z.number().positive().optional(), description: z.string().max(1000).optional() }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = venuesRepo.saveScaffoldRevision(id, { ...parsed.data, userId: req.auth!.userId });
    return { venue: updated };
  });

  app.post('/api/venues/:id/underlay', { preHandler: requireAuth, bodyLimit: 24 * 1024 * 1024 }, async (req) => {
    const { id } = req.params as { id: string };
    const venue = venuesRepo.findById(id);
    if (!venue) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: venue.organization_id }, 'venues.manage')) throw Forbidden();
    const body = req.body as { dataUri?: unknown; sourceDataUri?: unknown; sourceName?: unknown };
    const dataUri = body?.dataUri;
    if (typeof dataUri !== 'string') throw BadRequest('underlay-required');
    const sourceDataUri = body?.sourceDataUri;
    if (sourceDataUri !== undefined && typeof sourceDataUri !== 'string') throw BadRequest('invalid-underlay-source');
    const sourceName = typeof body?.sourceName === 'string' ? body.sourceName.slice(0, 240) : undefined;
    const isPdf = typeof sourceDataUri === 'string'
      ? sourceDataUri.startsWith('data:application/pdf;')
      : dataUri.startsWith('data:application/pdf;');
    if (sourceDataUri && !sourceDataUri.startsWith('data:application/pdf;')) throw BadRequest('invalid-underlay-source');
    // PDFs have a PNG preview for canvas tracing while retaining the original plan for download.
    const url = saveDataUri(dataUri, `venue_underlay_${id}`);
    const sourceUrl = sourceDataUri ? savePublicDocumentDataUri(sourceDataUri, `venue_underlay_source_${id}`) : (isPdf ? savePublicDocumentDataUri(dataUri, `venue_underlay_source_${id}`) : undefined);
    const current = (() => { try { return JSON.parse(venue.underlay || '{}'); } catch { return {}; } })();
    const updated = venuesRepo.update(id, { underlay: { ...current, url, kind: isPdf ? 'pdf' : 'image', ...(sourceUrl ? { sourceUrl, sourceName: sourceName || 'venue-reference.pdf', sourceKind: 'pdf' } : {}), locked: true, opacity: 0.55, scale: 1, rotation: 0 } });
    return { venue: updated };
  });

  app.post('/api/venues/:id/event-layouts', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const venue = venuesRepo.findById(id);
    if (!venue) throw NotFound();
    if (venue.approval_status !== 'approved') throw BadRequest('venue-scaffold-not-approved');
    if (!can(req.auth!.memberships, { organizationId: venue.organization_id }, 'layouts.create')) throw Forbidden();
    const parsed = z.object({ eventId: z.string().min(1), name: z.string().min(1).max(200).optional() }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const masterLayout = (() => { try { return JSON.parse(venue.master_layout || '{}'); } catch { return {}; } })();
    const layout = layoutsRepo.create({ organizationId: venue.organization_id, eventId: parsed.data.eventId, venueId: venue.id, name: parsed.data.name ?? `${venue.name} event layout`, visibility: 'event', payload: { ...masterLayout, venueScaffoldId: venue.id, venueRevision: venue.revision }, createdBy: req.auth!.userId });
    auditRepo.log({ organizationId: venue.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'venue.scaffold.instantiate', targetType: 'layout', targetId: layout.id, ip: req.ip, details: { venueId: venue.id, eventId: parsed.data.eventId, venueRevision: venue.revision } });
    return reply.code(201).send({ layout });
  });

  app.delete('/api/venues/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const venue = venuesRepo.findById(id);
    if (!venue) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: venue.organization_id }, 'venues.manage')) throw Forbidden();
    venuesRepo.softDelete(id);
    return reply.code(204).send();
  });
}
