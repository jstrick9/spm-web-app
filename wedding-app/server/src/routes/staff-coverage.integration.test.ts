import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import type { FastifyInstance } from 'fastify';
let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => { for (const table of ['staff_shifts','events','organization_memberships','organizations','users']) { try { db.prepare(`DELETE FROM ${table}`).run(); } catch {} } });
describe('Venue staffing coverage', () => { it('groups shifts by event and flags overlapping staff coverage', async () => {
 const registration = await app.inject({ method:'POST', url:'/api/auth/register', payload:{ email:`coverage-${Math.random()}@test.com`, password:'password123', fullName:'Manager', orgName:'Seven Paths Manor' } }); const token=registration.json().token; const orgId=registration.json().organizationId; const userId=registration.json().user.id;
 const event=await app.inject({method:'POST',url:'/api/events',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},payload:{organizationId:orgId,title:'Coverage Wedding'}}); const eventId=event.json().event.id;
 db.prepare(`INSERT INTO staff_tasks (id, organization_id, event_id, title, status) VALUES ('task-coverage', ?, ?, 'Resolve rental count', 'blocked')`).run(orgId,eventId);
 for (const [id,start,end] of [['shift-1','2027-01-01T10:00:00Z','2027-01-01T14:00:00Z'],['shift-2','2027-01-01T13:00:00Z','2027-01-01T17:00:00Z']] as const) db.prepare(`INSERT INTO staff_shifts (id, organization_id, event_id, staff_id, role, starts_at, ends_at) VALUES (?, ?, ?, ?, 'setup', ?, ?)`).run(id,orgId,eventId,userId,start,end);
 const res=await app.inject({method:'GET',url:`/api/orgs/${orgId}/staff/coverage`,headers:{authorization:`Bearer ${token}`}}); expect(res.statusCode).toBe(200); expect(res.json().coverage.events[0]).toMatchObject({eventId,staffCount:1, taskCount:1, blockedTaskCount:1, missingRoles:['coordinator']}); expect(res.json().coverage.conflicts).toContain('shift-1'); expect(res.json().coverage.conflictDetails[0]).toMatchObject({ shiftId:'shift-1', conflictingShiftId:'shift-2' }); expect(res.json().coverage.staff[0]).toMatchObject({ staffId: userId, shiftCount: 2, eventCount: 1, conflictCount: 2 });
}); });
