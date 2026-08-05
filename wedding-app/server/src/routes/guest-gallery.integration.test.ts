import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { coupleDocumentsRepo, rolesRepo } from '../db/repos/index.js';
import { SYSTEM_ROLE_IDS } from '../lib/permissions.js';

/**
 * Guest-visible post-event gallery.
 *
 * The platform lets couples mark documents `guest_visible`, but nothing on
 * the guest side could ever reach them (the couple-side link requires
 * auth). These tests pin the public gallery flow:
 *   - only approved, post_event_gallery, guest_visible documents are listed
 *     in the guest portal payload and streamable;
 *   - everything else (pending, other category, other visibility, wrong
 *     event) is a 404;
 *   - the couple's post-event summary exposes a shareable guestUrl.
 */

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'couple_documents', 'audit_logs', 'sse_events', 'rsvp_submissions',
    'guest_help_requests', 'guests', 'events', 'event_memberships',
    'organization_memberships', 'organizations', 'users',
  ]) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* ok */ }
  }
  try {
    db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run();
    db.prepare(`DELETE FROM roles WHERE is_system = 0`).run();
  } catch { /* ok */ }
  rolesRepo.ensureSystemRoles();
});

async function registerOwner(email = `gg-${Math.random().toString(36).slice(2)}@x.com`) {
  const r = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: 'Owner', orgName: 'GGOrg' },
    headers: { 'content-type': 'application/json' },
  });
  return { token: r.json().token, userId: r.json().user.id, orgId: r.json().organizationId };
}

async function createEvent(owner: { token: string; orgId: string }) {
  const e = await app.inject({
    method: 'POST', url: '/api/events',
    payload: { organizationId: owner.orgId, title: 'Gallery Wedding' },
    headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' },
  });
  return e.json().event.id as string;
}

async function uploadDoc(owner: { token: string }, eventId: string, overrides: Record<string, unknown> = {}) {
  const r = await app.inject({
    method: 'POST', url: `/api/events/${eventId}/couple-documents`,
    payload: {
      filename: 'photo.pdf',
      dataUri: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp.Og0MTMgMiAwIG9iago8PAovTGVuZ3RoIDEgMAp+PgpzdHJlYW0KQlQKMjAgVExEIEhlbGxvB1QKRVQKZW5kc3RyZWFtCmVuZG9iagpzdGFydHhyZWYKMzMKJSVFT0YK',
      mimeType: 'application/pdf',
      category: 'post_event_gallery',
      visibility: 'guest_visible',
      ...overrides,
    },
    headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' },
  });
  return r;
}

describe('guest-visible post-event gallery', () => {
  it('lists approved guest-visible gallery documents in the guest portal payload', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const up = await uploadDoc(owner, eventId);
    expect(up.statusCode).toBe(201);
    coupleDocumentsRepo.update(up.json().document.id, { approvalStatus: 'approved' });

    const info = await app.inject({ method: 'GET', url: `/api/portal/${eventId}/info` });
    expect(info.statusCode).toBe(200);
    const gallery = info.json().guestPostEvent.galleryDocuments;
    expect(gallery).toHaveLength(1);
    expect(gallery[0].filename).toBe('photo.pdf');
    expect(gallery[0].url).toBe(`/api/portal/${eventId}/post-event-gallery/${up.json().document.id}`);
  });

  it('streams an approved guest-visible gallery document with its mime type', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const up = await uploadDoc(owner, eventId);
    coupleDocumentsRepo.update(up.json().document.id, { approvalStatus: 'approved' });
    const docId = up.json().document.id;

    const content = await app.inject({ method: 'GET', url: `/api/portal/${eventId}/post-event-gallery/${docId}` });
    expect(content.statusCode).toBe(200);
    expect(content.headers['content-type']).toContain('application/pdf');
    expect(content.headers['x-content-type-options']).toBe('nosniff');
    expect(content.rawPayload.length).toBeGreaterThan(0);
  });

  it('404s for pending / non-guest-visible / non-gallery documents', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);

    const pending = await uploadDoc(owner, eventId); // approval pending
    const r1 = await app.inject({ method: 'GET', url: `/api/portal/${eventId}/post-event-gallery/${pending.json().document.id}` });
    expect(r1.statusCode).toBe(404);

    const coupleVisible = await uploadDoc(owner, eventId, { visibility: 'couple' });
    coupleDocumentsRepo.update(coupleVisible.json().document.id, { approvalStatus: 'approved' });
    const r2 = await app.inject({ method: 'GET', url: `/api/portal/${eventId}/post-event-gallery/${coupleVisible.json().document.id}` });
    expect(r2.statusCode).toBe(404);

    const otherCategory = await uploadDoc(owner, eventId, { category: 'menu' });
    coupleDocumentsRepo.update(otherCategory.json().document.id, { approvalStatus: 'approved' });
    const r3 = await app.inject({ method: 'GET', url: `/api/portal/${eventId}/post-event-gallery/${otherCategory.json().document.id}` });
    expect(r3.statusCode).toBe(404);

    const r4 = await app.inject({ method: 'GET', url: `/api/portal/${eventId}/post-event-gallery/not-real` });
    expect(r4.statusCode).toBe(404);
  });

  it('does not list guest-visible docs from a different event', async () => {
    const owner = await registerOwner();
    const eventA = await createEvent(owner);
    const eventB = await createEvent(owner);
    const up = await uploadDoc(owner, eventA);
    coupleDocumentsRepo.update(up.json().document.id, { approvalStatus: 'approved' });

    const infoB = await app.inject({ method: 'GET', url: `/api/portal/${eventB}/info` });
    expect(infoB.json().guestPostEvent.galleryDocuments).toHaveLength(0);
    const cross = await app.inject({ method: 'GET', url: `/api/portal/${eventB}/post-event-gallery/${up.json().document.id}` });
    expect(cross.statusCode).toBe(404);
  });

  it('couple post-event summary exposes a shareable guestUrl', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const up = await uploadDoc(owner, eventId);
    coupleDocumentsRepo.update(up.json().document.id, { approvalStatus: 'approved' });

    const summary = await app.inject({
      method: 'GET', url: `/api/events/${eventId}/couple-post-event`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(summary.statusCode).toBe(200);
    const doc = summary.json().photoSharing.galleryDocuments[0];
    expect(doc.guestUrl).toBe(`/api/portal/${eventId}/post-event-gallery/${up.json().document.id}`);
  });

  it('couple role can view the summary too', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    // create couple user + membership
    const reg = await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email: `couple-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Couple', orgName: 'CoupleOrg' },
      headers: { 'content-type': 'application/json' },
    });
    const coupleUserId = reg.json().user.id;
    const inv = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/couple-invitations`,
      payload: { email: reg.json().user.email },
      headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' },
    });
    expect(inv.statusCode).toBe(201);
    const summary = await app.inject({
      method: 'GET', url: `/api/events/${eventId}/couple-post-event`,
      headers: { authorization: `Bearer ${reg.json().token}` },
    });
    expect(summary.statusCode).toBe(200);
    void coupleUserId;
    void SYSTEM_ROLE_IDS;
  });
});
