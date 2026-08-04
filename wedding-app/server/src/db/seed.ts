/**
 * Idempotent seed: creates a rich demo environment.
 *
 * Run:  npm run seed
 *
 * Phase 23: expanded from 1 event + 5 guests to a full demo:
 *   - 4 events across pipeline stages
 *   - 20+ guests with diverse RSVPs
 *   - 5 vendors with payments
 *   - Budget items, timeline, contracts, inventory
 */
import { hashPassword } from '../lib/crypto.js';
import { applyAllMigrations } from './migrate.js';
import {
  eventsRepo, guestsRepo, orgsRepo, usersRepo,
  catalogRepo, vendorsRepo, timelineRepo, staffTasksRepo,
  rolesRepo,
} from './repos/index.js';
import { budgetRepo } from './repos/budget.js';
import { contractsRepo } from './repos/contracts.js';
import { inventoryRepo } from './repos/inventory.js';
import { emailTemplatesRepo } from './repos/emailTemplates.js';
import { emailAutomationsRepo } from './repos/emailAutomations.js';

// Self-healing: apply pending migrations so `npm run seed` works against a
// database that predates newer migrations (idempotent via schema_version).
applyAllMigrations();

rolesRepo.ensureSystemRoles();

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
  orgId = orgsRepo.createWithOwner({ name: 'Seven Paths Manor', slug: 'seven-paths-manor', ownerId: user.id });
  console.log(`[seed] created organization Seven Paths Manor (${orgId})`);

  // Catalog items
  catalogRepo.create(orgId, { kind: 'table', name: 'Round 6ft (10 seats)', spec: { capacity: 10, shape: 'circle' } });
  catalogRepo.create(orgId, { kind: 'table', name: 'Rectangle 8ft (8 seats)', spec: { capacity: 8, shape: 'rectangle' } });
  catalogRepo.create(orgId, { kind: 'table', name: 'Cocktail High-Top', spec: { capacity: 4, shape: 'circle' } });
  catalogRepo.create(orgId, { kind: 'chair', name: 'Chiavari Gold', spec: {} });
  catalogRepo.create(orgId, { kind: 'chair', name: 'Folding White', spec: {} });
  catalogRepo.create(orgId, { kind: 'linen', name: 'Ivory', spec: { color: '#fff8e7' } });
  catalogRepo.create(orgId, { kind: 'linen', name: 'Burgundy', spec: { color: '#80142b' } });
  catalogRepo.create(orgId, { kind: 'linen', name: 'Navy', spec: { color: '#1e3a5f' } });
  console.log(`[seed] added 8 catalog items`);

  // Inventory
  inventoryRepo.create(orgId, { name: 'Gold Chiavari Chair', sku: 'CHR-001', category: 'chair', totalCount: 200, availableCount: 185, createdBy: user.id });
  inventoryRepo.create(orgId, { name: '120" Round Linen - White', sku: 'LIN-120-WHT', category: 'linen', totalCount: 40, availableCount: 38, createdBy: user.id });
  inventoryRepo.create(orgId, { name: 'Wireless Uplight (RGB)', sku: 'AV-UP-01', category: 'av', totalCount: 24, availableCount: 4, condition: 'maintenance', ownerType: 'vendor_rental', createdBy: user.id });
  inventoryRepo.create(orgId, { name: 'Tall Glass Cylinder Vase', sku: 'DEC-VASE-01', category: 'centerpiece', totalCount: 30, availableCount: 28, createdBy: user.id });
  inventoryRepo.create(orgId, { name: 'LED String Lights (100ft)', sku: 'LGT-STR-01', category: 'lighting', totalCount: 12, availableCount: 10, createdBy: user.id });
  console.log(`[seed] added 5 inventory items`);
} else {
  orgId = existingOrgs[0].id;
  console.log(`[seed] reusing org ${existingOrgs[0].name} (${orgId})`);
}

