/**
 * Optional: insert a demo venue owner + sample event so you can poke at
 * the API immediately. Safe to re-run (uses INSERT OR IGNORE semantics
 * via email uniqueness check).
 *
 * Run with:  npm run seed
 *
 * Console output uses only ASCII so it renders cleanly on Windows
 * PowerShell 5.1 (which uses the OEM/ANSI code page by default).
 * Database-stored strings still use full UTF-8 (e.g. the wedding title
 * below) since they are read by Node + the browser, both UTF-8 native.
 */
import { hashPassword } from '../lib/crypto.js';
import {
  eventsRepo,
  guestsRepo,
  orgsRepo,
  usersRepo,
} from './repos.js';

const DEMO_EMAIL = 'owner@demo.local';
const DEMO_PASSWORD = 'wedding123';

let user = usersRepo.findByEmail(DEMO_EMAIL);
if (!user) {
  const pwd = hashPassword(DEMO_PASSWORD);
  user = usersRepo.create({
    email: DEMO_EMAIL,
    fullName: 'Demo Venue Owner',
    passwordHash: pwd.passwordHash,
    passwordSalt: pwd.passwordSalt,
  });
  console.log(`[seed] created user ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
} else {
  console.log(`[seed] user ${DEMO_EMAIL} already exists`);
}

const existingOrgs = orgsRepo.listForUser(user.id) as Array<{ id: string; name: string }>;
let orgId: string;
if (existingOrgs.length === 0) {
  orgId = orgsRepo.createWithOwner({
    name: 'Seven Paths Manor',
    slug: 'seven-paths-manor',
    ownerId: user.id,
  });
  console.log(`[seed] created organization Seven Paths Manor (${orgId})`);
} else {
  orgId = existingOrgs[0].id;
  console.log(`[seed] reusing org ${existingOrgs[0].name} (${orgId})`);
}

const events = eventsRepo.listForOrg(orgId);
let eventId: string;
if (events.length === 0) {
  const event = eventsRepo.create({
    organizationId: orgId,
    title: 'Smith and Jones Wedding',
    slug: `smith-jones-${Date.now().toString(36)}`,
    startDate: '2026-09-12',
    endDate: '2026-09-12',
    createdBy: user.id,
  });
  eventId = event.id;
  console.log(`[seed] created event Smith and Jones (${event.id})`);

  for (const name of ['Aunt Mary', 'Uncle Bob', 'Cousin Lin']) {
    guestsRepo.create({
      organizationId: orgId,
      eventId: event.id,
      fullName: name,
      plusOneAllowed: name === 'Uncle Bob',
    });
  }
  console.log(`[seed] seeded 3 sample guests`);
} else {
  eventId = events[0].id;
  console.log(`[seed] reusing event ${events[0].id}`);
}

console.log('');
console.log('----------------------------------------------');
console.log(`Demo login:   ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
console.log(`Org id:       ${orgId}`);
console.log(`Event id:     ${eventId}`);
console.log(`Portal URL:   http://localhost:3000/portal/${eventId}`);
console.log('----------------------------------------------');
