import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import { orgsRepo, usersRepo, rolesRepo, staffTasksRepo } from '../db/repos/index.js';

import { applyAllMigrations } from '../db/migrate.js';

describe('Staff RBAC Integration', () => {
  let app: FastifyInstance;
  let orgId: string;
  let adminToken: string;
  let staffToken: string;
  let staffId: string;
  let ownerId: string;

  beforeEach(async () => {
    applyAllMigrations();
    const { rolesRepo } = await import('../db/repos/index.js'); rolesRepo.ensureSystemRoles();
    app = await buildApp();
    db.exec('BEGIN');

    const owner = usersRepo.create({ email: 'owner@test.com', fullName: 'Owner', passwordHash: 'x', passwordSalt: 'x' });
    ownerId = owner.id;
    orgId = orgsRepo.createWithOwner({ name: 'Test Org', slug: 'test-org', ownerId: owner.id });

    // Create a staff user
    const staff = usersRepo.create({ email: 'staff@test.com', fullName: 'Staff', passwordHash: 'x', passwordSalt: 'x' });
    staffId = staff.id;
    
    // Create roles
    const staffRole = rolesRepo.createCustom({ organizationId: orgId, key: 'test_staff', name: 'Staff', createdBy: owner.id, hierarchy: 10, permissions: ['staff.view'] as any[] });
    orgsRepo.addMember({ orgId, userId: staff.id, roleId: staffRole.id });

    // Get tokens
    adminToken = app.jwt.sign({ sub: owner.id, email: owner.email, sv: owner.session_version });
    staffToken = app.jwt.sign({ sub: staff.id, email: staff.email, sv: staff.session_version });
  });

  afterEach(async () => {
    db.exec('ROLLBACK');
    await app.close();
  });

  it('restricts staff to see only their assigned tasks', async () => {
    // Admin creates two tasks
    staffTasksRepo.create(orgId, ownerId, { title: 'Admin Task', assignedStaff: [] });
    staffTasksRepo.create(orgId, ownerId, { title: 'Staff Task', assignedStaff: [staffId] });

    // Admin should see both tasks
    const adminRes = await app.inject({
      method: 'GET',
      url: `/api/orgs/${orgId}/staff/tasks`,
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(adminRes.statusCode).toBe(200);
    const adminData = JSON.parse(adminRes.payload);
    expect(adminData.tasks).toHaveLength(2);

    // Staff should see only their assigned task
    const staffRes = await app.inject({
      method: 'GET',
      url: `/api/orgs/${orgId}/staff/tasks`,
      headers: { authorization: `Bearer ${staffToken}` }
    });
    expect(staffRes.statusCode).toBe(200);
    const staffData = JSON.parse(staffRes.payload);
    expect(staffData.tasks).toHaveLength(1);
    expect(staffData.tasks[0].title).toBe('Staff Task');
  });

  it('persists day-of task contact fields for quick call and SMS actions', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/orgs/${orgId}/staff/tasks`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        title: 'Captain radio check',
        assigneeName: 'Day-of Captain',
        assigneePhone: '555-210-9999',
        assigneeEmail: 'captain@example.com',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.payload);
    expect(created.task.assignee_name).toBe('Day-of Captain');
    expect(created.task.assignee_phone).toBe('555-210-9999');
    expect(created.task.assignee_email).toBe('captain@example.com');

    const updateRes = await app.inject({
      method: 'PATCH',
      url: `/api/staff/tasks/${created.task.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { assigneePhone: '555-210-0001' },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(JSON.parse(updateRes.payload).task.assignee_phone).toBe('555-210-0001');
  });

  it('allows staff to clock in and out of their assigned shifts', async () => {
    const { staffShiftsRepo } = await import('../db/repos/index.js');
    const shift = staffShiftsRepo.create(orgId, {
      staffId: staffId,
      startsAt: '2026-06-05T10:00:00Z',
      endsAt: '2026-06-05T18:00:00Z',
      role: 'setup',
    });

    // Staff clocks in
    const clockInRes = await app.inject({
      method: 'POST',
      url: `/api/staff/shifts/${shift.id}/clock-in`,
      headers: { authorization: `Bearer ${staffToken}` }
    });
    expect(clockInRes.statusCode).toBe(200);
    const clockInData = JSON.parse(clockInRes.payload);
    expect(clockInData.shift.clocked_in_at).toBeTruthy();
    expect(clockInData.shift.clocked_out_at).toBeNull();

    // Staff clocks out
    const clockOutRes = await app.inject({
      method: 'POST',
      url: `/api/staff/shifts/${shift.id}/clock-out`,
      headers: { authorization: `Bearer ${staffToken}` }
    });
    expect(clockOutRes.statusCode).toBe(200);
    const clockOutData = JSON.parse(clockOutRes.payload);
    expect(clockOutData.shift.clocked_in_at).toBeTruthy();
    expect(clockOutData.shift.clocked_out_at).toBeTruthy();
  });
});
