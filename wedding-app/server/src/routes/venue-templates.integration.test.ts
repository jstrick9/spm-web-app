import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => { for (const table of ['layouts','venues','catalog_items','event_memberships','events','organization_memberships','organizations','users','audit_logs']) { try { db.prepare(`DELETE FROM ${table}`).run(); } catch {} } });

describe('Venue-approved templates', () => {
  it('lists approved templates and applies an editable proposal with a capacity warning', async () => {
    const registration = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: `template-${Math.random()}@test.com`, password: 'password123', fullName: 'Owner', orgName: 'Seven Paths Manor' } });
    const token = registration.json().token; const orgId = registration.json().organizationId;
    const event = await app.inject({ method: 'POST', url: '/api/events', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { organizationId: orgId, title: 'Template Wedding', guestCount: 120 } });
    const eventId = event.json().event.id;
    const venue = await app.inject({ method: 'POST', url: `/api/orgs/${orgId}/venues`, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { name: 'Grand Hall', capacity: 80, width: 50, height: 40, masterLayout: { walls: [], zones: [{ type: 'accessible_route' }] } } });
    const venueId = venue.json().venue.id;
    await app.inject({ method: 'PATCH', url: `/api/venues/${venueId}`, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { approvalStatus: 'approved', metadata: { approvalOverrideReason: 'Operational review complete.' } } });
    const template = await app.inject({ method: 'POST', url: `/api/orgs/${orgId}/catalog/template`, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { name: 'Plated Reception', visible: true, spec: { venueId, weddingMoment: 'reception', serviceStyle: 'plated', minGuests: 20, maxGuests: 80, allowedObjectCategories: ['tables', 'chairs'] } } });
    const templateId = template.json().item.id;
    const catalog = await app.inject({ method: 'GET', url: `/api/events/${eventId}/venue-templates`, headers: { authorization: `Bearer ${token}` } });
    expect(catalog.statusCode).toBe(200); expect(catalog.json().templates.map((item: any) => item.id)).toContain(templateId);
    const applied = await app.inject({ method: 'POST', url: `/api/events/${eventId}/venue-templates/${templateId}/apply`, headers: { authorization: `Bearer ${token}` } });
    expect(applied.statusCode).toBe(201);
    expect(JSON.parse(applied.json().layout.payload)).toMatchObject({ templateId, serviceStyle: 'plated', allowedObjectCategories: ['tables', 'chairs'], templateCapacityWarning: { guestCount: 120, minGuests: 20, maxGuests: 80 } });
  });
});
