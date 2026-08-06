import { auditRepo, eventsRepo, guestsRepo } from '../../db/repos/index.js';
import { db } from '../../db/database.js';
import { appPublicBaseUrl } from '../../lib/appBaseUrl.js';
import { requireAuth } from '../../middleware/auth.js';
import { can } from '../../lib/rbac.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import { toCsv } from '../../lib/csv.js';
import type { FastifyInstance } from 'fastify';
import { canWriteCoupleData, coupleGuestSchema, coupleSeatingSchema, importPreviewSchema, parseCsvLine, safeGuest } from './shared.js';

export async function coupleGuestsRoutes(app: FastifyInstance) {
  app.patch('/api/events/:eventId/couple-guests/:guestId/seating', { preHandler: requireAuth }, async (req) => {
    const { eventId, guestId } = req.params as { eventId: string; guestId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!canWriteCoupleData(req.auth!.memberships, eventId, orgMap)) throw Forbidden();
    const guest = guestsRepo.findById(guestId);
    if (!guest || guest.event_id !== eventId) throw NotFound('guest-not-found');
    const parsed = coupleSeatingSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = guestsRepo.update(guestId, { tableAssignment: parsed.data.tableAssignment ?? undefined, seatAssignment: parsed.data.seatAssignment ?? undefined });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.seating.update', targetType: 'guest', targetId: guestId, ip: req.ip, details: { eventId, tableAssignment: parsed.data.tableAssignment, seatAssignment: parsed.data.seatAssignment, note: parsed.data.note } });
    return { guest: updated ? safeGuest(updated) : null };
  });

  app.get('/api/events/:eventId/couple-layout/seating.csv', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const headers = ['Guest','Household','Table','Seat','Tags','Accessibility'];
    const rows = guestsRepo.listForEvent(eventId).map(safeGuest).map((g) => [g.fullName, g.householdName, g.tableAssignment ?? '', g.seatAssignment ?? '', g.tags.join('|'), g.accessibilityNotes ?? '']);
    const csv = toCsv([headers, ...rows]);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="couple_seating_chart_${eventId}.csv"`);
    return reply.send(csv);
  });

  app.get('/api/events/:eventId/couple-layout/place-cards.txt', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const text = guestsRepo.listForEvent(eventId).map(safeGuest).map((g) => `${g.fullName}\nTable: ${g.tableAssignment || 'TBD'}${g.seatAssignment ? ` · Seat: ${g.seatAssignment}` : ''}\n`).join('\n---\n');
    reply.header('Content-Type', 'text/plain');
    reply.header('Content-Disposition', `attachment; filename="place_cards_${eventId}.txt"`);
    return reply.send(text);
  });

  app.post('/api/events/:eventId/couple-guests/:guestId/portal-link', { preHandler: requireAuth }, async (req) => {
    const { eventId, guestId } = req.params as { eventId: string; guestId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const guest = guestsRepo.findById(guestId);
    if (!guest || guest.event_id !== eventId) throw NotFound('guest-not-found');
    const token = guestsRepo.rotatePortalToken(guestId);
    guestsRepo.update(guestId, { allowPortalAccess: true });
    const baseUrl = appPublicBaseUrl();
    const url = `${baseUrl}/#/portal/${eventId}?guest=${encodeURIComponent(guestId)}&token=${encodeURIComponent(token)}`;
    return { url, token, qrPayload: `WVI-GUEST:${eventId}:${guestId}:${token.slice(0, 10)}` };
  });

  app.get('/api/events/:eventId/couple-guests', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const guests = guestsRepo.listForEvent(eventId).map(safeGuest);
    // Late-submission flag from the guest's LATEST RSVP submission (venue
    // needs to know when a headcount arrived after the RSVP deadline).
    const lateMap = new Map<string, boolean>();
    for (const row of db.prepare(`SELECT guest_id, late_submission FROM rsvp_submissions WHERE event_id = ? AND late_submission = 1`).all(eventId) as Array<{ guest_id: string | null; late_submission: number }>) {
      if (row.guest_id) lateMap.set(row.guest_id, true);
    }
    for (const guest of guests) {
      if (lateMap.has(guest.id)) (guest as any).lateSubmission = true;
    }
    const counts = guestsRepo.countByStatus(eventId);
    const householdMap = new Map<string, typeof guests>();
    for (const guest of guests) {
      const key = guest.householdName || guest.partyName || guest.fullName;
      householdMap.set(key, [...(householdMap.get(key) ?? []), guest]);
    }
    const duplicateSuggestions = Array.from(new Map(guests.filter((g) => g.email).map((g) => [String(g.email).toLowerCase(), guests.filter((x) => x.email && String(x.email).toLowerCase() === String(g.email).toLowerCase())])).entries())
      .filter(([, matches]) => matches.length > 1)
      .map(([email, matches]) => ({ signal: 'email', value: email, guests: matches.map((g) => ({ id: g.id, fullName: g.fullName })) }));
    return {
      guests,
      counts,
      households: Array.from(householdMap.entries()).map(([name, members]) => ({ name, members, count: members.length })),
      filters: {
        missingAddress: guests.filter((g) => !g.mailingAddress).length,
        missingEmail: guests.filter((g) => !g.email).length,
        notInvitedYet: guests.filter((g) => !g.allowPortalAccess).length,
        notResponded: guests.filter((g) => g.rsvpStatus === 'pending').length,
        needsFollowUp: guests.filter((g) => g.rsvpStatus === 'pending' || !g.email || !g.mailingAddress).length,
      },
      duplicateSuggestions,
      privacy: {
        dietaryRestrictions: 'Visible to the couple and venue planning team. Share with catering only when needed for service.',
        accessibilityNotes: 'Visible to the couple and venue planning team. Share with event-day staff only for guest care.',
        coupleNotes: 'Internal couple/venue planning note. Not shown to public guests by default.',
      },
    };
  });

  app.post('/api/events/:eventId/couple-guests', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = coupleGuestSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = { mailingAddress: parsed.data.mailingAddress, mealChoice: parsed.data.mealChoice, coupleNotes: parsed.data.notes, coupleGuestTags: parsed.data.tags ?? [], householdName: parsed.data.householdName || parsed.data.partyName };
    const guest = guestsRepo.create(event.organization_id, eventId, {
      fullName: parsed.data.fullName,
      email: parsed.data.email || undefined,
      phone: parsed.data.phone,
      partyName: parsed.data.householdName || parsed.data.partyName,
      rsvpStatus: parsed.data.rsvpStatus,
      dietaryRestrictions: parsed.data.dietaryRestrictions,
      accessibilityNotes: parsed.data.accessibilityNotes,
      plusOneAllowed: parsed.data.plusOneAllowed,
      metadata,
    });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.guest.create', targetType: 'guest', targetId: guest.id, ip: req.ip, details: { eventId } });
    return reply.code(201).send({ guest: safeGuest(guest) });
  });

  app.patch('/api/events/:eventId/couple-guests/:guestId', { preHandler: requireAuth }, async (req) => {
    const { eventId, guestId } = req.params as { eventId: string; guestId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const current = guestsRepo.findById(guestId);
    if (!current || current.event_id !== eventId) throw NotFound('guest-not-found');
    const parsed = coupleGuestSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const currentMeta = (() => { try { return JSON.parse(current.metadata || '{}'); } catch { return {}; } })();
    const metadata = { ...currentMeta, mailingAddress: parsed.data.mailingAddress ?? currentMeta.mailingAddress, mealChoice: parsed.data.mealChoice ?? currentMeta.mealChoice, coupleNotes: parsed.data.notes ?? currentMeta.coupleNotes, coupleGuestTags: parsed.data.tags ?? currentMeta.coupleGuestTags ?? [], householdName: parsed.data.householdName ?? currentMeta.householdName };
    const updated = guestsRepo.update(guestId, {
      fullName: parsed.data.fullName,
      email: parsed.data.email || undefined,
      phone: parsed.data.phone,
      partyName: parsed.data.householdName || parsed.data.partyName,
      rsvpStatus: parsed.data.rsvpStatus,
      dietaryRestrictions: parsed.data.dietaryRestrictions,
      accessibilityNotes: parsed.data.accessibilityNotes,
      plusOneAllowed: parsed.data.plusOneAllowed,
      metadata,
    });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.guest.update', targetType: 'guest', targetId: guestId, ip: req.ip, details: { eventId } });
    return { guest: updated ? safeGuest(updated) : null };
  });

  app.post('/api/events/:eventId/couple-guests/import-preview', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = importPreviewSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const lines = parsed.data.csv.trim().split(/\r?\n/).filter(Boolean);
    const headers = parseCsvLine(lines[0] || '').map((h) => h.toLowerCase().replace(/\s+/g, ''));
    const rows = lines.slice(1).map(parseCsvLine);
    const existing = guestsRepo.listForEvent(eventId).map(safeGuest);
    const warnings: string[] = [];
    const required = ['fullname'];
    for (const field of required) if (!headers.includes(field)) warnings.push(`Missing required column: ${field}`);
    if (!headers.includes('email')) warnings.push('Email column is recommended for RSVP reminders.');
    if (!headers.includes('mailingaddress')) warnings.push('Mailing address column is recommended for invitations/save-the-dates.');
    const seenNames = new Set<string>();
    const duplicates: string[] = [];
    const existingEmails = new Set(existing.map((g) => String(g.email || '').toLowerCase()).filter(Boolean));
    const existingNames = new Set(existing.map((g) => g.fullName.toLowerCase()));
    rows.forEach((row) => {
      const name = row[headers.indexOf('fullname')]?.toLowerCase();
      const email = row[headers.indexOf('email')]?.toLowerCase();
      if (name && seenNames.has(name)) duplicates.push(name);
      if (name) seenNames.add(name);
      if (email && existingEmails.has(email)) duplicates.push(email);
      // Fallback key for rows without an email (matches the import route).
      if (!email && name && existingNames.has(name)) duplicates.push(name);
    });
    return { rowCount: rows.length, headers, warnings, duplicateSignals: Array.from(new Set(duplicates)).slice(0, 25), householdSuggestions: rows.map((row) => row[headers.indexOf('householdname')] || row[headers.indexOf('partyname')]).filter(Boolean).slice(0, 25), willSave: false };
  });

  // ─── Bulk guest import (the other half of import-preview) ───────────
  // The preview endpoint analyzes a CSV but never saves; this endpoint
  // performs the actual import with the same parsing + dedupe rules, so a
  // couple can paste their spreadsheet and get real guests out of it.
  app.post('/api/events/:eventId/couple-guests/import', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = importPreviewSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const lines = parsed.data.csv.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length > 2001) throw BadRequest('too-many-rows', 'Import is limited to 2,000 guest rows.');
    const headers = lines[0] ? parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, '')) : [];
    const rows = lines.slice(1).map(parseCsvLine);
    const nameIdx = headers.indexOf('fullname');
    if (nameIdx === -1) throw BadRequest('missing-fullname-column', 'The CSV needs a "Full Name" column.');
    const emailIdx = headers.indexOf('email');
    const phoneIdx = headers.indexOf('phone');
    const householdIdx = Math.max(headers.indexOf('householdname'), headers.indexOf('partyname'));
    const addressIdx = headers.indexOf('mailingaddress');
    const rsvpIdx = headers.indexOf('rsvpstatus');
    const mealIdx = headers.indexOf('mealchoice');
    const tagsIdx = headers.indexOf('tags');
    const dietaryIdx = headers.indexOf('dietaryrestrictions');
    const accessibilityIdx = headers.indexOf('accessibilitynotes');

    const existing = guestsRepo.listForEvent(eventId);
    const existingEmails = new Set(existing.map((g) => String(g.email || '').toLowerCase()).filter(Boolean));
    // Name is the FALLBACK dedupe key for rows without an email (many
    // guests — grandparents, kids — have no email; re-importing a fixed
    // spreadsheet must not duplicate them). Rows WITH an email are keyed by
    // email only: two guests with the same name but different emails are
    // legitimately different people and must both import.
    const existingNames = new Set(existing.map((g) => g.full_name.toLowerCase()));
    const VALID_RSVP = new Set(['pending', 'attending', 'declined', 'maybe']);
    const warnings: string[] = [];
    const duplicates: string[] = [];
    let skipped = 0;
    const seenNames = new Set<string>();
    const inputs: Parameters<typeof guestsRepo.create>[2][] = [];

    for (const row of rows) {
      const cell = (idx: number) => (idx >= 0 && idx < row.length ? row[idx] : '');
      const fullName = cell(nameIdx).trim();
      const email = cell(emailIdx).trim().toLowerCase();
      if (!fullName) { skipped += 1; continue; }
      if (email && existingEmails.has(email)) { skipped += 1; duplicates.push(email); continue; }
      const nameKey = fullName.toLowerCase();
      if (!email && existingNames.has(nameKey)) { skipped += 1; duplicates.push(fullName); continue; }
      if (seenNames.has(nameKey)) { skipped += 1; duplicates.push(fullName); continue; }
      seenNames.add(nameKey);
      let rsvpStatus = cell(rsvpIdx).trim().toLowerCase() || 'pending';
      if (!VALID_RSVP.has(rsvpStatus)) {
        warnings.push(`Row "${fullName}": invalid RSVP status "${rsvpStatus}" — set to pending.`);
        rsvpStatus = 'pending';
      }
      const householdName = cell(householdIdx).trim();
      inputs.push({
        fullName,
        email: email || undefined,
        phone: cell(phoneIdx).trim() || undefined,
        partyName: householdName || undefined,
        rsvpStatus: rsvpStatus as 'pending' | 'attending' | 'declined' | 'maybe',
        dietaryRestrictions: cell(dietaryIdx).trim() || undefined,
        accessibilityNotes: cell(accessibilityIdx).trim() || undefined,
        metadata: {
          mailingAddress: cell(addressIdx),
          mealChoice: cell(mealIdx),
          householdName,
          coupleGuestTags: cell(tagsIdx).split('|').map((t) => t.trim()).filter(Boolean),
        },
      });
    }
    if (!headers.includes('email')) warnings.push('Email column is recommended for RSVP reminders.');
    // Transactional insert; 'skip' mode double-guards against emails that
    // arrived between the pre-check and the write.
    const result = guestsRepo.bulkCreate(event.organization_id, eventId, 'skip', inputs);
    const imported = result.inserted;
    skipped += result.skipped;
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'couple.guest.import', targetType: 'event', targetId: eventId, ip: req.ip, details: { imported, skipped, rows: rows.length } });
    return reply.code(201).send({ imported, skipped, warnings, duplicateSignals: Array.from(new Set(duplicates)).slice(0, 25) });
  });

  app.get('/api/events/:eventId/couple-guests/export.csv', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const guests = guestsRepo.listForEvent(eventId).map(safeGuest);
    const headers = ['Full Name','Email','Phone','Household','Mailing Address','RSVP','Meal Choice','Dietary','Accessibility','Tags','Table','Seat','Room'];
    const rows = guests.map((g) => [g.fullName, g.email ?? '', g.phone ?? '', g.householdName, g.mailingAddress, g.rsvpStatus, g.mealChoice, g.dietaryRestrictions ?? '', g.accessibilityNotes ?? '', g.tags.join('|'), g.tableAssignment ?? '', g.seatAssignment ?? '', g.roomAssignment ?? '']);
    const csv = toCsv([headers, ...rows]);
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="couple_guest_list_${eventId}.csv"`);
    return reply.send(csv);
  });

}
