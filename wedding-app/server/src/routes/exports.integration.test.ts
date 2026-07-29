import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { inflateRawSync } from 'node:zlib';
import { guestsRepo, layoutsRepo, rolesRepo } from '../db/repos/index.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'invite_tracking','vendor_checkins','gallery_images','inventory_items','contracts',
    'budget_items','webhook_deliveries','webhooks','push_subscriptions','sse_events',
    'audit_logs','direct_messages','event_answers','event_questions',
    'staff_shifts','staff_areas','staff_tasks','timeline_events',
    'vendor_payments','vendors','decor_packages','decor_arrangements',
    'decor_categories','decor_items','guest_portal_configs','rsvp_submissions',
    'guest_sub_event_invitations','guests','layout_versions','layouts',
    'catalog_items','venues','sub_events','event_memberships','events',
    'organization_memberships','organizations','users',
  ]) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch {} }
  try { db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run(); db.prepare(`DELETE FROM roles WHERE is_system = 0`).run(); } catch {}
  rolesRepo.ensureSystemRoles();
});

async function setup() {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: `exp-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'O', orgName: 'O' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token, orgId = r.json().organizationId, userId = r.json().user.id;
  // Create event + guest + vendor
  const e = await app.inject({ method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Export Test' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const eventId = e.json().event.id;
  guestsRepo.create(orgId, eventId, { fullName: 'Alice', email: 'alice@test.com', rsvpStatus: 'attending' });
  await app.inject({ method: 'POST', url: `/api/orgs/${orgId}/vendors`,
    payload: { name: 'DJ Test', category: 'music', contactName: 'Dee Jay', phone: '555-0112', contractAmountCents: 100000, eventId, metadata: { arrivalTime: '14:00', loadInRoute: 'Dock A' } },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  layoutsRepo.create({
    organizationId: orgId,
    eventId,
    name: 'Reception Hall Layout',
    approvalStatus: 'approved',
    createdBy: userId,
    payload: {
      items: [
        { id: 'table-1', type: 'round_table', label: 'Table 1', x: 200, y: 180, radius: 42 },
        { id: 'seat-1', type: 'chair', label: 'A1', x: 160, y: 180, radius: 10, guestId: 'g1' },
        { id: 'vendor-dj', type: 'vendor_zone', label: 'DJ Zone', x: 420, y: 180, width: 120, height: 72 },
        { id: 'exit-a', type: 'fire_exit', label: 'Exit A', x: 80, y: 80, width: 60, height: 24 },
        { id: 'ada', type: 'ada_path', label: 'ADA Path', x: 280, y: 300, width: 260, height: 28 },
        { id: 'power', type: 'power_outlet', label: 'Power', x: 500, y: 210, width: 20, height: 20 },
      ],
    },
  });
  return { token, orgId, eventId };
}

const req = (token: string, url: string) =>
  app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });

function unzipEntries(payload: Buffer): Map<string, Buffer> {
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (offset < payload.length && payload.readUInt32LE(offset) === 0x04034b50) {
    const method = payload.readUInt16LE(offset + 8);
    const compressedSize = payload.readUInt32LE(offset + 18);
    const fileNameLength = payload.readUInt16LE(offset + 26);
    const extraLength = payload.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = payload.subarray(nameStart, nameStart + fileNameLength).toString('utf8');
    const dataStart = nameStart + fileNameLength + extraLength;
    const data = payload.subarray(dataStart, dataStart + compressedSize);
    entries.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data));
    offset = dataStart + compressedSize;
  }
  return entries;
}

describe('Data Exports', () => {
  it('exports guests as CSV', async () => {
    const s = await setup();
    const res = await req(s.token, `/api/orgs/${s.orgId}/export/guests.csv`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.body).toContain('Name');
    expect(res.body).toContain('Alice');
  });

  it('exports vendors as CSV', async () => {
    const s = await setup();
    const res = await req(s.token, `/api/orgs/${s.orgId}/export/vendors.csv`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.body).toContain('DJ Test');
  });

  it('exports financials as JSON', async () => {
    const s = await setup();
    const res = await req(s.token, `/api/orgs/${s.orgId}/export/financials.json`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    const data = JSON.parse(res.body);
    expect(data.exportedAt).toBeTruthy();
    expect(data.events).toHaveLength(1);
    expect(data.events[0].event.title).toBe('Export Test');
  });

  it('exports event day-of operations packet as JSON', async () => {
    const s = await setup();
    const res = await req(s.token, `/api/events/${s.eventId}/export/day-of-packet.json`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    const data = JSON.parse(res.body);
    expect(data.type).toBe('event_day_operations_packet');
    expect(data.event.title).toBe('Export Test');
    expect(data.summary.guestCount).toBe(1);
    expect(data.summary.vendorCount).toBe(1);
    expect(data.guests[0].name).toBe('Alice');
    expect(data.vendors[0].name).toBe('DJ Test');
  });

  it('exports branded PDF/ZIP operations packet', async () => {
    const s = await setup();
    const res = await req(s.token, `/api/events/${s.eventId}/export/operations-packet.zip`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
    expect(res.headers['content-disposition']).toContain('operations_packet');
    expect(res.headers['x-operations-packet-type']).toBe('branded_event_operations_packet');
    const payload = (res as any).rawPayload as Buffer;
    expect(payload.subarray(0, 2).toString('utf8')).toBe('PK');
    const entries = unzipEntries(payload);
    const names = Array.from(entries.keys()).join('\n');
    expect(names).toContain('00-branded-operations-packet.pdf');
    expect(names).toContain('beo-event-operating-brief.txt');
    expect(names).toContain('run-sheet.txt');
    expect(names).toContain('call-sheet.txt');
    expect(names).toContain('vendor-load-in-packet.txt');
    expect(names).toContain('incident-report.txt');
    expect(names).toContain('closeout-checklist.txt');
    expect(names).toContain('floorplans/01-reception-hall-layout-visual-preview.svg');
    const pdf = entries.get('export-test-operations-packet/00-branded-operations-packet.pdf')!.toString('latin1');
    expect(pdf).toContain('%PDF-1.4');
    expect(pdf).toContain('Wedding Venue Intelligence');
    expect(pdf).toContain('Floorplan visual preview');
    const manifest = JSON.parse(entries.get('export-test-operations-packet/00-packet-manifest.json')!.toString('utf8'));
    expect(manifest.formatVersion).toBe(2);
    expect(manifest.compression).toBe('deflate');
    expect(manifest.summary.floorplanPreviews).toBe(1);
    const vendorPacket = entries.get('export-test-operations-packet/05-vendor-load-in-packet.txt')!.toString('utf8');
    expect(vendorPacket).toContain('DJ Test');
    expect(vendorPacket).toContain('Dock A');
    const floorplanSvg = entries.get('export-test-operations-packet/floorplans/01-reception-hall-layout-visual-preview.svg')!.toString('utf8');
    expect(floorplanSvg).toContain('<svg');
    expect(floorplanSvg).toContain('Reception Hall Layout Floorplan Preview');
    expect(floorplanSvg).toContain('Tables 1');
  });

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/orgs/fake/export/guests.csv' });
    expect(res.statusCode).toBe(401);
  });
});

describe('Org backup', () => {
  it('exports full org data as JSON backup', async () => {
    const s = await setup();
    const res = await req(s.token, `/api/orgs/${s.orgId}/export/backup.json`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    const data = JSON.parse(res.body);
    expect(data.exportedAt).toBeTruthy();
    expect(data.schemaVersion).toBeGreaterThanOrEqual(1);
    expect(data.events).toHaveLength(1);
    expect(data.guests).toHaveLength(1);
    expect(data.vendors).toHaveLength(1);
    expect(data.summary.eventCount).toBe(1);
    expect(data.summary.guestCount).toBe(1);
  });

  it('requires org.manage permission', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/orgs/fake/export/backup.json' });
    expect(res.statusCode).toBe(401);
  });
});
