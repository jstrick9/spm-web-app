import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse, server } from '../test/server.js';
import { resetStore } from '../test/handlers.js';
import { sdk, ApiError, getToken } from './index.js';
import { subscribe } from './client.js';

beforeEach(() => {
  resetStore();
});

describe('auth SDK', () => {
  it('register stores the token and returns user/org', async () => {
    const res = await sdk.auth.register({
      email: 'owner@x.com', password: 'pw1234', fullName: 'Owner', orgName: 'Org',
    });
    expect(res.user.email).toBe('owner@x.com');
    expect(res.organizationId).toBeTruthy();
    expect(getToken()).toBeTruthy();
  });

  it('login round-trips with the registered user', async () => {
    await sdk.auth.register({ email: 'a@x.com', password: 'pw1234', fullName: 'A', orgName: 'O' });
    const after = await sdk.auth.login('a@x.com', 'pw1234');
    expect(after.user.email).toBe('a@x.com');
  });

  it('login with wrong password throws ApiError(unauthorized)', async () => {
    await sdk.auth.register({ email: 'b@x.com', password: 'pw1234', fullName: 'B', orgName: 'O' });
    await expect(sdk.auth.login('b@x.com', 'wrong')).rejects.toThrow(ApiError);
    try { await sdk.auth.login('b@x.com', 'wrong'); }
    catch (e) {
      const err = e as ApiError;
      expect(err.kind).toBe('unauthorized');
      expect(err.status).toBe(401);
      expect(err.code).toBe('invalid-credentials');
    }
  });

  it('me() returns memberships after register', async () => {
    await sdk.auth.register({ email: 'c@x.com', password: 'pw1234', fullName: 'C', orgName: 'Org' });
    const me = await sdk.auth.me();
    expect(me.memberships).toHaveLength(1);
    expect(me.memberships[0].roleKey).toBe('owner');
  });

  it('logout clears the token', async () => {
    await sdk.auth.register({ email: 'd@x.com', password: 'pw1234', fullName: 'D', orgName: 'Org' });
    expect(getToken()).toBeTruthy();
    await sdk.auth.logout();
    expect(getToken()).toBeNull();
  });
});

describe('events SDK', () => {
  it('create -> list -> get -> update -> delete', async () => {
    const reg = await sdk.auth.register({
      email: 'e@x.com', password: 'pw1234', fullName: 'E', orgName: 'O',
    });
    const orgId = reg.organizationId!;
    const created = await sdk.events.create({ organizationId: orgId, title: 'Wedding 1' });
    expect(created.event.id).toBeTruthy();

    const list = await sdk.events.list(orgId);
    expect(list.events).toHaveLength(1);

    const fetched = await sdk.events.get(created.event.id);
    expect(fetched.event.title).toBe('Wedding 1');

    const patched = await sdk.events.update(created.event.id, { status: 'booked' });
    expect(patched.event.status).toBe('booked');

    await sdk.events.delete(created.event.id);
    await expect(sdk.events.get(created.event.id)).rejects.toThrow(/not-found/);
  });
});

describe('guests SDK + public RSVP', () => {
  it('add guest, submit RSVP via public portal, see guest status update', async () => {
    const reg = await sdk.auth.register({ email: 'g@x.com', password: 'pw1234', fullName: 'G', orgName: 'O' });
    const evt = (await sdk.events.create({ organizationId: reg.organizationId!, title: 'Wedding' })).event;
    const guest = (await sdk.guests.create(evt.id, { fullName: 'Aunt Mary' })).guest;

    // Public portal info (no auth needed)
    const info = await sdk.portal.info(evt.id);
    expect(info.guests).toHaveLength(1);
    expect(info.guests[0].fullName).toBe('Aunt Mary');

    // Submit RSVP publicly
    const rsvp = await sdk.portal.submitRsvp(evt.id, {
      guestId: guest.id, attending: true, mealChoice: 'vegan',
    });
    expect(rsvp.ok).toBe(true);

    // Counts updated
    const after = await sdk.guests.list(evt.id);
    expect(after.counts.attending).toBe(1);
    expect(after.counts.pending).toBe(0);
  });
});

