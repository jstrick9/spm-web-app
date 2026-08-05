/**
 * Probe batch #4 — malformed input sweeps.
 * Boots the app and throws adversarial inputs at many endpoints, asserting
 * the server NEVER returns 5xx (it should return 4xx or succeed).
 */
import '../test/setup.js';
import { describe, it, expect, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';

let app: FastifyInstance;
let token = '';
let orgId = '';
let eventId = '';

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email: `probe4-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Probe', orgName: 'Probe Org' },
    headers: { 'content-type': 'application/json' },
  });
  token = reg.json().token;
  orgId = reg.json().organizationId;
  const evt = await app.inject({
    method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Probe Wedding' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  eventId = evt.json().event.id;
});

const AUTH = { authorization: `Bearer ${token}` };

describe('probe batch #4 — query-parameter edge cases', () => {
  const qUrls = [
    '/api/events?limit=abc', '/api/events?limit=-5', '/api/events?limit=0', '/api/events?limit=1e6',
    '/api/events?offset=-3', '/api/events?offset=abc',
    '/api/audit?limit=99999999', '/api/audit?before=not-a-date', '/api/audit?before=2026-13-99T99:99:99Z',
    '/api/audit?after=garbage', '/api/audit?actorEmail=%00',
    `/api/events/${eventId}/guests?limit=1e308`, `/api/events/${eventId}/guests?search=${encodeURIComponent('%00%0a%0d')}`,
    '/api/orgs?limit=-1', '/api/vendors?limit=abc',
  ];
  for (const url of qUrls) {
    it(`GET ${url.split('?')[1]} — never 5xx`, async () => {
      const res = await app.inject({ method: 'GET', url, headers: AUTH });
      expect(res.statusCode).toBeLessThan(500);
    });
  }
});

describe('probe batch #4 — content-type oddities', () => {
  const targets: Array<[string, string, string, string | undefined]> = [
    // method, url, body, contentType
    ['POST', '/api/events', '{"organizationId":"x","title":"y"}', 'text/plain'],
    ['POST', '/api/events', 'organizationId=x&title=y', 'application/x-www-form-urlencoded'],
    ['POST', '/api/events', '', 'application/json'],
    ['POST', '/api/auth/login', '{"email":"a@b.c","password":"x"}', 'text/plain'],
    ['PATCH', `/api/events/${eventId}`, 'title=new', 'text/plain'],
    ['POST', `/api/events/${eventId}/gallery`, '{"filename":"a.jpg","url":"data:image/png;base64,iVBORw0KGgo=","category":"florals"}', 'application/xml'],
    ['POST', '/api/events', 'not json at all {{{', 'application/json'],
    ['POST', '/api/events', '[1,2,3]', 'application/json'],
    ['POST', '/api/events', '12345', 'application/json'],
    ['POST', '/api/events', '"a string"', 'application/json'],
    ['POST', '/api/events', 'null', 'application/json'],
  ];
  for (const [method, url, body, ctype] of targets) {
    it(`${method} ${url} as ${ctype}${body.length ? ` (${body.slice(0, 24)}...)` : ' (empty)'} — never 5xx`, async () => {
      const res = await app.inject({
        method: method as any, url,
        payload: ctype === 'application/json' ? undefined : body,
        headers: { ...AUTH, 'content-type': ctype },
      });
      expect(res.statusCode).toBeLessThan(500);
    });
  }
});

describe('probe batch #4 — nested / adversarial payload shapes', () => {
  const payloads: Array<[string, unknown]> = [
    ['null title', { organizationId: orgId, title: null }],
    ['array title', { organizationId: orgId, title: ['x'] }],
    ['object title', { organizationId: orgId, title: { a: 1 } }],
    ['numeric orgId', { organizationId: 42, title: 'x' }],
    ['huge nested depth', JSON.parse('{"organizationId":"' + orgId + '","title":"x","a":{"b":{"c":{"d":{"e":{"f":{"g":1}}}}}}}')],
    ['proto pollution attempt', JSON.parse(`{"organizationId":"${orgId}","title":"x","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}`)],
    ['long unicode title', { organizationId: orgId, title: '🎉'.repeat(100) }],
    ['startDate malformed', { organizationId: orgId, title: 'x', startDate: '2026-99-99' }],
    ['startDate number', { organizationId: orgId, title: 'x', startDate: 12345 }],
    ['venueId wrong shape', { organizationId: orgId, title: 'x', venueId: ['v'] }],
  ];
  for (const [label, payload] of payloads) {
    it(`POST /api/events — ${label} — never 5xx`, async () => {
      const res = await app.inject({ method: 'POST', url: '/api/events', payload: payload as never, headers: { ...AUTH, 'content-type': 'application/json' } });
      expect(res.statusCode).toBeLessThan(500);
    });
  }

  it('PATCH event with wrong-typed scalar fields — never 5xx', async () => {
    const patches: unknown[] = [
      { startDate: 42 }, { rsvpDeadline: [] }, { status: 'not-a-status' },
      { metadata: 'not-json' }, { metadata: 42 }, { metadata: { a: { b: { c: [1, [2, [3]]] } } } },
      { guestCount: 'many' }, { title: {} },
    ];
    for (const p of patches) {
      const res = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}`, payload: p as never, headers: { ...AUTH, 'content-type': 'application/json' } });
      expect(res.statusCode).toBeLessThan(500);
    }
  });

  it('nested DELETE bodies and weird methods — never 5xx', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/events/${eventId}`, payload: { shouldNotExist: true } as never, headers: { ...AUTH, 'content-type': 'application/json' } });
    expect(res.statusCode).toBeLessThan(500);
    const put = await app.inject({ method: 'PUT', url: `/api/events/${eventId}`, headers: AUTH });
    expect(put.statusCode).toBeLessThan(500);
    const head = await app.inject({ method: 'HEAD', url: `/api/events`, headers: AUTH });
    expect(head.statusCode).toBeLessThan(500);
  });

  it('guest + vendor + portal endpoints with garbage ids — never 5xx', async () => {
    const urls = [
      `/api/events/${eventId}/guests/not-a-real-id`,
      `/api/events/${eventId}/guests/${'x'.repeat(500)}`,
      `/api/events/${eventId}/vendors/abc`,
      `/api/events/${'z'.repeat(100)}/guests`,
      `/api/portal/${'z'.repeat(100)}`,
      `/api/events/${eventId}/couple-appointments/${'%'.repeat(20)}`,
      `/api/gallery/${'../..'.repeat(5)}`,
      `/api/uploads/public/${encodeURIComponent('../../etc/passwd')}`,
      `/api/uploads/private/..%2f..%2f..%2fetc%2fpasswd`,
    ];
    for (const url of urls) {
      const res = await app.inject({ method: 'GET', url, headers: AUTH });
      expect(res.statusCode).toBeLessThan(500);
    }
  });
});