const events = eventsRepo.listForOrg(orgId);
if (events.length === 0) {
  // ─── Event 1: Booked wedding (the main demo event) ────
  const e1 = eventsRepo.create({
    organizationId: orgId, title: 'Smith & Jones Wedding',
    startDate: '2026-09-12', endDate: '2026-09-12',
    createdBy: user.id, status: 'booked', guestCount: 120,
    budgetCents: 4500000,
  });
  console.log(`[seed] created event: Smith & Jones Wedding`);

  // 15 guests with varied RSVPs
  const guestData = [
    { name: 'Sarah Johnson', rsvp: 'attending' as const, table: 'Head Table', dietary: null, party: 'Bride Family' },
    { name: 'Michael Johnson', rsvp: 'attending' as const, table: 'Head Table', dietary: null, party: 'Bride Family' },
    { name: 'Aunt Mary Smith', rsvp: 'attending' as const, table: 'Table 1', dietary: 'Vegetarian', party: 'Bride Family' },
    { name: 'Uncle Bob Smith', rsvp: 'attending' as const, table: 'Table 1', dietary: null, party: 'Bride Family' },
    { name: 'Cousin Lin Torres', rsvp: 'maybe' as const, table: null, dietary: 'Gluten-free', party: 'Bride Family' },
    { name: 'Tom Williams', rsvp: 'attending' as const, table: 'Table 2', dietary: null, party: 'Best Man' },
    { name: 'Lisa Anderson', rsvp: 'attending' as const, table: 'Table 2', dietary: 'Vegan', party: 'Maid of Honor' },
    { name: 'David Chen', rsvp: 'attending' as const, table: 'Table 3', dietary: null, party: 'Groom Friends' },
    { name: 'Emma Rodriguez', rsvp: 'pending' as const, table: null, dietary: null, party: 'Groom Friends' },
    { name: 'James Wilson', rsvp: 'pending' as const, table: null, dietary: null, party: 'Groom Friends' },
    { name: 'Olivia Brown', rsvp: 'declined' as const, table: null, dietary: null, party: 'Colleagues' },
    { name: 'Daniel Kim', rsvp: 'attending' as const, table: 'Table 4', dietary: 'Kosher', party: 'Colleagues' },
    { name: 'Sophia Martinez', rsvp: 'attending' as const, table: 'Table 4', dietary: null, party: 'Colleagues' },
    { name: 'Grandma Rose Smith', rsvp: 'attending' as const, table: 'Table 1', dietary: null, party: 'Bride Family', accessibility: 'Wheelchair access needed' },
    { name: 'Dr. Patricia Lee', rsvp: 'pending' as const, table: null, dietary: 'Pescatarian', party: 'Family Friends' },
  ];
  for (const g of guestData) {
    guestsRepo.create(orgId, e1.id, {
      fullName: g.name, rsvpStatus: g.rsvp,
      tableAssignment: g.table ?? undefined,
      dietaryRestrictions: g.dietary ?? undefined,
      partyName: g.party,
      accessibilityNotes: (g as any).accessibility ?? undefined,
      plusOneAllowed: g.party === 'Best Man' || g.party === 'Maid of Honor',
    });
  }
  console.log(`[seed] seeded 15 guests for Smith & Jones`);

  // 5 vendors with payments
  const v1 = vendorsRepo.create(orgId, { name: 'Sunshine DJs', category: 'DJ / Music', contactName: 'DJ Ray', email: 'ray@sunshinedjs.com', phone: '555-0101', contractAmountCents: 250000, isPreferred: true, eventId: e1.id });
  vendorsRepo.addPayment(v1.id, { amountCents: 125000, paidAt: '2026-06-01', method: 'check' });
  const v2 = vendorsRepo.create(orgId, { name: 'Bloom & Petal Florals', category: 'Florist', contactName: 'Maria Flores', email: 'maria@bloomandpetal.com', contractAmountCents: 350000, isPreferred: true, eventId: e1.id });
  vendorsRepo.addPayment(v2.id, { amountCents: 175000, paidAt: '2026-07-15', method: 'card' });
  const v3 = vendorsRepo.create(orgId, { name: 'Capture Studios', category: 'Photography', contactName: 'Alex Photo', email: 'alex@capture.com', contractAmountCents: 450000, eventId: e1.id });
  vendorsRepo.addPayment(v3.id, { amountCents: 450000, paidAt: '2026-08-01', method: 'wire' });
  vendorsRepo.create(orgId, { name: 'Sweet Endings Bakery', category: 'Catering', contactName: 'Chef Anna', email: 'anna@sweetendings.com', contractAmountCents: 180000, eventId: e1.id });
  vendorsRepo.create(orgId, { name: 'Premier Linens', category: 'Rentals', contractAmountCents: 120000, eventId: e1.id });
  console.log(`[seed] seeded 5 vendors with payments`);

  // Budget items
  budgetRepo.create(orgId, e1.id, { category: 'Venue', title: 'Base Rental Fee', plannedCents: 1200000, actualCents: 1200000, paidCents: 600000 }, user.id);
  budgetRepo.create(orgId, e1.id, { category: 'Catering', title: 'Dinner Service (120 pax)', plannedCents: 960000, actualCents: 1020000, paidCents: 500000 }, user.id);
  budgetRepo.create(orgId, e1.id, { category: 'Florals', title: 'Arch + Centerpieces', plannedCents: 350000 }, user.id);
  budgetRepo.create(orgId, e1.id, { category: 'Photography', title: 'Full Day + Album', plannedCents: 450000, actualCents: 450000, paidCents: 450000 }, user.id);
  budgetRepo.create(orgId, e1.id, { category: 'DJ / Music', title: 'Ceremony + Reception', plannedCents: 250000, paidCents: 125000 }, user.id);
  budgetRepo.create(orgId, e1.id, { category: 'Cake', title: 'Custom 4-tier', plannedCents: 180000 }, user.id);
  budgetRepo.create(orgId, e1.id, { category: 'Rentals', title: 'Linens & Tableware', plannedCents: 120000 }, user.id);
  console.log(`[seed] seeded 7 budget items`);

  // Timeline
  timelineRepo.create(orgId, e1.id, { title: 'Vendor Load-In', startsAt: '2026-09-12T10:00:00Z', durationMin: 120, category: 'setup' });
  timelineRepo.create(orgId, e1.id, { title: 'Guest Arrival & Cocktails', startsAt: '2026-09-12T15:30:00Z', durationMin: 60, category: 'ceremony' });
  timelineRepo.create(orgId, e1.id, { title: 'Ceremony', startsAt: '2026-09-12T16:30:00Z', durationMin: 30, category: 'ceremony' });
  timelineRepo.create(orgId, e1.id, { title: 'Family Photos', startsAt: '2026-09-12T17:00:00Z', durationMin: 45, category: 'ceremony' });
  timelineRepo.create(orgId, e1.id, { title: 'Reception & Dinner', startsAt: '2026-09-12T18:00:00Z', durationMin: 180, category: 'reception' });
  timelineRepo.create(orgId, e1.id, { title: 'First Dance', startsAt: '2026-09-12T19:30:00Z', durationMin: 5, category: 'reception' });
  timelineRepo.create(orgId, e1.id, { title: 'Cake Cutting', startsAt: '2026-09-12T20:00:00Z', durationMin: 15, category: 'reception' });
  timelineRepo.create(orgId, e1.id, { title: 'Dance Floor Opens', startsAt: '2026-09-12T20:30:00Z', durationMin: 150, category: 'reception' });
  timelineRepo.create(orgId, e1.id, { title: 'Send-Off', startsAt: '2026-09-12T23:00:00Z', durationMin: 30, category: 'teardown' });
  console.log(`[seed] seeded 9 timeline items`);

  // Contracts
  contractsRepo.create({ organizationId: orgId, eventId: e1.id, title: 'Master Venue Agreement', recipientName: 'Sarah Johnson', amountCents: 1200000, content: 'This Master Venue Agreement is entered into between Seven Paths Manor and the Client for the exclusive use of the venue on the date specified.', createdBy: user.id });
  contractsRepo.create({ organizationId: orgId, eventId: e1.id, title: 'Photography Package', recipientName: 'Alex Photo', recipientEmail: 'alex@capture.com', amountCents: 450000, createdBy: user.id });
  console.log(`[seed] seeded 2 contracts`);

  // Staff tasks
  staffTasksRepo.create(orgId, user.id, { title: 'Set up ceremony chairs (120)', priority: 'high', phase: 'pre-event', estimatedMinutes: 90, assigneeName: 'Setup Lead', assigneePhone: '555-210-1001' });
  staffTasksRepo.create(orgId, user.id, { title: 'Arrange centerpieces on tables', priority: 'medium', phase: 'pre-event', estimatedMinutes: 60, assigneeName: 'Decor Captain', assigneePhone: '555-210-1002' });
  staffTasksRepo.create(orgId, user.id, { title: 'Sound check with DJ', priority: 'high', phase: 'pre-event', estimatedMinutes: 30, assigneeName: 'AV Lead', assigneePhone: '555-210-1003' });
  staffTasksRepo.create(orgId, user.id, { title: 'Welcome guests and direct parking', priority: 'medium', phase: 'during-event', assigneeName: 'Parking Lead', assigneePhone: '555-210-1004' });
  staffTasksRepo.create(orgId, user.id, { title: 'Break down tables and clean', priority: 'low', phase: 'post-event', estimatedMinutes: 120, assigneeName: 'Cleanup Lead', assigneePhone: '555-210-1005' });
  console.log(`[seed] seeded 5 staff tasks`);

  // ─── Event 2: Planning stage ──────────────────────────
  const e2 = eventsRepo.create({
    organizationId: orgId, title: 'Davis Garden Reception',
    startDate: '2026-10-18', endDate: '2026-10-18',
    createdBy: user.id, status: 'planning', guestCount: 75,
    budgetCents: 2800000,
  });
  for (const name of ['Mark Davis', 'Jennifer Davis', 'Robert Park', 'Grace Lee', 'Tommy Nguyen']) {
    guestsRepo.create(orgId, e2.id, { fullName: name, rsvpStatus: 'pending' });
  }
  console.log(`[seed] created event: Davis Garden Reception`);

  // ─── Event 3: Lead (inquiry) ──────────────────────────
  eventsRepo.create({
    organizationId: orgId, title: 'Thompson-Baker Celebration',
    startDate: '2026-12-05', endDate: '2026-12-05',
    createdBy: user.id, status: 'lead', guestCount: 200,
    budgetCents: 7500000,
  });
  console.log(`[seed] created event: Thompson-Baker (lead)`);

  // ─── Event 4: Completed (past) ────────────────────────
  const e4 = eventsRepo.create({
    organizationId: orgId, title: 'Martinez Wedding',
    startDate: '2026-03-15', endDate: '2026-03-15',
    createdBy: user.id, status: 'completed', guestCount: 95,
    budgetCents: 3200000,
  });
  for (const name of ['Carlos Martinez', 'Ana Martinez', 'Pedro Garcia', 'Sofia Reyes', 'Diego Hernandez', 'Isabella Cruz', 'Luis Torres', 'Carmen Flores']) {
    guestsRepo.create(orgId, e4.id, { fullName: name, rsvpStatus: 'attending', tableAssignment: `Table ${Math.ceil(Math.random() * 5)}` });
  }
  console.log(`[seed] created event: Martinez Wedding (completed)`);

  // ─── Event 5: At-risk near-term event (for risk alerts demo) ──
  // Intentionally light on prep so the Event Health panel surfaces alerts.
  const soon = new Date(); soon.setDate(soon.getDate() + 9);
  const soonStr = soon.toISOString().slice(0, 10);
  const e5 = eventsRepo.create({
    organizationId: orgId, title: 'Patel Engagement Party',
    startDate: soonStr, endDate: soonStr,
    createdBy: user.id, status: 'booked', guestCount: 60, budgetCents: 1800000,
  });
  // Mostly-pending guest list with a near RSVP deadline.
  const rsvpDeadline = new Date(); rsvpDeadline.setDate(rsvpDeadline.getDate() + 4);
  eventsRepo.update(e5.id, { rsvp_deadline: rsvpDeadline.toISOString().slice(0, 10) } as never);
  for (const name of ['Priya Patel', 'Raj Patel', 'Sam Cohen', 'Dana Wu', 'Leo Park']) {
    guestsRepo.create(orgId, e5.id, { fullName: name, rsvpStatus: 'pending' });
  }
  // An unsigned contract + an overrun budget line; no vendors/timeline yet.
  contractsRepo.create({ organizationId: orgId, eventId: e5.id, title: 'Venue Hold Agreement', recipientName: 'Priya Patel', amountCents: 800000, createdBy: user.id });
  budgetRepo.create(orgId, e5.id, { category: 'Catering', title: 'Appetizers', plannedCents: 400000, actualCents: 560000, paidCents: 50000 }, user.id);
  console.log(`[seed] created event: Patel Engagement Party (at-risk demo)`);

  // ─── Lifecycle email templates + automations ──────────
  const reminderTpl = emailTemplatesRepo.create(orgId, {
    name: 'RSVP Reminder',
    subject: 'Kind reminder: please RSVP for {{event_title}}',
    bodyHtml: '<p>Hi {{guest_name}},</p><p>We can\u2019t wait to celebrate {{event_title}} on {{event_date}} at {{venue_name}}! ' +
      'Please let us know if you can join us by visiting your guest portal:</p><p><a href="{{portal_link}}">RSVP now</a></p>',
    bodyText: 'Hi {{guest_name}}, please RSVP for {{event_title}} on {{event_date}}: {{portal_link}}',
    category: 'rsvp_reminder', createdBy: user.id,
  });
  const thankYouTpl = emailTemplatesRepo.create(orgId, {
    name: 'Thank You',
    subject: 'Thank you for celebrating {{event_title}} with us!',
    bodyHtml: '<p>Dear {{guest_name}},</p><p>Thank you for joining us at {{venue_name}} for {{event_title}}. ' +
      'It meant the world to have you there. With love and gratitude.</p>',
    bodyText: 'Dear {{guest_name}}, thank you for celebrating {{event_title}} with us at {{venue_name}}.',
    category: 'thank_you', createdBy: user.id,
  });
  emailAutomationsRepo.upsert({ organizationId: orgId, templateId: reminderTpl.id, triggerType: 'rsvp_reminder', offsetDays: 14, enabled: true, createdBy: user.id });
  emailAutomationsRepo.upsert({ organizationId: orgId, templateId: thankYouTpl.id, triggerType: 'thank_you', enabled: true, createdBy: user.id });
  console.log(`[seed] created 2 email templates + 2 lifecycle automations`);

  // ─── Historical completed events (for forecasting) ────
  // 18 months of past weddings with a gentle upward trend + summer seasonality,
  // so the predictive Revenue Forecast has real signal to learn from.
  const now = new Date();
  const SEASON = [0.6, 0.6, 0.8, 1.0, 1.3, 1.6, 1.5, 1.4, 1.3, 1.1, 0.7, 0.5]; // Jan..Dec multipliers
  for (let i = 18; i >= 1; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 12));
    const monthIdx = d.getUTCMonth();
    const seasonal = SEASON[monthIdx];
    const eventsThisMonth = Math.max(0, Math.round(seasonal * (1 + (18 - i) * 0.04))); // grows over time
    for (let k = 0; k < eventsThisMonth; k++) {
      const base = 2800000 + Math.round((18 - i) * 60000); // budgets drift up over time
      eventsRepo.create({
        organizationId: orgId,
        title: `Past Wedding ${d.getUTCFullYear()}-${monthIdx + 1}-${k + 1}`,
        status: 'completed',
        startDate: `${d.getUTCFullYear()}-${String(monthIdx + 1).padStart(2, '0')}-${String(10 + k).padStart(2, '0')}`,
        guestCount: 80 + Math.round(Math.random() * 80),
        budgetCents: base + Math.round(Math.random() * 800000),
        createdBy: user.id,
      });
    }
  }
  console.log(`[seed] created 18 months of historical events for forecasting`);

} else {
  console.log(`[seed] events already exist — skipping seed data`);
}

console.log('');
console.log('──────────────────────────────────────────────');
console.log(`Demo login:   ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
console.log(`Org id:       ${orgId}`);
console.log(`Portal URL:   http://localhost:5173/#/portal/<eventId>`);
console.log('──────────────────────────────────────────────');