describe('roles SDK', () => {
  it('lists system roles after registration', async () => {
    const reg = await sdk.auth.register({ email: 'r@x.com', password: 'pw1234', fullName: 'R', orgName: 'O' });
    const res = await sdk.roles.listRoles(reg.organizationId!);
    const keys = res.roles.map(r => r.key).sort();
    expect(keys).toEqual(['admin','couple','guest','owner','planner','staff','vendor']);
  });

  it('creates a custom role and updates its permissions', async () => {
    const reg = await sdk.auth.register({ email: 'r2@x.com', password: 'pw1234', fullName: 'R', orgName: 'O' });
    const created = await sdk.roles.createCustomRole(reg.organizationId!, {
      key: 'finance', name: 'Finance', permissions: ['events.view'],
    });
    expect(created.role.is_system).toBe(0);
    expect(created.role.permissions).toEqual(['events.view']);

    const updated = await sdk.roles.updateCustomRole(created.role.id, {
      permissions: ['events.view', 'guests.view'],
    });
    expect(updated.role.permissions).toEqual(['events.view', 'guests.view']);
  });

  it('refuses to edit a system role', async () => {
    const reg = await sdk.auth.register({ email: 'r3@x.com', password: 'pw1234', fullName: 'R', orgName: 'O' });
    await sdk.roles.listRoles(reg.organizationId!); // warm up
    await expect(
      sdk.roles.updateCustomRole('sys_owner', { name: 'Hacked' })
    ).rejects.toMatchObject({ code: 'system-role-immutable' });
  });

  it('returns the permission catalog', async () => {
    const reg = await sdk.auth.register({ email: 'r4@x.com', password: 'pw1234', fullName: 'R', orgName: 'O' });
    const cat = await sdk.roles.permissionCatalog(reg.organizationId!);
    expect(cat.catalog.length).toBeGreaterThan(0);
    expect(cat.catalog.some(p => p.id === 'vendor.portal.view')).toBe(true);
  });
});

describe('ApiError + lifecycle events', () => {
  it('emits request-start/success events', async () => {
    const events: string[] = [];
    const unsub = subscribe(e => events.push(e.kind));
    await sdk.auth.register({ email: 'lx@x.com', password: 'pw1234', fullName: 'L', orgName: 'O' });
    unsub();
    expect(events).toContain('request-start');
    expect(events).toContain('request-success');
    expect(events).toContain('token-changed');
  });

  it('throws ApiError(offline) and emits server-unreachable on network failure', async () => {
    // Force the next request to fail at the network layer
    server.use(
      http.get('/api/orgs', () => HttpResponse.error()),
    );

    const events: string[] = [];
    const unsub = subscribe(e => events.push(e.kind));

    await sdk.auth.register({ email: 'off@x.com', password: 'pw1234', fullName: 'O', orgName: 'O' });
    try { await sdk.orgs.list(); }
    catch (e) {
      const err = e as ApiError;
      expect(err.kind).toBe('offline');
    }
    unsub();
    expect(events).toContain('server-unreachable');
  });

  it('classifies 401 as unauthorized', async () => {
    try { await sdk.orgs.list(); }  // no token
    catch (e) {
      const err = e as ApiError;
      expect(err.kind).toBe('unauthorized');
      expect(err.status).toBe(401);
    }
  });

  it('classifies 404 as not-found', async () => {
    await sdk.auth.register({ email: '404@x.com', password: 'pw1234', fullName: 'X', orgName: 'O' });
    try { await sdk.events.get('does-not-exist'); }
    catch (e) {
      const err = e as ApiError;
      expect(err.kind).toBe('not-found');
    }
  });
});
