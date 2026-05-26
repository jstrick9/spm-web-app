/**
 * Lightweight coverage tests for SDK modules not exercised end-to-end.
 *
 * Each test mounts a one-shot MSW handler that asserts the request shape
 * and returns a canned response. The goal isn't to retest the server
 * (we did that in Phase 1) but to confirm the SDK builds the right
 * URLs + payloads + propagates the typed response.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse, server } from '../test/server.js';
import { resetStore } from '../test/handlers.js';
import { sdk, setToken } from './index.js';

beforeEach(() => {
  resetStore();
  setToken('test-token');
});

describe('venues SDK', () => {
  it('list builds the right URL', async () => {
    server.use(
      http.get('/api/orgs/:orgId/venues', ({ params }) => {
        return HttpResponse.json({ venues: [{ id: 'v1', name: `From ${params.orgId}`, organization_id: params.orgId, category: 'reception', environment: 'indoor', description: null, capacity: 0, width: 0, height: 0, created_at: '' }] });
      }),
    );
    const r = await sdk.venues.list('org-x');
    expect(r.venues[0].name).toBe('From org-x');
  });

  it('create posts the input', async () => {
    server.use(
      http.post('/api/orgs/:orgId/venues', async ({ request }) => {
        const body = await request.json() as { name: string; capacity: number };
        return HttpResponse.json({ venue: { id: 'v', organization_id: '', name: body.name, category: 'reception', environment: 'indoor', description: null, capacity: body.capacity, width: 0, height: 0, created_at: '' } }, { status: 201 });
      }),
    );
    const r = await sdk.venues.create('org', { name: 'Hall', capacity: 200 });
    expect(r.venue.capacity).toBe(200);
  });

  it('update patches by id', async () => {
    server.use(
      http.patch('/api/venues/:id', ({ params }) => HttpResponse.json({ venue: { id: params.id as string, organization_id: '', name: '', category: '', environment: 'indoor', description: null, capacity: 0, width: 0, height: 0, created_at: '' } })),
    );
    const r = await sdk.venues.update('v-1', { capacity: 300 });
    expect(r.venue.id).toBe('v-1');
  });

  it('delete returns void on 204', async () => {
    server.use(
      http.delete('/api/venues/:id', () => new HttpResponse(null, { status: 204 })),
    );
    await expect(sdk.venues.delete('v-1')).resolves.toBeUndefined();
  });
});

describe('catalog SDK', () => {
  it('list scopes by kind', async () => {
    server.use(
      http.get('/api/orgs/:orgId/catalog/:kind', ({ params }) => {
        return HttpResponse.json({ items: [{ id: 'c1', organizationId: params.orgId as string, kind: params.kind as 'table', name: 'Round', spec: {}, visible: true, sortOrder: 0, createdAt: '', updatedAt: '' }] });
      }),
    );
    const r = await sdk.catalog.list('org', 'table');
    expect(r.items[0].kind).toBe('table');
  });

  it('replaceAll PUTs the items array', async () => {
    let received: unknown;
    server.use(
      http.put('/api/orgs/:orgId/catalog/:kind', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ items: [] });
      }),
    );
    await sdk.catalog.replaceAll('org', 'chair', [{ name: 'A' }, { name: 'B' }]);
    expect(received).toEqual({ items: [{ name: 'A' }, { name: 'B' }] });
  });
});

describe('layouts SDK', () => {
  it('list builds query params correctly', async () => {
    let captured: URL | undefined;
    server.use(
      http.get('/api/orgs/:orgId/layouts', ({ request }) => {
        captured = new URL(request.url);
        return HttpResponse.json({ layouts: [] });
      }),
    );
    await sdk.layouts.list('org', { eventId: 'e1', template: false });
    expect(captured?.searchParams.get('eventId')).toBe('e1');
    expect(captured?.searchParams.get('template')).toBe('false');
  });

  it('save calls /save with payload + revision', async () => {
    let received: unknown;
    server.use(
      http.post('/api/layouts/:id/save', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ layout: { id: 'l1', organization_id: '', event_id: null, venue_id: null, name: '', visibility: 'event', revision: 2, payload: '{}', is_template: 0, created_at: '', updated_at: '' } });
      }),
    );
    const r = await sdk.layouts.save('l1', { items: [] }, { expectedRevision: 1 });
    expect(r.layout.revision).toBe(2);
    expect(received).toMatchObject({ expectedRevision: 1 });
  });
});

describe('vendors SDK', () => {
  it('list optionally filters by eventId', async () => {
    let url: URL | undefined;
    server.use(
      http.get('/api/orgs/:orgId/vendors', ({ request }) => {
        url = new URL(request.url);
        return HttpResponse.json({ vendors: [] });
      }),
    );
    await sdk.vendors.list('org', { eventId: 'e1' });
    expect(url?.searchParams.get('eventId')).toBe('e1');
  });

  it('addPayment posts to /payments', async () => {
    let received: unknown;
    server.use(
      http.post('/api/vendors/:id/payments', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ payment: { id: 'p', vendor_id: 'v', amount_cents: 1000, paid_at: '2026-01-01', method: null, notes: null } }, { status: 201 });
      }),
    );
    await sdk.vendors.addPayment('v', { amountCents: 1000, paidAt: '2026-01-01' });
    expect(received).toMatchObject({ amountCents: 1000 });
  });
});

describe('timeline SDK', () => {
  it('list per-event', async () => {
    server.use(
      http.get('/api/events/:eventId/timeline', () =>
        HttpResponse.json({ items: [{ id: 't', event_id: 'e', title: 'Ceremony', category: 'other', starts_at: '', ends_at: null, duration_min: null, location: null, notes: null, vendor_id: null, completed: 0, assigned_to: null, created_at: '' }] })
      ),
    );
    const r = await sdk.timeline.list('e');
    expect(r.items[0].title).toBe('Ceremony');
  });
});

describe('orgs SDK', () => {
  it('updateBranding PUTs the payload', async () => {
    let received: unknown;
    server.use(
      http.put('/api/orgs/:orgId/branding', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ branding: received });
      }),
    );
    const r = await sdk.orgs.updateBranding('org', { primaryColor: '#4A1942' });
    expect(received).toEqual({ primaryColor: '#4A1942' });
    expect((r.branding as { primaryColor: string }).primaryColor).toBe('#4A1942');
  });
});
