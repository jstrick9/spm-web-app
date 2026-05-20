import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
let app;
beforeAll(async () => {
    app = await buildApp();
    await app.ready();
});
beforeEach(() => {
    const tables = [
        'audit_logs', 'direct_messages', 'event_answers', 'event_questions',
        'staff_shifts', 'staff_areas', 'staff_tasks', 'timeline_events',
        'vendor_payments', 'vendors', 'decor_packages', 'decor_arrangements',
        'decor_categories', 'decor_items', 'guest_portal_configs', 'rsvp_submissions',
        'guest_sub_event_invitations', 'guests', 'layout_versions', 'layouts',
        'catalog_items', 'venues', 'sub_events', 'event_memberships', 'events',
        'organization_memberships', 'organizations', 'users',
    ];
    for (const t of tables)
        db.prepare(`DELETE FROM ${t}`).run();
});
// Helper: register a fresh user and return their token + org id
async function registerUser(email = `u-${Math.random().toString(36).slice(2)}@x.com`) {
    const res = await app.inject({
        method: 'POST', url: '/api/auth/register',
        payload: { email, password: 'testpass123', fullName: 'User', orgName: 'My Venue' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    return { token: body.token, userId: body.user.id, orgId: body.organizationId, email };
}
async function authedRequest(token, method, url, payload) {
    return app.inject({
        method, url,
        headers: payload !== undefined
            ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
            : { authorization: `Bearer ${token}` },
        payload: payload,
    });
}
describe('Auth flow', () => {
    it('register → login → me round trip', async () => {
        const { token, email } = await registerUser();
        const me = await authedRequest(token, 'GET', '/api/auth/me');
        expect(me.statusCode).toBe(200);
        expect(me.json().user.email).toBe(email);
        expect(me.json().memberships[0].role).toBe('owner');
    });
    it('register with duplicate email returns 409', async () => {
        await registerUser('dupe@x.com');
        const res = await app.inject({
            method: 'POST', url: '/api/auth/register',
            payload: { email: 'dupe@x.com', password: 'aaaaaaaa', fullName: 'X', orgName: 'Y' },
        });
        expect(res.statusCode).toBe(409);
    });
    it('login with wrong password returns 401', async () => {
        const { email } = await registerUser('badpass@x.com');
        const res = await app.inject({
            method: 'POST', url: '/api/auth/login',
            payload: { email, password: 'wrong' },
        });
        expect(res.statusCode).toBe(401);
    });
    it('protected endpoint without token returns 401', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/orgs' });
        expect(res.statusCode).toBe(401);
    });
});
describe('Org isolation (the big-deal RBAC test)', () => {
    it('user A cannot read user B org events', async () => {
        const a = await registerUser('owner-a@x.com');
        const b = await registerUser('owner-b@x.com');
        // A creates an event
        const e = await authedRequest(a.token, 'POST', '/api/events', {
            organizationId: a.orgId, title: 'Private Event',
        });
        expect(e.statusCode).toBe(201);
        const eventId = e.json().event.id;
        // B tries to list A's events
        const list = await authedRequest(b.token, 'GET', `/api/orgs/${a.orgId}/events`);
        expect(list.statusCode).toBe(403);
        // B tries to read A's event directly
        const read = await authedRequest(b.token, 'GET', `/api/events/${eventId}`);
        expect(read.statusCode).toBe(403);
        // B tries to delete A's event
        const del = await authedRequest(b.token, 'DELETE', `/api/events/${eventId}`);
        expect(del.statusCode).toBe(403);
    });
    it('user A cannot read user B guests via direct guest fetch', async () => {
        const a = await registerUser('a-x@x.com');
        const b = await registerUser('b-x@x.com');
        const ev = (await authedRequest(a.token, 'POST', '/api/events', {
            organizationId: a.orgId, title: 'A event',
        })).json().event;
        const guest = (await authedRequest(a.token, 'POST', `/api/events/${ev.id}/guests`, {
            fullName: 'Aunt Mary',
        })).json().guest;
        // B should get 403 trying to patch A's guest
        const res = await authedRequest(b.token, 'PATCH', `/api/guests/${guest.id}`, { rsvpStatus: 'attending' });
        expect(res.statusCode).toBe(403);
    });
});
describe('Events CRUD', () => {
    it('list, create, read, patch, delete', async () => {
        const u = await registerUser();
        const list1 = await authedRequest(u.token, 'GET', `/api/orgs/${u.orgId}/events`);
        expect(list1.json().events).toHaveLength(0);
        const create = await authedRequest(u.token, 'POST', '/api/events', {
            organizationId: u.orgId, title: 'Wedding 1', startDate: '2027-06-01',
        });
        expect(create.statusCode).toBe(201);
        const id = create.json().event.id;
        const get = await authedRequest(u.token, 'GET', `/api/events/${id}`);
        expect(get.json().event.title).toBe('Wedding 1');
        const patch = await authedRequest(u.token, 'PATCH', `/api/events/${id}`, { status: 'booked' });
        expect(patch.json().event.status).toBe('booked');
        const del = await authedRequest(u.token, 'DELETE', `/api/events/${id}`);
        expect(del.statusCode).toBe(204);
        const get2 = await authedRequest(u.token, 'GET', `/api/events/${id}`);
        expect(get2.statusCode).toBe(404);
    });
});
describe('Guests + RSVP (the wedding-critical flow)', () => {
    it('full lifecycle: add guest → public portal RSVPs → guest status updates', async () => {
        const u = await registerUser();
        const evt = (await authedRequest(u.token, 'POST', '/api/events', {
            organizationId: u.orgId, title: 'Wedding',
        })).json().event;
        // Add a guest
        const guest = (await authedRequest(u.token, 'POST', `/api/events/${evt.id}/guests`, {
            fullName: 'Aunt Mary', email: 'aunt@example.com',
        })).json().guest;
        // Counts: 1 pending
        const list = await authedRequest(u.token, 'GET', `/api/events/${evt.id}/guests`);
        expect(list.json().counts.pending).toBe(1);
        // Public portal info (no auth)
        const info = await app.inject({ method: 'GET', url: `/api/portal/${evt.id}/info` });
        expect(info.statusCode).toBe(200);
        expect(info.json().guests).toHaveLength(1);
        expect(info.json().guests[0].fullName).toBe('Aunt Mary');
        // Public RSVP submission (no auth!)
        const submit = await app.inject({
            method: 'POST', url: `/api/portal/${evt.id}/rsvp`,
            payload: { guestId: guest.id, attending: true, mealChoice: 'vegan' },
            headers: { 'content-type': 'application/json' },
        });
        expect(submit.statusCode).toBe(201);
        // Authed: see the RSVP + guest is now 'attending'
        const rsvps = await authedRequest(u.token, 'GET', `/api/events/${evt.id}/rsvps`);
        expect(rsvps.json().rsvps).toHaveLength(1);
        const list2 = await authedRequest(u.token, 'GET', `/api/events/${evt.id}/guests`);
        expect(list2.json().counts.attending).toBe(1);
        expect(list2.json().counts.pending).toBe(0);
    });
    it('public RSVP with revoked portal access returns 403', async () => {
        const u = await registerUser();
        const evt = (await authedRequest(u.token, 'POST', '/api/events', {
            organizationId: u.orgId, title: 'X',
        })).json().event;
        const guest = (await authedRequest(u.token, 'POST', `/api/events/${evt.id}/guests`, {
            fullName: 'Stranger',
        })).json().guest;
        await authedRequest(u.token, 'DELETE', `/api/guests/${guest.id}/portal-token`);
        const submit = await app.inject({
            method: 'POST', url: `/api/portal/${evt.id}/rsvp`,
            payload: { guestId: guest.id, attending: false },
            headers: { 'content-type': 'application/json' },
        });
        expect(submit.statusCode).toBe(403);
    });
    it('public RSVP with wrong-event guestId returns 400', async () => {
        const u = await registerUser();
        const e1 = (await authedRequest(u.token, 'POST', '/api/events', {
            organizationId: u.orgId, title: 'E1',
        })).json().event;
        const e2 = (await authedRequest(u.token, 'POST', '/api/events', {
            organizationId: u.orgId, title: 'E2',
        })).json().event;
        const g = (await authedRequest(u.token, 'POST', `/api/events/${e1.id}/guests`, {
            fullName: 'Guest',
        })).json().guest;
        // Try to RSVP guest from e1 against e2
        const res = await app.inject({
            method: 'POST', url: `/api/portal/${e2.id}/rsvp`,
            payload: { guestId: g.id, attending: true },
            headers: { 'content-type': 'application/json' },
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('guest-not-in-event');
    });
    it('portal config password is verifiable', async () => {
        const u = await registerUser();
        const evt = (await authedRequest(u.token, 'POST', '/api/events', {
            organizationId: u.orgId, title: 'P',
        })).json().event;
        const set = await authedRequest(u.token, 'PUT', `/api/events/${evt.id}/portal-config`, {
            enabled: true, password: 'rsvp1234',
        });
        expect(set.statusCode).toBe(200);
        const ok = await app.inject({
            method: 'POST', url: `/api/portal/${evt.id}/verify-password`,
            payload: { password: 'rsvp1234' }, headers: { 'content-type': 'application/json' },
        });
        expect(ok.statusCode).toBe(200);
        const bad = await app.inject({
            method: 'POST', url: `/api/portal/${evt.id}/verify-password`,
            payload: { password: 'wrong' }, headers: { 'content-type': 'application/json' },
        });
        expect(bad.statusCode).toBe(401);
    });
});
describe('Layouts (revision history + optimistic concurrency)', () => {
    it('create → save → list versions', async () => {
        const u = await registerUser();
        const evt = (await authedRequest(u.token, 'POST', '/api/events', {
            organizationId: u.orgId, title: 'E',
        })).json().event;
        const created = (await authedRequest(u.token, 'POST', '/api/layouts', {
            organizationId: u.orgId, eventId: evt.id,
            name: 'Reception V1', payload: { items: [] },
        })).json().layout;
        expect(created.revision).toBe(1);
        const saved = (await authedRequest(u.token, 'POST', `/api/layouts/${created.id}/save`, {
            payload: { items: [{ x: 1 }] }, changeDescription: 'add table',
        })).json().layout;
        expect(saved.revision).toBe(2);
        const versions = (await authedRequest(u.token, 'GET', `/api/layouts/${created.id}/versions`)).json().versions;
        expect(versions).toHaveLength(2);
    });
    it('rejects stale save with 409', async () => {
        const u = await registerUser();
        const layout = (await authedRequest(u.token, 'POST', '/api/layouts', {
            organizationId: u.orgId, name: 'L', payload: {},
        })).json().layout;
        await authedRequest(u.token, 'POST', `/api/layouts/${layout.id}/save`, { payload: { v: 2 } });
        const conflict = await authedRequest(u.token, 'POST', `/api/layouts/${layout.id}/save`, {
            payload: { v: 3 }, expectedRevision: 1,
        });
        expect(conflict.statusCode).toBe(409);
    });
});
describe('Catalog', () => {
    it('per-kind CRUD', async () => {
        const u = await registerUser();
        const create = await authedRequest(u.token, 'POST', `/api/orgs/${u.orgId}/catalog/table`, {
            name: 'Round 6ft', spec: { capacity: 10 },
        });
        expect(create.statusCode).toBe(201);
        const items = (await authedRequest(u.token, 'GET', `/api/orgs/${u.orgId}/catalog/table`)).json().items;
        expect(items).toHaveLength(1);
        // Bulk replace
        const replaced = await authedRequest(u.token, 'PUT', `/api/orgs/${u.orgId}/catalog/table`, {
            items: [{ name: 'A' }, { name: 'B' }],
        });
        expect(replaced.json().items).toHaveLength(2);
    });
    it('rejects invalid kind', async () => {
        const u = await registerUser();
        const res = await authedRequest(u.token, 'GET', `/api/orgs/${u.orgId}/catalog/bogus`);
        expect(res.statusCode).toBe(400);
    });
});
describe('Vendors + Timeline + Staff', () => {
    it('vendor lifecycle + payments', async () => {
        const u = await registerUser();
        const v = (await authedRequest(u.token, 'POST', `/api/orgs/${u.orgId}/vendors`, {
            name: 'DJ Smith', category: 'music', contractAmountCents: 200_000,
        })).json().vendor;
        expect(v.id).toBeTruthy();
        await authedRequest(u.token, 'POST', `/api/vendors/${v.id}/payments`, {
            amountCents: 50_000, paidAt: '2026-06-01',
        });
        const payments = (await authedRequest(u.token, 'GET', `/api/vendors/${v.id}/payments`)).json().payments;
        expect(payments).toHaveLength(1);
    });
    it('timeline CRUD', async () => {
        const u = await registerUser();
        const evt = (await authedRequest(u.token, 'POST', '/api/events', {
            organizationId: u.orgId, title: 'E',
        })).json().event;
        const item = (await authedRequest(u.token, 'POST', `/api/events/${evt.id}/timeline`, {
            title: 'Ceremony', startsAt: '2026-12-31T17:00:00Z',
        })).json().item;
        const updated = (await authedRequest(u.token, 'PATCH', `/api/timeline/${item.id}`, {
            completed: true,
        })).json().item;
        expect(updated.completed).toBe(1);
    });
    it('staff task lifecycle', async () => {
        const u = await registerUser();
        const t = (await authedRequest(u.token, 'POST', `/api/orgs/${u.orgId}/staff/tasks`, {
            title: 'Set up chairs', priority: 'high',
        })).json().task;
        const done = (await authedRequest(u.token, 'PATCH', `/api/staff/tasks/${t.id}`, {
            status: 'completed',
        })).json().task;
        expect(done.status).toBe('completed');
        expect(done.completed_at).toBeTruthy();
    });
});
describe('Validation errors', () => {
    it('returns 400 with details for missing required fields', async () => {
        const u = await registerUser();
        const res = await authedRequest(u.token, 'POST', '/api/events', {
            organizationId: u.orgId,
        });
        expect(res.statusCode).toBe(400);
        expect(res.json().error).toBe('invalid-input');
    });
});
describe('Health check', () => {
    it('returns ok', async () => {
        const res = await app.inject({ method: 'GET', url: '/api/health' });
        expect(res.statusCode).toBe(200);
        expect(res.json().ok).toBe(true);
    });
});
//# sourceMappingURL=routes.integration.test.js.map