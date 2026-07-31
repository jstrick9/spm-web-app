import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => { for (const table of ['venue_communication_templates','organization_memberships','organizations','users']) { try { db.prepare(`DELETE FROM ${table}`).run(); } catch {} } });

describe('Venue communication templates', () => {
  it('lets venue leaders publish event-week message templates', async () => {
    const registration = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: `comm-${Math.random()}@test.com`, password: 'password123', fullName: 'Manager', orgName: 'Seven Paths Manor' } });
    const token = registration.json().token; const orgId = registration.json().organizationId;
    const created = await app.inject({ method: 'POST', url: `/api/orgs/${orgId}/communication-templates`, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { name: 'Rain plan update', category: 'rain_plan', audience: 'both', subject: 'Weather update', body: 'The ceremony moves indoors at 3 PM.' } });
    expect(created.statusCode).toBe(201);
    const list = await app.inject({ method: 'GET', url: `/api/orgs/${orgId}/communication-templates`, headers: { authorization: `Bearer ${token}` } });
    expect(list.json().templates[0]).toMatchObject({ name: 'Rain plan update', category: 'rain_plan', audience: 'both' });
  });
});
