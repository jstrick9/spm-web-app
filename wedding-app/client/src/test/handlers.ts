/**
 * Default MSW handlers — a small in-memory backend mirroring Phase 1.
 *
 * State is a plain object that lives in module scope. Each test file
 * effectively gets a shared backend; if a test wants fresh state it can
 * call `resetStore()` in beforeEach.
 */
import { http, HttpResponse } from 'msw';
import type {
  SdkEvent, SdkGuest, SdkOrg, SdkUser, SdkRole, SdkMembership,
} from '../sdk/types.js';

interface Store {
  users:    Map<string, SdkUser & { password: string }>;
  orgs:     Map<string, SdkOrg>;
  members:  Map<string, SdkMembership[]>;  // userId -> memberships
  events:   Map<string, SdkEvent>;
  guests:   Map<string, SdkGuest>;
  rsvps:    Map<string, { id: string; event_id: string; guest_id: string | null; attending: 0|1; meal_choice: string | null; submitted_at: string; notes: string | null; guest_name?: string }>;
  roles:    Map<string, SdkRole>;
  tokens:   Map<string, string>;  // token -> userId
  layouts:  Map<string, { id: string; organization_id: string; event_id: string | null; name: string; revision: number; payload: string; is_template: 0|1; visibility: string; venue_id: string | null; created_at: string; updated_at: string }>;
  vendors:  Map<string, { id: string; organization_id: string; event_id: string | null; name: string; category: string; contract_amount_cents: number | null; amount_paid_cents: number; is_preferred: 0|1; owner_user_id: string | null; contact_name: string | null; email: string | null; phone: string | null; website_url: string | null; notes: string | null; metadata: string; created_at: string }>;
  messages: Map<string, Array<{ id: string; thread_id: string; body: string; sender_id: string | null; sender_role: string; created_at: string; read_at: string | null }>>;
}

export const store: Store = {
  users:   new Map(),
  orgs:    new Map(),
  members: new Map(),
  events:  new Map(),
  guests:  new Map(),
  rsvps:   new Map(),
  roles:   new Map(),
  tokens:  new Map(),
  layouts: new Map(),
  vendors: new Map(),
  messages: new Map(),
};

export function resetStore(): void {
  for (const k of Object.keys(store) as Array<keyof Store>) {
    store[k].clear();
  }
  seedSystemRoles();
}

// Seed system roles into the in-memory store so role-aware tests work.
export function seedSystemRoles(): void {
  const sysRoles: Array<{ id: string; key: string; name: string; perms: string[] }> = [
    { id: 'sys_owner',   key: 'owner',   name: 'Owner',   perms: ['*'] },
    { id: 'sys_admin',   key: 'admin',   name: 'Admin',   perms: ['*'] },
    { id: 'sys_manager', key: 'manager', name: 'Venue Manager', perms: ['events.view', 'staff.view', 'vendors.view', 'guests.view'] },
    { id: 'sys_planner', key: 'planner', name: 'Planner', perms: ['events.view'] },
    { id: 'sys_couple',  key: 'couple',  name: 'Couple',  perms: ['events.view'] },
    { id: 'sys_staff',   key: 'staff',   name: 'Staff',   perms: ['events.view'] },
    { id: 'sys_vendor',  key: 'vendor',  name: 'Vendor',  perms: ['vendor.portal.view'] },
    { id: 'sys_guest',   key: 'guest',   name: 'Guest',   perms: ['rsvp.submit'] },
  ];
  for (const r of sysRoles) {
    store.roles.set(r.id, {
      id: r.id, organization_id: null, key: r.key, name: r.name,
      description: '', is_system: 1, system_kind: r.key, hierarchy: 50,
      permissions: r.perms,
      created_at: '2026-01-01', updated_at: '2026-01-01',
    });
  }
}

seedSystemRoles();

// ─── Helpers ───────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 12); }

function authedUserId(req: Request): string | null {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return store.tokens.get(auth.slice(7)) ?? null;
}

function unauthorized() {
  return HttpResponse.json({ error: 'unauthenticated' }, { status: 401 });
}

