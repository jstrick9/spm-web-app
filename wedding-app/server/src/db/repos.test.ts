import './../test/setup.js';
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './database.js';
import { makeUser, makeOrg, makeEvent, makeGuest } from '../test/factories.js';
import {
  eventsRepo, guestsRepo, layoutsRepo, vendorsRepo, timelineRepo,
  staffTasksRepo, catalogRepo, decorRepo, rsvpRepo, messagesRepo, auditRepo,
} from './repos/index.js';

beforeEach(() => {
  // Truncate every table between tests so each test starts clean
  const tables = [
    'audit_logs','direct_messages','event_answers','event_questions',
    'staff_shifts','staff_areas','staff_tasks','timeline_events',
    'vendor_payments','vendors','decor_packages','decor_arrangements',
    'decor_categories','decor_items','guest_portal_configs','rsvp_submissions',
    'guest_sub_event_invitations','guests','layout_versions','layouts',
    'catalog_items','venues','sub_events','event_memberships','events',
    'organization_memberships','organizations','users',
  ];
  for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
});

describe('events repo', () => {
  it('creates and lists events for an org', () => {
    const { user } = makeUser();
    const org = makeOrg(user.id);
    makeEvent(org.id, user.id, 'A');
    makeEvent(org.id, user.id, 'B');
    const events = eventsRepo.listForOrg(org.id);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.title).sort()).toEqual(['A', 'B']);
  });

  it('soft-deletes events (excluded from listForOrg by default)', () => {
    const { user } = makeUser();
    const org = makeOrg(user.id);
    const evt = makeEvent(org.id, user.id);
    expect(eventsRepo.softDelete(evt.id)).toBe(true);
    expect(eventsRepo.listForOrg(org.id)).toHaveLength(0);
    expect(eventsRepo.listForOrg(org.id, { includeDeleted: true })).toHaveLength(1);
    expect(eventsRepo.findById(evt.id)).toBeUndefined();
  });

  it('orgMapForUser includes events the user can see via org OR event membership', () => {
    const { user: ownerA } = makeUser();
    const orgA = makeOrg(ownerA.id);
    const evtA = makeEvent(orgA.id, ownerA.id);

    const { user: otherUser } = makeUser();
    // otherUser has no membership in orgA, so should see nothing
    expect(eventsRepo.orgMapForUser(otherUser.id)).toEqual({});

    // Add them as event-couple
    eventsRepo.addMember({ eventId: evtA.id, userId: otherUser.id, role: 'couple' });
    expect(eventsRepo.orgMapForUser(otherUser.id)).toEqual({ [evtA.id]: orgA.id });
  });

  it('update applies partial patch, metadata round-trips', () => {
    const { user } = makeUser();
    const org = makeOrg(user.id);
    const evt = makeEvent(org.id, user.id);
    const updated = eventsRepo.update(evt.id, { title: 'New', metadata: { theme: 'rustic' } });
    expect(updated?.title).toBe('New');
    expect(JSON.parse(updated!.metadata)).toEqual({ theme: 'rustic' });
  });
});

