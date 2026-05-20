/**
 * Test helpers: create realistic users/orgs/events without ceremony.
 * Each call returns the row + a JWT for authentication in HTTP tests.
 */
import { hashPassword } from '../lib/crypto.js';
import { slugify } from '../lib/slug.js';
import { orgsRepo, usersRepo, eventsRepo, guestsRepo } from '../db/repos/index.js';
import type { FastifyInstance } from 'fastify';

let counter = 0;
const uniqueEmail = (prefix = 'test') => `${prefix}-${++counter}-${Date.now()}@example.com`;

export function makeUser(opts: { email?: string; password?: string; fullName?: string } = {}) {
  const email = opts.email ?? uniqueEmail();
  const password = opts.password ?? 'testpass123';
  const pwd = hashPassword(password);
  const user = usersRepo.create({
    email,
    fullName: opts.fullName ?? 'Test User',
    passwordHash: pwd.passwordHash,
    passwordSalt: pwd.passwordSalt,
  });
  return { user, password };
}

export function makeOrg(ownerId: string, name = `Org-${++counter}`) {
  const id = orgsRepo.createWithOwner({ name, slug: `${slugify(name)}-${id6()}`, ownerId });
  return orgsRepo.findById(id)!;
}

export function makeEvent(orgId: string, createdBy: string, title = `Wedding-${++counter}`) {
  return eventsRepo.create({
    organizationId: orgId,
    title,
    createdBy,
    startDate: '2026-12-31',
  });
}

export function makeGuest(orgId: string, eventId: string, name = `Guest-${++counter}`) {
  return guestsRepo.create(orgId, eventId, { fullName: name });
}

export function signTokenForUser(app: FastifyInstance, userId: string, email: string, sv = 1): string {
  return app.jwt.sign({ sub: userId, email, sv });
}

function id6() { return Math.random().toString(36).slice(2, 8); }
