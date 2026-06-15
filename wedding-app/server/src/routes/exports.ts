import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { guestsRepo, vendorsRepo, eventsRepo, timelineRepo, staffTasksRepo, layoutsRepo } from '../db/repos/index.js';
import { budgetRepo } from '../db/repos/budget.js';
import { Forbidden } from '../lib/errors.js';
import { buildOperationsPacketManifest, buildOperationsPacketZip, type OperationsPacketData } from '../lib/operationsPacket.js';

function collectOperationsPacketData(eventId: string): OperationsPacketData {
  const event = eventsRepo.findById(eventId);
  if (!event) throw Forbidden();
  const guests = guestsRepo.listForEvent(eventId);
  const vendors = vendorsRepo.listForOrg(event.organization_id, { eventId });
  const timeline = timelineRepo.listForEvent(eventId);
  const staffTasks = staffTasksRepo.listForOrg(event.organization_id, { eventId });
  const layouts = layoutsRepo.listForOrg(event.organization_id, { eventId });
  return { exportedAt: new Date().toISOString(), event: event as unknown as Record<string, any>, guests, vendors, timeline, staffTasks, layouts };
}

export async function exportRoutes(app: FastifyInstance) {
  // ─── Export all guests as CSV ─────────────────────────
  app.get('/api/orgs/:orgId/export/guests.csv', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'guests.export')) throw Forbidden();

    const { guests } = guestsRepo.listForOrg(orgId, { limit: 10000 });
    const headers = ['Name', 'Email', 'Phone', 'Party', 'RSVP', 'Table', 'Dietary', 'Event'];
    const rows = guests.map(g => [
      g.full_name, g.email ?? '', g.phone ?? '', g.party_name ?? '',
      g.rsvp_status, g.table_assignment ?? '', g.dietary_restrictions ?? '',
      (g as any).event_title ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="guests_export.csv"');
    return reply.send(csv);
  });

  // ─── Export all vendors as CSV ────────────────────────
  app.get('/api/orgs/:orgId/export/vendors.csv', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'vendors.view')) throw Forbidden();

    const vendors = vendorsRepo.listForOrg(orgId);
    const headers = ['Name', 'Category', 'Contact', 'Email', 'Phone', 'Contract', 'Paid', 'Balance'];
    const rows = vendors.map(v => [
      v.name, v.category, v.contact_name ?? '', v.email ?? '', v.phone ?? '',
      ((v.contract_amount_cents ?? 0) / 100).toFixed(2),
      (v.amount_paid_cents / 100).toFixed(2),
      (((v.contract_amount_cents ?? 0) - v.amount_paid_cents) / 100).toFixed(2),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', 'attachment; filename="vendors_export.csv"');
    return reply.send(csv);
  });

  // ─── Export financials as JSON ────────────────────────
  app.get('/api/orgs/:orgId/export/financials.json', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'budget.view')) throw Forbidden();

    const events = eventsRepo.listForOrg(orgId);
    const data = events.map(e => ({
      event: { id: e.id, title: e.title, status: e.status, startDate: e.start_date, budgetCents: e.budget_cents },
      budgetItems: budgetRepo.listForEvent(e.id),
      budgetTotals: budgetRepo.totalsForEvent(e.id),
      vendors: vendorsRepo.listForOrg(orgId, { eventId: e.id }).map(v => ({
        name: v.name, category: v.category,
        contractCents: v.contract_amount_cents, paidCents: v.amount_paid_cents,
      })),
    }));

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', 'attachment; filename="financials_export.json"');
    return reply.send(JSON.stringify({ exportedAt: new Date().toISOString(), events: data }, null, 2));
  });

  // ─── Event day-of operations packet (JSON) ───────────
  app.get('/api/events/:eventId/export/day-of-packet.json', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw Forbidden();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();

    const packetData = collectOperationsPacketData(eventId);
    const { guests, vendors, timeline, staffTasks, layouts } = packetData;
    const packet = {
      exportedAt: packetData.exportedAt,
      type: 'event_day_operations_packet',
      event,
      summary: {
        guestCount: guests.length,
        vendorCount: vendors.length,
        timelineItems: timeline.length,
        staffTasks: staffTasks.length,
        layouts: layouts.length,
      },
      guests: guests.map(g => ({ name: g.full_name, rsvp: g.rsvp_status, phone: g.phone, table: g.table_assignment, room: g.room_assignment, dietary: g.dietary_restrictions, accessibility: g.accessibility_notes })),
      vendors: vendors.map(v => ({ name: v.name, category: v.category, contact: v.contact_name, phone: v.phone, email: v.email, notes: v.notes, metadata: v.metadata })),
      timeline,
      staffTasks,
      layouts: layouts.map(l => ({ id: l.id, name: l.name, status: l.approval_status, revision: l.revision, updatedAt: l.updated_at })),
    };
    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="event_day_packet_${eventId}_${new Date().toISOString().slice(0,10)}.json"`);
    return reply.send(JSON.stringify(packet, null, 2));
  });

  // ─── Branded BEO / operations packet (PDF in ZIP) ─────
  app.get('/api/events/:eventId/export/operations-packet.zip', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw Forbidden();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();

    const packetData = collectOperationsPacketData(eventId);
    const zip = buildOperationsPacketZip(packetData);
    const manifest = buildOperationsPacketManifest(packetData);
    const filenameSafeTitle = String(manifest.event.title || 'event').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'event';
    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Length', String(zip.length));
    reply.header('X-Operations-Packet-Type', manifest.type);
    reply.header('Content-Disposition', `attachment; filename="${filenameSafeTitle}_operations_packet_${new Date().toISOString().slice(0,10)}.zip"`);
    return reply.send(zip);
  });

  // ─── Full org data backup (JSON) ──────────────────────
  app.get('/api/orgs/:orgId/export/backup.json', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'org.manage')) throw Forbidden();

    const events = eventsRepo.listForOrg(orgId);
    // Bulk queries — single SQL each, no N+1
    const { guests: allGuestsRaw } = guestsRepo.listForOrg(orgId, { limit: 100000 });
    const allGuests = allGuestsRaw;
    const allBudget = budgetRepo.listForOrg(orgId);

    const vendors = vendorsRepo.listForOrg(orgId);

    const backup = {
      exportedAt: new Date().toISOString(),
      schemaVersion: 7,
      organization: { id: orgId },
      events: events.map(e => ({
        ...e,
        budgetTotals: budgetRepo.totalsForEvent(e.id),
      })),
      guests: allGuests,
      vendors,
      budgetItems: allBudget,
      summary: {
        eventCount: events.length,
        guestCount: allGuests.length,
        vendorCount: vendors.length,
        budgetItemCount: allBudget.length,
      },
    };

    reply.header('Content-Type', 'application/json');
    reply.header('Content-Disposition', `attachment; filename="backup_${orgId}_${new Date().toISOString().slice(0,10)}.json"`);
    return reply.send(JSON.stringify(backup, null, 2));
  });

  // ─── iCal Export (.ics) ───────────────────────────────
  app.get('/api/events/:eventId/export.ics', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw Forbidden();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();

    const start = event.start_date ? event.start_date.replace(/-/g, '') : '';
    const end = event.end_date ? event.end_date.replace(/-/g, '') : start;
    const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Wedding Venue Intelligence//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${event.id}@wvi`,
      `DTSTAMP:${now}`,
      start ? `DTSTART;VALUE=DATE:${start}` : '',
      end ? `DTEND;VALUE=DATE:${end}` : '',
      `SUMMARY:${event.title.replace(/[,;\\]/g, ' ')}`,
      `DESCRIPTION:${event.guest_count} guests · Budget $${((event.budget_cents ?? 0) / 100).toLocaleString()}`,
      event.status ? `STATUS:${event.status === 'completed' ? 'COMPLETED' : 'CONFIRMED'}` : '',
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    reply.header('Content-Type', 'text/calendar; charset=utf-8');
    reply.header('Content-Disposition', `attachment; filename="${event.title.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`);
    return reply.send(ics);
  });
}