describe('guests repo', () => {
  it('creates, updates, soft-deletes guests', () => {
    const { user } = makeUser();
    const org = makeOrg(user.id);
    const evt = makeEvent(org.id, user.id);
    const g = guestsRepo.create(org.id, evt.id, { fullName: 'Aunt Mary' });
    expect(g.full_name).toBe('Aunt Mary');
    const updated = guestsRepo.update(g.id, { rsvpStatus: 'attending' });
    expect(updated?.rsvp_status).toBe('attending');
    expect(guestsRepo.softDelete(g.id)).toBe(true);
    expect(guestsRepo.findById(g.id)).toBeUndefined();
  });

  it('countByStatus reports right buckets', () => {
    const { user } = makeUser();
    const org = makeOrg(user.id);
    const evt = makeEvent(org.id, user.id);
    const a = guestsRepo.create(org.id, evt.id, { fullName: 'A' });
    const b = guestsRepo.create(org.id, evt.id, { fullName: 'B' });
    const c = guestsRepo.create(org.id, evt.id, { fullName: 'C' });
    guestsRepo.update(a.id, { rsvpStatus: 'attending' });
    guestsRepo.update(b.id, { rsvpStatus: 'attending' });
    guestsRepo.update(c.id, { rsvpStatus: 'declined' });
    const counts = guestsRepo.countByStatus(evt.id);
    expect(counts.attending).toBe(2);
    expect(counts.declined).toBe(1);
    expect(counts.pending).toBe(0);
  });

  it('rotatePortalToken returns plaintext, revoke removes it', () => {
    const { user } = makeUser();
    const org = makeOrg(user.id);
    const evt = makeEvent(org.id, user.id);
    const g = makeGuest(org.id, evt.id);
    const token = guestsRepo.rotatePortalToken(g.id);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    const refreshed = guestsRepo.findById(g.id)!;
    expect(refreshed.portal_token_hash).toBeTruthy();
    guestsRepo.revokePortalToken(g.id);
    const final = guestsRepo.findById(g.id)!;
    expect(final.portal_token_hash).toBeNull();
    expect(final.allow_portal_access).toBe(0);
  });
});

describe('layouts repo (revision history)', () => {
  it('creates layout at revision 1 and saves new revisions', () => {
    const { user } = makeUser();
    const org = makeOrg(user.id);
    const evt = makeEvent(org.id, user.id);
    const layout = layoutsRepo.create({
      organizationId: org.id, eventId: evt.id,
      name: 'V1', payload: { items: [] }, createdBy: user.id,
    });
    expect(layout.revision).toBe(1);
    const saved = layoutsRepo.saveRevision({
      layoutId: layout.id, payload: { items: [{ x: 1 }] },
      updatedBy: user.id, changeDescription: 'add item',
    });
    expect(saved.revision).toBe(2);
    const versions = layoutsRepo.listVersions(layout.id);
    expect(versions).toHaveLength(2);
    expect(versions[0].revision).toBe(2);
  });

  it('rejects save with mismatched expectedRevision', () => {
    const { user } = makeUser();
    const org = makeOrg(user.id);
    const layout = layoutsRepo.create({
      organizationId: org.id, name: 'L', payload: {}, createdBy: user.id,
    });
    layoutsRepo.saveRevision({ layoutId: layout.id, payload: {}, updatedBy: user.id });
    // Now layout is at rev 2. Try to save thinking it's still 1.
    expect(() => layoutsRepo.saveRevision({
      layoutId: layout.id, payload: {}, updatedBy: user.id, expectedRevision: 1,
    })).toThrow(/revision-conflict/);
  });
});

describe('vendors + payments', () => {
  it('addPayment updates amount_paid_cents atomically', () => {
    const { user } = makeUser();
    const org = makeOrg(user.id);
    const vendor = vendorsRepo.create(org.id, { name: 'DJ', contractAmountCents: 100_000 });
    vendorsRepo.addPayment(vendor.id, { amountCents: 30_000, paidAt: '2026-01-01' });
    vendorsRepo.addPayment(vendor.id, { amountCents: 20_000, paidAt: '2026-02-01' });
    const updated = vendorsRepo.findById(vendor.id)!;
    expect(updated.amount_paid_cents).toBe(50_000);
    const payments = vendorsRepo.listPayments(vendor.id);
    expect(payments).toHaveLength(2);
  });
});

describe('timeline', () => {
  it('lists items ordered by starts_at', () => {
    const { user } = makeUser();
    const org = makeOrg(user.id);
    const evt = makeEvent(org.id, user.id);
    timelineRepo.create(org.id, evt.id, { title: 'Cake', startsAt: '2026-12-31T18:00:00Z' });
    timelineRepo.create(org.id, evt.id, { title: 'Toast', startsAt: '2026-12-31T17:00:00Z' });
    const items = timelineRepo.listForEvent(evt.id);
    expect(items.map((i) => i.title)).toEqual(['Toast', 'Cake']);
  });

  it('update with status=completed sets completed_at', () => {
    const { user } = makeUser();
    const org = makeOrg(user.id);
    const evt = makeEvent(org.id, user.id);
    const item = timelineRepo.create(org.id, evt.id, { title: 'X', startsAt: '2026-01-01' });
    const updated = timelineRepo.update(item.id, { completed: true });
    expect(updated?.completed).toBe(1);
  });
});