// ─── Handlers ──────────────────────────────────────
export const defaultHandlers = [
  // Auth
  http.post('/api/auth/register', async ({ request }) => {
    const body = await request.json() as { email: string; password: string; fullName: string; orgName?: string; accountRole?: string; inviteToken?: string };
    if (Array.from(store.users.values()).some(u => u.email === body.email)) {
      return HttpResponse.json({ error: 'email-already-registered' }, { status: 409 });
    }
    const userId = uid();
    const user = { id: userId, email: body.email, fullName: body.fullName, password: body.password };
    store.users.set(userId, user);
    const orgId = uid();
    const orgName = body.orgName || 'Invited Workspace';
    store.orgs.set(orgId, {
      id: orgId, name: orgName, slug: orgName.toLowerCase().replace(/\s+/g, '-'),
      owner_id: userId, branding: '{}', settings: '{}', created_at: new Date().toISOString(),
    });
    store.members.set(userId, [
      { organizationId: orgId, roleId: 'sys_owner', roleKey: 'owner', roleName: 'Owner' },
    ]);
    const token = uid();
    store.tokens.set(token, userId);
    return HttpResponse.json({
      token,
      user: { id: userId, email: user.email, fullName: user.fullName },
      organizationId: orgId,
    }, { status: 201 });
  }),

  http.post('/api/auth/login', async ({ request }) => {
    const body = await request.json() as { email: string; password: string };
    const user = Array.from(store.users.values()).find(u => u.email === body.email);
    if (!user || user.password !== body.password) {
      return HttpResponse.json({ error: 'invalid-credentials' }, { status: 401 });
    }
    const token = uid();
    store.tokens.set(token, user.id);
    return HttpResponse.json({
      token,
      user: { id: user.id, email: user.email, fullName: user.fullName },
    });
  }),

  http.post('/api/auth/password-reset/request', async () => {
    return HttpResponse.json({
      ok: true,
      message: 'If an account exists for that email, a password reset link will be sent.',
    });
  }),

  http.post('/api/auth/password-reset/complete', async () => {
    return HttpResponse.json({ ok: true });
  }),

  http.get('/api/auth/me', ({ request }) => {
    const userId = authedUserId(request);
    if (!userId) return unauthorized();
    const user = store.users.get(userId);
    if (!user) return unauthorized();
    return HttpResponse.json({
      user: { id: user.id, email: user.email, fullName: user.fullName },
      memberships: store.members.get(userId) ?? [],
    });
  }),

  http.post('/api/auth/logout', ({ request }) => {
    const auth = request.headers.get('authorization');
    if (auth?.startsWith('Bearer ')) store.tokens.delete(auth.slice(7));
    return HttpResponse.json({ ok: true });
  }),

  // Orgs
  http.get('/api/orgs', ({ request }) => {
    const userId = authedUserId(request);
    if (!userId) return unauthorized();
    const memberships = store.members.get(userId) ?? [];
    const orgs = memberships
      .filter(m => m.organizationId)
      .map(m => store.orgs.get(m.organizationId!))
      .filter(Boolean);
    return HttpResponse.json({ organizations: orgs });
  }),

  http.get('/api/orgs/:orgId/roles', () => {
    return HttpResponse.json({ roles: Array.from(store.roles.values()) });
  }),

  http.get('/api/auth/invitations/:token', () => {
    return HttpResponse.json({ invitation: { email: 'manager@example.com', organizationId: 'org-1', organizationName: 'Demo Venue', roleId: 'sys_manager', roleKey: 'manager', roleName: 'Venue Manager', roleDescription: 'Runs venue operations and escalations.', expiresAt: new Date(Date.now() + 86400000).toISOString() } });
  }),

  http.post('/api/orgs/:orgId/team-invitations', async ({ params, request }) => {
    const body = await request.json() as { email: string; roleId: string };
    const existing = Array.from(store.users.values()).find(u => u.email === body.email);
    if (existing) {
      const prev = store.members.get(existing.id) ?? [];
      store.members.set(existing.id, [...prev, { organizationId: params.orgId as string, roleId: body.roleId, roleKey: 'staff', roleName: 'Staff' }]);
      return HttpResponse.json({ ok: true, status: 'added_existing_user' }, { status: 201 });
    }
    return HttpResponse.json({ ok: true, status: 'invitation_sent', invitation: { id: uid(), email: body.email, role_id: body.roleId, expires_at: new Date(Date.now() + 86400000).toISOString() } }, { status: 201 });
  }),

  http.get('/api/orgs/:orgId/config', () => {
    return HttpResponse.json({ config: { setup: { ownerSetup: { status: 'not_started', completedSteps: [] } } } });
  }),

  http.put('/api/orgs/:orgId/config', async ({ request }) => {
    return HttpResponse.json({ config: await request.json() });
  }),

  http.get('/api/users/me/preferences', () => {
    return HttpResponse.json({ config: {} });
  }),

  http.put('/api/users/me/preferences', async ({ request }) => {
    return HttpResponse.json({ config: await request.json() });
  }),

  // Events
  http.get('/api/orgs/:orgId/events', ({ request, params }) => {
    const userId = authedUserId(request);
    if (!userId) return unauthorized();
    const events = Array.from(store.events.values())
      .filter(e => e.organization_id === params.orgId);
    return HttpResponse.json({ events });
  }),

  http.post('/api/events', async ({ request }) => {
    const userId = authedUserId(request);
    if (!userId) return unauthorized();
    const body = await request.json() as { organizationId: string; title: string; startDate?: string; endDate?: string };
    const id = uid();
    const evt: SdkEvent = {
      id, organization_id: body.organizationId, title: body.title,
      slug: body.title.toLowerCase().replace(/\s+/g, '-'),
      status: 'planning', start_date: body.startDate ?? null, end_date: body.endDate ?? null,
      guest_count: 0, primary_contact_user_id: null, budget_cents: null,
      metadata: '{}', created_at: new Date().toISOString(),
    };
    store.events.set(id, evt);
    return HttpResponse.json({ event: evt }, { status: 201 });
  }),

  http.get('/api/events/:eventId', ({ request, params }) => {
    if (!authedUserId(request)) return unauthorized();
    const evt = store.events.get(params.eventId as string);
    if (!evt) return HttpResponse.json({ error: 'not-found' }, { status: 404 });
    return HttpResponse.json({ event: evt });
  }),

  http.patch('/api/events/:eventId', async ({ request, params }) => {
    if (!authedUserId(request)) return unauthorized();
    const evt = store.events.get(params.eventId as string);
    if (!evt) return HttpResponse.json({ error: 'not-found' }, { status: 404 });
    const patch = await request.json() as Partial<SdkEvent>;
    Object.assign(evt, patch);
    return HttpResponse.json({ event: evt });
  }),

  http.delete('/api/events/:eventId', ({ request, params }) => {
    if (!authedUserId(request)) return unauthorized();
    store.events.delete(params.eventId as string);
    return new HttpResponse(null, { status: 204 });
  }),

  // Guests
  http.get('/api/events/:eventId/guests', ({ request, params }) => {
    if (!authedUserId(request)) return unauthorized();
    const guests = Array.from(store.guests.values()).filter(g => g.event_id === params.eventId);
    const counts = { pending: 0, attending: 0, declined: 0, maybe: 0 };
    for (const g of guests) counts[g.rsvp_status]++;
    return HttpResponse.json({ guests, counts });
  }),

  http.post('/api/events/:eventId/guests', async ({ request, params }) => {
    if (!authedUserId(request)) return unauthorized();
    const evt = store.events.get(params.eventId as string);
    if (!evt) return HttpResponse.json({ error: 'event-not-found' }, { status: 404 });
    const body = await request.json() as { fullName: string; email?: string; plusOneAllowed?: boolean };
    const id = uid();
    const guest: SdkGuest = {
      id, organization_id: evt.organization_id, event_id: evt.id,
      full_name: body.fullName, email: body.email ?? null, phone: null,
      party_name: null, rsvp_status: 'pending',
      dietary_restrictions: null, accessibility_notes: null,
      table_assignment: null, room_assignment: null, seat_assignment: null,
      plus_one_allowed: body.plusOneAllowed ? 1 : 0,
      allow_portal_access: 1, allow_lodging_access: 0,
      metadata: '{}', created_at: new Date().toISOString(),
    };
    store.guests.set(id, guest);
    return HttpResponse.json({ guest }, { status: 201 });
  }),

  http.patch('/api/guests/:id', async ({ request, params }) => {
    if (!authedUserId(request)) return unauthorized();
    const g = store.guests.get(params.id as string);
    if (!g) return HttpResponse.json({ error: 'not-found' }, { status: 404 });
    const patch = await request.json() as {
      rsvpStatus?: SdkGuest['rsvp_status'];
      fullName?: string; email?: string; phone?: string;
      partyName?: string; tableAssignment?: string;
      dietaryRestrictions?: string; accessibilityNotes?: string;
      plusOneAllowed?: boolean; allowPortalAccess?: boolean;
    };
    // Map camelCase SDK input → snake_case row columns
    if (patch.rsvpStatus !== undefined)          g.rsvp_status = patch.rsvpStatus;
    if (patch.fullName !== undefined)            g.full_name = patch.fullName;
    if (patch.email !== undefined)               g.email = patch.email || null;
    if (patch.phone !== undefined)               g.phone = patch.phone || null;
    if (patch.partyName !== undefined)           g.party_name = patch.partyName || null;
    if (patch.tableAssignment !== undefined)     g.table_assignment = patch.tableAssignment || null;
    if (patch.dietaryRestrictions !== undefined) g.dietary_restrictions = patch.dietaryRestrictions || null;
    if (patch.accessibilityNotes !== undefined)  g.accessibility_notes = patch.accessibilityNotes || null;
    if (patch.plusOneAllowed !== undefined)      g.plus_one_allowed = patch.plusOneAllowed ? 1 : 0;
    if (patch.allowPortalAccess !== undefined)   g.allow_portal_access = patch.allowPortalAccess ? 1 : 0;
    return HttpResponse.json({ guest: g });
  }),

  http.delete('/api/guests/:id', ({ request, params }) => {
    if (!authedUserId(request)) return unauthorized();
    store.guests.delete(params.id as string);
    return new HttpResponse(null, { status: 204 });
  }),

  // RSVPs (authed list)
  http.get('/api/events/:eventId/rsvps', ({ request, params }) => {
    if (!authedUserId(request)) return unauthorized();
    const rsvps = Array.from(store.rsvps.values()).filter(r => r.event_id === params.eventId);
    return HttpResponse.json({ rsvps });
  }),

  // Public portal info (no auth)
  http.get('/api/portal/:eventId/info', ({ params }) => {
    const evt = store.events.get(params.eventId as string);
    if (!evt) return HttpResponse.json({ error: 'not-found' }, { status: 404 });
    const guests = Array.from(store.guests.values())
      .filter(g => g.event_id === evt.id && g.allow_portal_access === 1)
      .map(g => ({ id: g.id, fullName: g.full_name }));
    return HttpResponse.json({
      event: { id: evt.id, title: evt.title, startDate: evt.start_date, endDate: evt.end_date },
      portalEnabled: true, requiresPassword: false,
      guests,
    });
  }),

  http.post('/api/portal/:eventId/rsvp', async ({ request, params }) => {
    const body = await request.json() as { guestId?: string; attending: boolean; mealChoice?: string; notes?: string };
    const evt = store.events.get(params.eventId as string);
    if (!evt) return HttpResponse.json({ error: 'event-not-found' }, { status: 404 });
    const id = uid();
    const guest = body.guestId ? store.guests.get(body.guestId) : undefined;
    store.rsvps.set(id, {
      id, event_id: evt.id, guest_id: body.guestId ?? null,
      attending: body.attending ? 1 : 0, meal_choice: body.mealChoice ?? null,
      submitted_at: new Date().toISOString(),
      notes: body.notes ?? null, guest_name: guest?.full_name,
    });
    if (guest) guest.rsvp_status = body.attending ? 'attending' : 'declined';
    return HttpResponse.json({ ok: true, rsvpId: id }, { status: 201 });
  }),

  // Messages
  http.get('/api/messages/:threadId', ({ request, params }) => {
    if (!authedUserId(request)) return unauthorized();
    const threadId = decodeURIComponent(params.threadId as string);
    return HttpResponse.json({ messages: store.messages.get(threadId) ?? [] });
  }),

  http.post('/api/messages/:threadId', async ({ request, params }) => {
    if (!authedUserId(request)) return unauthorized();
    const threadId = decodeURIComponent(params.threadId as string);
    const body = await request.json() as { body: string; senderRole?: string };
    const msg = {
      id: uid(), thread_id: threadId, body: body.body,
      sender_id: null, sender_role: body.senderRole ?? 'planner',
      created_at: new Date().toISOString(), read_at: null,
    };
    const arr = store.messages.get(threadId) ?? [];
    arr.push(msg);
    store.messages.set(threadId, arr);
    return HttpResponse.json({ message: msg }, { status: 201 });
  }),

  http.post('/api/messages/:threadId/read', ({ request, params }) => {
    if (!authedUserId(request)) return unauthorized();
    const threadId = decodeURIComponent(params.threadId as string);
    const arr = store.messages.get(threadId) ?? [];
    const now = new Date().toISOString();
    arr.forEach((m) => { m.read_at = now; });
    return HttpResponse.json({ ok: true });
  }),

  // Roles
  http.get('/api/orgs/:orgId/roles', ({ request, params }) => {
    if (!authedUserId(request)) return unauthorized();
    const roles = Array.from(store.roles.values())
      .filter(r => r.organization_id === null || r.organization_id === params.orgId);
    return HttpResponse.json({ roles });
  }),

  http.get('/api/orgs/:orgId/roles/permissions', ({ request }) => {
    if (!authedUserId(request)) return unauthorized();
    return HttpResponse.json({
      catalog: [
        { id: 'events.view', label: 'View events', description: '', category: 'events' },
        { id: 'events.create', label: 'Create events', description: '', category: 'events' },
        { id: 'guests.view', label: 'View guests', description: '', category: 'guests' },
        { id: 'guests.manage', label: 'Manage guests', description: '', category: 'guests' },
        { id: 'vendor.portal.view', label: 'Vendor portal', description: '', category: 'vendor_portal' },
      ],
    });
  }),

  http.post('/api/orgs/:orgId/roles', async ({ request, params }) => {
    if (!authedUserId(request)) return unauthorized();
    const body = await request.json() as { key: string; name: string; permissions: string[] };
    const existing = Array.from(store.roles.values())
      .find(r => r.organization_id === params.orgId && r.key === body.key);
    if (existing) return HttpResponse.json({ error: 'role-key-already-exists' }, { status: 409 });
    const id = uid();
    const role: SdkRole = {
      id, organization_id: params.orgId as string, key: body.key, name: body.name,
      description: null, is_system: 0, system_kind: null, hierarchy: 50,
      permissions: body.permissions,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    store.roles.set(id, role);
    return HttpResponse.json({ role }, { status: 201 });
  }),

  http.patch('/api/roles/:id', async ({ request, params }) => {
    if (!authedUserId(request)) return unauthorized();
    const role = store.roles.get(params.id as string);
    if (!role) return HttpResponse.json({ error: 'role-not-found' }, { status: 404 });
    if (role.is_system) return HttpResponse.json({ error: 'system-role-immutable' }, { status: 400 });
    const patch = await request.json() as Partial<SdkRole> & { permissions?: string[] };
    if (patch.permissions) role.permissions = patch.permissions;
    if (patch.name) role.name = patch.name;
    return HttpResponse.json({ role });
  }),

  http.delete('/api/roles/:id', ({ request, params }) => {
    if (!authedUserId(request)) return unauthorized();
    const role = store.roles.get(params.id as string);
    if (!role) return HttpResponse.json({ error: 'role-not-found' }, { status: 404 });
    if (role.is_system) return HttpResponse.json({ error: 'system-role-immutable' }, { status: 400 });
    store.roles.delete(params.id as string);
    return new HttpResponse(null, { status: 204 });
  }),
];
