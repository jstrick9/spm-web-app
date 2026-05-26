/**
 * Test helpers: create realistic users/orgs/events without ceremony.
 */
import { hashPassword } from '../lib/crypto.js';
import { slugify } from '../lib/slug.js';
import { orgsRepo, usersRepo, eventsRepo, guestsRepo } from '../db/repos/index.js';
import { SYSTEM_ROLE_IDS } from '../lib/permissions.js';
let counter = 0;
const uniqueEmail = (prefix = 'test') => `${prefix}-${++counter}-${Date.now()}@example.com`;
export function makeUser(opts = {}) {
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
export function makeOrg(ownerId, name = `Org-${++counter}`) {
    const id = orgsRepo.createWithOwner({ name, slug: `${slugify(name)}-${id6()}`, ownerId });
    return orgsRepo.findById(id);
}
export function makeEvent(orgId, createdBy, title = `Wedding-${++counter}`) {
    return eventsRepo.create({
        organizationId: orgId,
        title,
        createdBy,
        startDate: '2026-12-31',
    });
}
export function makeGuest(orgId, eventId, name = `Guest-${++counter}`) {
    return guestsRepo.create(orgId, eventId, { fullName: name });
}
/**
 * Add a user to an org as some system role. Useful for testing
 * non-owner permission flows.
 */
export function addUserToOrgAs(orgId, userId, roleKey) {
    orgsRepo.addMember({
        orgId,
        userId,
        roleId: SYSTEM_ROLE_IDS[roleKey],
    });
}
export function signTokenForUser(app, userId, email, sv = 1) {
    return app.jwt.sign({ sub: userId, email, sv });
}
function id6() { return Math.random().toString(36).slice(2, 8); }
//# sourceMappingURL=factories.js.map