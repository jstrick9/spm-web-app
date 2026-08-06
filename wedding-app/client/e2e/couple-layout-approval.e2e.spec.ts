import { test, expect } from '@playwright/test';

/**
 * Couple floor-plan approval end-to-end.
 *
 * The venue builds + approves a layout for the event; the couple opens
 * their wedding hub and approves the floor plan; the approval lands in the
 * event metadata (server-side verified through the couple layout API).
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('couple approves the venue floor plan from the wedding hub', async ({ page, request }) => {
  // ── 0. API setup: owner builds an approved layout for the event ──────
  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;
  const events = (await (await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events;
  const event = events.find((e: any) => e.title === 'Smith & Jones Wedding') ?? events[0];
  const eventId = event.id as string;

  // A layout the couple can review (created fresh per run so the section
  // is never empty).
  const layoutRes = await request.post('/api/layouts', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { organizationId: orgId, eventId, name: `E2E Reception ${Date.now()}`, payload: {} },
  });
  expect(layoutRes.status()).toBe(201);
  const layoutId = (await layoutRes.json()).layout.id as string;
  const save = await request.post(`/api/layouts/${layoutId}/save`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { payload: { zones: [{ type: 'dance_floor', label: 'Dance floor' }], tables: [{ id: 't1', seats: 8, label: 'Round 1' }] } },
  });
  expect(save.status()).toBe(200);
  const review = await request.post(`/api/layouts/${layoutId}/review-request`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect([200, 201]).toContain(review.status());
  const decision = await request.post(`/api/layouts/${layoutId}/queue-decision`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { decision: 'approved', note: 'Ops review OK' },
  });
  expect(decision.status()).toBe(200);

  // ── 1. Couple account + membership + tour state ──────────────────────
  const coupleEmail = `couple-layout-${Date.now()}@example.com`;
  const reg = await request.post('/api/auth/register', {
    data: { email: coupleEmail, password: 'testpass123', fullName: 'Casey Approve', orgName: 'Tmp' },
  });
  expect(reg.ok()).toBeTruthy();
  const invite = await request.post(`/api/events/${eventId}/couple-invitations`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { email: coupleEmail, roleKey: 'couple' },
  });
  expect(invite.status()).toBe(201);

  const coupleLogin = await request.post('/api/auth/login', { data: { email: coupleEmail, password: 'testpass123' } });
  const coupleToken = (await coupleLogin.json()).token;
  const coupleOrgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${coupleToken}` } })).json();
  await request.put('/api/users/me/preferences', {
    headers: { authorization: `Bearer ${coupleToken}`, 'content-type': 'application/json' },
    data: {
      onboarding: {
        welcomeTourByOrg: {
          [coupleOrgs.organizations[0].id]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() },
        },
      },
    },
  });

  // ── 2. Couple opens the hub and approves the floor plan ──────────────
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill(coupleEmail);
  await page.getByLabel(/^password$/i).fill('testpass123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/your wedding hub/i, { timeout: 20_000 });
  await expect(page.getByText(event.title).first()).toBeVisible({ timeout: 20_000 });

  await clickSafely(page.getByRole('button', { name: 'Approve floor plan' }));
  await expect(page.getByText('Floor plan response sent').first()).toBeVisible({ timeout: 10_000 });

  // ── 3. Server-side verification: approval recorded in event metadata ─
  const layoutRes2 = await request.get(`/api/events/${eventId}/couple-layout`, {
    headers: { authorization: `Bearer ${coupleToken}` },
  });
  expect(layoutRes2.ok()).toBeTruthy();
  const { approval } = (await layoutRes2.json()) as { approval: { status?: string; note?: string | null; updatedAt?: string | null } };
  expect(approval.status).toBe('approved');
  expect(approval.note).toContain('Approved by couple');
});

test('couple approves the final timeline from the wedding hub', async ({ page, request }) => {
  // ── 0. API setup: couple account + membership + tour state ──────────
  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;
  const events = (await (await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events;
  const event = events.find((e: any) => e.title === 'Smith & Jones Wedding') ?? events[0];
  const eventId = event.id as string;

  const coupleEmail = `couple-timeline-${Date.now()}@example.com`;
  await request.post('/api/auth/register', {
    data: { email: coupleEmail, password: 'testpass123', fullName: 'Timeline Approver', orgName: 'Tmp' },
  });
  await request.post(`/api/events/${eventId}/couple-invitations`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { email: coupleEmail, roleKey: 'couple' },
  });
  const coupleLogin = await request.post('/api/auth/login', { data: { email: coupleEmail, password: 'testpass123' } });
  const coupleToken = (await coupleLogin.json()).token;
  const coupleOrgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${coupleToken}` } })).json();
  await request.put('/api/users/me/preferences', {
    headers: { authorization: `Bearer ${coupleToken}`, 'content-type': 'application/json' },
    data: { onboarding: { welcomeTourByOrg: { [coupleOrgs.organizations[0].id]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() } } } },
  });

  // ── 1. Couple opens the hub and approves the final timeline ──────────
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill(coupleEmail);
  await page.getByLabel(/^password$/i).fill('testpass123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/your wedding hub/i, { timeout: 20_000 });
  await expect(page.getByText(event.title).first()).toBeVisible({ timeout: 20_000 });

  await clickSafely(page.getByRole('button', { name: 'Approve final timeline' }));
  await expect(page.getByText('Timeline response sent').first()).toBeVisible({ timeout: 10_000 });

  // ── 2. Server-side verification: timeline approval in event metadata ─
  const tlRes = await request.get(`/api/events/${eventId}/couple-timeline`, {
    headers: { authorization: `Bearer ${coupleToken}` },
  });
  expect(tlRes.ok()).toBeTruthy();
  const { approval: tlApproval } = (await tlRes.json()) as { approval: { status?: string; note?: string | null } };
  expect(tlApproval.status).toBe('approved');
  expect(tlApproval.note).toContain('Approved by couple');
});

async function clickSafely(locator: import('@playwright/test').Locator): Promise<void> {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await locator.click();
}
