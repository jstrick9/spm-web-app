import '../test/setup.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import { assetsRepo } from '../db/repos/assets.js';
import { coupleDocumentsRepo } from '../db/repos/coupleDocuments.js';
import { eventsRepo } from '../db/repos/events.js';
import { rolesRepo } from '../db/repos/roles.js';
import { uuid } from '../lib/crypto.js';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// fileStorage resolves its default relative to the server package.  Keep fixtures
// inside that namespace and remove them after the suite so no test upload persists.
const uploadRoot = join(process.cwd(), 'uploads');

let app: FastifyInstance;

async function register(label: string) {
  const response = await app.inject({
    method: 'POST', url: '/api/auth/register', headers: { 'content-type': 'application/json' },
    payload: { email: `private-file-${label}-${uuid()}@example.test`, password: 'testpass123', fullName: label, orgName: `${label} org` },
  });
  expect(response.statusCode).toBe(201);
  const body = response.json();
  return { token: body.token as string, userId: body.user.id as string, orgId: body.organizationId as string };
}

function addEventMember(eventId: string, userId: string, roleKey: string) {
  const role = rolesRepo.findByKey(null, roleKey);
  if (!role) throw new Error(`Missing system role ${roleKey}`);
  db.prepare('INSERT INTO event_memberships (id,event_id,user_id,role_id,status) VALUES (?,?,?,?,?)')
    .run(uuid(), eventId, userId, role.id, 'active');
}

function privateUrl(name: string) {
  mkdirSync(join(uploadRoot, 'private'), { recursive: true });
  writeFileSync(join(uploadRoot, 'private', name), Buffer.from('%PDF-1.4\nprivate matrix\n'));
  return `/uploads/private/${name}`;
}

function privateDocument(orgId: string, eventId: string, userId: string, visibility: 'couple' | 'couple_venue') {
  return coupleDocumentsRepo.create({
    organizationId: orgId, eventId, filename: 'private.pdf', url: privateUrl(`${uuid()}.pdf`), mimeType: 'application/pdf',
    category: 'contract', visibility, notes: 'matrix', uploadedBy: userId,
  });
}

beforeAll(async () => { app = await buildApp(); await app.ready(); });
afterAll(async () => { await app.close(); rmSync(uploadRoot, { recursive: true, force: true }); });
beforeEach(() => {
  for (const table of ['asset_capabilities', 'assets', 'couple_documents', 'event_memberships', 'events', 'organization_memberships', 'organizations', 'users']) {
    try { db.prepare(`DELETE FROM ${table}`).run(); } catch { /* fixture dependency order */ }
  }
  rmSync(uploadRoot, { recursive: true, force: true });
  mkdirSync(join(uploadRoot, 'private'), { recursive: true });
});

describe('private-file authorization and capability matrix', () => {
  it('requires auth and enforces organization, event, and couple-document visibility boundaries', async () => {
    const owner = await register('owner');
    const couple = await register('couple');
    const venue = await register('venue');
    const outsider = await register('outsider');
    const event = eventsRepo.create({ organizationId: owner.orgId, title: `Matrix ${uuid()}`, createdBy: owner.userId });
    addEventMember(event.id, couple.userId, 'couple');
    addEventMember(event.id, venue.userId, 'manager');
    const coupleOnly = privateDocument(owner.orgId, event.id, owner.userId, 'couple');
    const shared = privateDocument(owner.orgId, event.id, owner.userId, 'couple_venue');
    const content = (documentId: string, token?: string, eventId = event.id) => app.inject({
      method: 'GET', url: `/api/events/${eventId}/couple-documents/${documentId}/content`, headers: token ? { authorization: `Bearer ${token}` } : {},
    });

    expect((await content(coupleOnly.id)).statusCode).toBe(401);
    expect((await content(coupleOnly.id, outsider.token)).statusCode).toBe(403);
    expect((await content(coupleOnly.id, owner.token, uuid())).statusCode).toBe(404);
    expect((await content(coupleOnly.id, venue.token)).statusCode).toBe(404);
    expect((await content(coupleOnly.id, couple.token)).statusCode).toBe(200);
    expect((await content(shared.id, venue.token)).statusCode).toBe(200);
  });

  it('allows only approved public assets or a valid current capability and never exposes /uploads/private directly', async () => {
    const owner = await register('asset-owner');
    const storageKey = privateUrl(`${uuid()}.pdf`);
    const asset = assetsRepo.create({ organization_id: owner.orgId, event_id: null, owner_type: 'vendor_coi', owner_id: uuid(), storage_key: storageKey, original_filename: 'asset.pdf', mime_type: 'application/pdf', visibility: 'capability', publish_status: 'draft', created_by: owner.userId });
    const endpoint = `/api/public/assets/${asset.id}/content`;

    expect((await app.inject({ method: 'GET', url: endpoint })).statusCode).toBe(401);
    const active = assetsRepo.issueCapability(asset.id, 'external', new Date(Date.now() + 60_000).toISOString(), owner.userId);
    expect((await app.inject({ method: 'GET', url: `${endpoint}?token=${active.token}` })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `${endpoint}?token=wrong-${active.token}` })).statusCode).toBe(401);
    const expired = assetsRepo.issueCapability(asset.id, 'external', new Date(Date.now() - 60_000).toISOString(), owner.userId);
    expect((await app.inject({ method: 'GET', url: `${endpoint}?token=${expired.token}` })).statusCode).toBe(401);
    expect(assetsRepo.revokeCapability(active.row.id)).toBe(true);
    expect((await app.inject({ method: 'GET', url: `${endpoint}?token=${active.token}` })).statusCode).toBe(401);
    db.prepare("UPDATE assets SET visibility='public', publish_status='approved' WHERE id=?").run(asset.id);
    expect((await app.inject({ method: 'GET', url: endpoint })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: storageKey })).statusCode).toBe(404);
  });
});
