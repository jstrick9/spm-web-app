import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../index.js'; import { db } from '../db/database.js'; import type { FastifyInstance } from 'fastify';
let app: FastifyInstance; beforeAll(async()=>{app=await buildApp();await app.ready();}); beforeEach(()=>{for(const t of ['staff_weekly_availability','organization_memberships','organizations','users']){try{db.prepare(`DELETE FROM ${t}`).run();}catch{}}});
describe('Staff weekly availability',()=>{it('lets staff maintain their own weekly hours and managers view them',async()=>{const r=await app.inject({method:'POST',url:'/api/auth/register',payload:{email:`availability-${Math.random()}@test.com`,password:'password123',fullName:'Staff',orgName:'Seven Paths Manor'}});const token=r.json().token,orgId=r.json().organizationId,userId=r.json().user.id;const created=await app.inject({method:'POST',url:`/api/orgs/${orgId}/staff/availability`,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},payload:{staffId:userId,dayOfWeek:1,startsAt:'09:00',endsAt:'17:00'}});expect(created.statusCode).toBe(201);const removed=await app.inject({method:'DELETE',url:`/api/staff/availability/${created.json().availability.id}`,headers:{authorization:`Bearer ${token}`}});expect(removed.statusCode).toBe(204);const recreated=await app.inject({method:'POST',url:`/api/orgs/${orgId}/staff/availability`,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},payload:{staffId:userId,dayOfWeek:1,startsAt:'09:00',endsAt:'17:00'}});expect(recreated.statusCode).toBe(201);const list=await app.inject({method:'GET',url:`/api/orgs/${orgId}/staff/availability?staffId=${userId}`,headers:{authorization:`Bearer ${token}`}});expect(list.json().availability[0]).toMatchObject({staff_id:userId,day_of_week:1,starts_at:'09:00',ends_at:'17:00'});
const event=await app.inject({method:'POST',url:'/api/events',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},payload:{organizationId:orgId,title:'Availability Wedding'}});const shiftPayload={staffId:userId,eventId:event.json().event.id,startsAt:'2027-01-04T18:00:00.000Z',endsAt:'2027-01-04T19:00:00.000Z'};
const blocked=await app.inject({method:'POST',url:`/api/orgs/${orgId}/staff/shifts`,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},payload:shiftPayload});expect(blocked.statusCode).toBe(400);expect(blocked.json().error).toBe('staff-availability-override-required');
const overridden=await app.inject({method:'POST',url:`/api/orgs/${orgId}/staff/shifts`,headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},payload:{...shiftPayload,availabilityOverrideReason:'Wedding-day coverage exception'}});expect(overridden.statusCode).toBe(201);expect(overridden.json().shift.availability_override_reason).toBe('Wedding-day coverage exception');expect((db.prepare(`SELECT action FROM audit_logs WHERE target_id=?`).get(overridden.json().shift.id) as any).action).toBe('staff.shift.availability_override');});
it('enforces availability on LOCAL weekday/clock (US timezone regression)', async () => {
    const prevTz = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      const r = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: `availtz-${Math.random()}@test.com`, password: 'password123', fullName: 'Staff', orgName: 'Seven Paths Manor' }, headers: { 'content-type': 'application/json' } });
      const token = r.json().token, orgId = r.json().organizationId, userId = r.json().user.id;
      // Monday 09:00-17:00 LOCAL availability.
      await app.inject({ method: 'POST', url: `/api/orgs/${orgId}/staff/availability`, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { staffId: userId, dayOfWeek: 1, startsAt: '09:00', endsAt: '17:00' } });
      const evt = await app.inject({ method: 'POST', url: '/api/events', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { organizationId: orgId, title: 'Availability TZ Wedding' } });

      // 9am-5pm Monday LOCAL shift — EXACTLY matches availability. The old
      // UTC-clock comparison (14:00-22:00 UTC) rejected it and forced a fake
      // override reason on every US shift.
      const within = await app.inject({ method: 'POST', url: `/api/orgs/${orgId}/staff/shifts`, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { staffId: userId, eventId: evt.json().event.id, startsAt: '2027-01-04T09:00:00', endsAt: '2027-01-04T17:00:00' } });
      expect(within.statusCode).toBe(201);

      // 8pm-9pm Monday LOCAL — outside the window, and Monday (NOT Tuesday,
      // which the old UTC-weekday lookup would check); must demand an
      // override.
      const outside = await app.inject({ method: 'POST', url: `/api/orgs/${orgId}/staff/shifts`, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { staffId: userId, eventId: evt.json().event.id, startsAt: '2027-01-04T20:00:00', endsAt: '2027-01-04T21:00:00' } });
      expect(outside.statusCode).toBe(400);
      expect(outside.json().error).toBe('staff-availability-override-required');
      expect(outside.json().details.dayOfWeek).toBe(1); // Monday, not Tuesday
    } finally {
      if (prevTz === undefined) delete process.env.TZ; else process.env.TZ = prevTz;
    }
  });
});
