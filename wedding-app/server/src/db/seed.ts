/**
 * Idempotent seed: demo user, org, sample event, sample guests.
 * Run:  npm run seed
 */
import { hashPassword } from '../lib/crypto.js';
import {
  eventsRepo, guestsRepo, orgsRepo, usersRepo,
  catalogRepo, vendorsRepo, timelineRepo, staffTasksRepo,
} from './repos/index.js';
import { slugify } from '../lib/slug.js';

const DEMO_EMAIL = 'owner@demo.local';
const DEMO_PASSWORD = 'wedding123';

let user = usersRepo.findByEmail(DEMO_EMAIL);
if (!user) {
  const pwd = hashPassword(DEMO_PASSWORD);
  user = usersRepo.create({
    email: DEMO_EMAIL, fullName: 'Demo Venue Owner',
    passwordHash: pwd.passwordHash, passwordSalt: pwd.passwordSalt,
  });
  console.log(`[seed] created user ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
} else {
  console.log(`[seed] user ${DEMO_EMAIL} already exists`);
}

const existingOrgs = orgsRepo.listForUser(user.id);
let orgId: string;
if (existingOrgs.length === 0) {
  orgId = orgsRepo.createWithOwner({
    name: 'Seven Paths Manor', slug: `seven-paths-manor-${user.id.slice(0,6)}`, ownerId: user.id,
  });
  console.log(`[seed] created organization Seven Paths Manor (${orgId})`);

  // Seed a few catalog items so the app feels populated
  catalogRepo.create(orgId, { kind: 'table', name: 'Round 6ft (10 seats)', spec: { capacity: 10, shape: 'circle' } });
  catalogRepo.create(orgId, { kind: 'table', name: 'Rectangle 8ft (8 seats)', spec: { capacity: 8, shape: 'rectangle' } });
  catalogRepo.create(orgId, { kind: 'chair', name: 'Chiavari Gold', spec: {} });
  catalogRepo.create(orgId, { kind: 'chair', name: 'Folding White', spec: {} });
  catalogRepo.create(orgId, { kind: 'linen', name: 'Ivory', spec: { color: '#fff8e7' } });
  catalogRepo.create(orgId, { kind: 'linen', name: 'Burgundy', spec: { color: '#80142b' } });
  console.log(`[seed] added 6 catalog items`);
} else {
  orgId = existingOrgs[0].id;
  console.log(`[seed] reusing org ${existingOrgs[0].name} (${orgId})`);
}

const events = eventsRepo.listForOrg(orgId);
let eventId: string;
if (events.length === 0) {
  const event = eventsRepo.create({
    organizationId: orgId, title: 'Smith and Jones Wedding',
    startDate: '2026-09-12', endDate: '2026-09-12',
    createdBy: user.id, status: 'booked', guestCount: 80,
  });
  eventId = event.id;
  console.log(`[seed] created event Smith and Jones (${event.id})`);

  for (const name of ['Aunt Mary', 'Uncle Bob', 'Cousin Lin', 'Best Man Tom', 'Maid of Honor Lisa']) {
    guestsRepo.create(orgId, event.id, {
      fullName: name,
      plusOneAllowed: name.includes('Best Man') || name.includes('Maid'),
    });
  }
  console.log(`[seed] seeded 5 sample guests`);

  // Sample vendor + timeline + staff task
  vendorsRepo.create(orgId, {
    name: 'Sunshine DJs', category: 'music',
    contractAmountCents: 150_000, isPreferred: true, eventId: event.id,
  });
  timelineRepo.create(orgId, event.id, {
    title: 'Ceremony', startsAt: '2026-09-12T16:00:00Z', durationMin: 30,
  });
  timelineRepo.create(orgId, event.id, {
    title: 'Reception', startsAt: '2026-09-12T17:30:00Z', durationMin: 240,
  });
  staffTasksRepo.create(orgId, user.id, {
    title: 'Set up reception chairs', priority: 'high', phase: 'pre-event',
  });
} else {
  eventId = events[0].id;
  console.log(`[seed] reusing event ${events[0].id}`);
}

console.log('');
console.log('----------------------------------------------');
console.log(`Demo login:   ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
console.log(`Org id:       ${orgId}`);
console.log(`Event id:     ${eventId}`);
console.log(`Portal URL:   http://localhost:3000/#/portal/${eventId}`);
console.log('----------------------------------------------');