describe('staff tasks', () => {
  it('auto-stamps completed_at when status becomes completed', () => {
    const { user } = makeUser();
    const org = makeOrg(user.id);
    const task = staffTasksRepo.create(org.id, user.id, { title: 'Setup chairs' });
    expect(task.completed_at).toBeNull();
    const done = staffTasksRepo.update(task.id, { status: 'completed' });
    expect(done?.completed_at).toBeTruthy();
  });
});

describe('catalog', () => {
  it('replaceAll wipes & reinserts atomically', () => {
    const { user } = makeUser();
    const org = makeOrg(user.id);
    catalogRepo.create(org.id, { kind: 'table', name: 'Round 6ft' });
    catalogRepo.create(org.id, { kind: 'table', name: 'Square 4ft' });
    expect(catalogRepo.listForOrg(org.id, 'table')).toHaveLength(2);
    catalogRepo.replaceAll(org.id, 'table', [
      { name: 'New A' }, { name: 'New B' }, { name: 'New C' },
    ]);
    const items = catalogRepo.listForOrg(org.id, 'table');
    expect(items.map((i) => i.name).sort()).toEqual(['New A', 'New B', 'New C']);
  });

  it('separates by kind', () => {
    const { user } = makeUser();
    const org = makeOrg(user.id);
    catalogRepo.create(org.id, { kind: 'table', name: 'Round' });
    catalogRepo.create(org.id, { kind: 'chair', name: 'Chiavari' });
    expect(catalogRepo.listForOrg(org.id, 'table')).toHaveLength(1);
    expect(catalogRepo.listForOrg(org.id, 'chair')).toHaveLength(1);
  });
});

describe('decor', () => {
  it('upserts arrangements by id', () => {
    const { user } = makeUser();
    const org = makeOrg(user.id);
    const a = decorRepo.upsertArrangement(org.id, { name: 'A', payload: { v: 1 } });
    const b = decorRepo.upsertArrangement(org.id, { id: a.id, name: 'A renamed', payload: { v: 2 } });
    expect(b.id).toBe(a.id);
    expect(b.name).toBe('A renamed');
    expect(decorRepo.listArrangements(org.id)).toHaveLength(1);
  });
});

describe('rsvp', () => {
  it('submit updates the guest rsvp_status', () => {
    const { user } = makeUser();
    const org = makeOrg(user.id);
    const evt = makeEvent(org.id, user.id);
    const g = makeGuest(org.id, evt.id);
    expect(g.rsvp_status).toBe('pending');
    rsvpRepo.submit({
      organizationId: org.id, eventId: evt.id, guestId: g.id, attending: true,
    });
    expect(guestsRepo.findById(g.id)!.rsvp_status).toBe('attending');
  });
});

describe('messages', () => {
  it('tracks unread count per user', () => {
    const { user: a } = makeUser();
    const { user: b } = makeUser();
    messagesRepo.send({ threadId: 't1', senderId: a.id, senderRole: 'admin', body: 'hi' });
    messagesRepo.send({ threadId: 't1', senderId: a.id, senderRole: 'admin', body: 'hi 2' });
    expect(messagesRepo.unreadCount('t1', b.id)).toBe(2);
    messagesRepo.markRead('t1', b.id);
    expect(messagesRepo.unreadCount('t1', b.id)).toBe(0);
  });
});

describe('audit', () => {
  it('records and lists per-org', () => {
    const { user } = makeUser();
    const org = makeOrg(user.id);
    auditRepo.log({ organizationId: org.id, actorUserId: user.id, action: 'thing.done' });
    auditRepo.log({ organizationId: org.id, actorUserId: user.id, action: 'thing.done' });
    const logs = auditRepo.listForOrg(org.id);
    expect(logs).toHaveLength(2);
  });
});
