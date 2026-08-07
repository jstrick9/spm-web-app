import { test, expect } from '@playwright/test';

/**
 * Role-matrix sweep (runbook Phase 2.4): planner and staff accounts get the
 * surfaces their role allows, and are BLOCKED from owner/manager-only
 * surfaces both in the UI (AccessDenied) and on the wire (403) — the
 * "what each role CANNOT see/do" half of the matrix, which had no e2e
 * coverage (only owner/manager/couple were exercised).
 */
test.use({ viewport: { width: 1440, height: 1400 } });

const BASE = process.env.A11Y_BASE_URL || 'http://localhost:3000';

async function setupMember(request: import('@playwright/test').APIRequestContext, roleId: string, label: string) {
  const login = await request.post('/api/auth/login', { data: { email: 'owner@demo.local', password: 'wedding123' } });
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;
  const email = `${label}-${Date.now()}@example.com`;
  // REAL invite flow: the member registers through the team invitation, so
  // they join the venue org WITHOUT creating their own org (a self-created
  // org would become their app context and this whole matrix would test the
  // wrong org).
  const invite = await request.post(`/api/orgs/${orgId}/team-invitations`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { email, roleId },
  });
  expect(invite.status()).toBe(201);
  const inviteBody = (await invite.json()) as { token?: string };
  expect(inviteBody.token, 'e2e mode must return the invite token').toBeTruthy();
  const reg = await request.post('/api/auth/register', {
    data: { email, password: 'testpass123', fullName: label === 'planner' ? 'Pat Planner' : 'Sam Staff', inviteToken: inviteBody.token },
  });
  expect(reg.ok()).toBeTruthy();
  const memberLogin = await request.post('/api/auth/login', { data: { email, password: 'testpass123' } });
  const memberToken = (await memberLogin.json()).token;
  // complete the onboarding tour so it never covers the screens under test
  await request.put('/api/users/me/preferences', {
    headers: { authorization: `Bearer ${memberToken}`, 'content-type': 'application/json' },
    data: { onboarding: { welcomeTourByOrg: { [orgId]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() } } } },
  });
  return { email, token: memberToken, orgId, memberToken };
}

async function loginAs(page: import('@playwright/test').Page, email: string) {
  await page.goto(BASE + '/#/');
  await page.getByLabel(/email address/i).fill(email);
  await page.locator('#pw').fill('testpass123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });
}

test('planner sees planning surfaces but is blocked from admin/venue/inventory management', async ({ page, request }) => {
  const allErrors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') allErrors.push(`[console.error] ${msg.text().slice(0, 260)}`); });
  page.on('pageerror', (err) => allErrors.push(`[pageerror] ${String(err).slice(0, 260)}`));
  page.on('response', (res) => { if (res.status() >= 400) allErrors.push(`[http ${res.status()}] ${res.url().slice(0, 200)}`); });

  const { email, token, orgId } = await setupMember(request, 'sys_planner', 'planner');

  // ── Wire-level RBAC: planner may not manage venues or publish layouts ──
  const venueCreate = await request.post(`/api/orgs/${orgId}/venues`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { name: 'Should Fail', approvalStatus: 'approved' },
  });
  expect([403, 404]).toContain(venueCreate.status());

  await loginAs(page, email);

  // ── Can see: dashboard, events list, event detail ──
  await page.goto(BASE + '/#/events');
  await expect(page.locator('body')).toContainText(/Event Pipeline Board/i, { timeout: 15_000 });
  const eventsRes = await request.get(`/api/orgs/${orgId}/events`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const { events } = (await eventsRes.json()) as { events: Array<{ id: string; title: string }> };
  expect(events.length).toBeGreaterThan(0);
  await page.goto(BASE + `/#/events/${events[0].id}`);
  await expect(page.locator('body')).toContainText(new RegExp(events[0].title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), { timeout: 20_000 });

  // ── Cannot see: owner/admin-only surfaces → AccessDenied ──
  await page.goto(BASE + '/#/system');
  await expect(page.getByText('System Administration — Access Restricted').first()).toBeVisible({ timeout: 15_000 });

  await page.goto(BASE + '/#/system/venue');
  await expect(page.getByText('Venue Studio — Access Restricted').first()).toBeVisible({ timeout: 15_000 });

  await page.goto(BASE + '/#/system/platform');
  await expect(page.getByText('Platform Studio — Access Restricted').first()).toBeVisible({ timeout: 15_000 });

  expect(allErrors, `planner role-matrix pass produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});

test('staff sees operational surfaces but is blocked from catalog/questions/admin and event editing', async ({ page, request }) => {
  const { email, token, orgId } = await setupMember(request, 'sys_staff', 'staff');

  // ── Wire-level RBAC: staff cannot create events or questions ──
  const eventCreate = await request.post('/api/events', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { organizationId: orgId, title: 'Staff Should Not Create', startDate: '2026-11-11' },
  });
  expect([403, 404]).toContain(eventCreate.status());
  const questionCreate = await request.post(`/api/orgs/${orgId}/questions`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { question: 'Staff Should Not Create?' },
  });
  expect([403, 404]).toContain(questionCreate.status());

  await loginAs(page, email);

  // ── Can see: dashboard + events list + guests (guests.view) ──
  await page.goto(BASE + '/#/guests');
  await expect(page.locator('body')).toContainText(/guests?/i, { timeout: 15_000 });

  // ── Cannot see: catalog, questions, inventory, admin ──
  await page.goto(BASE + '/#/system/catalog');
  await expect(page.getByText('Catalog Studio — Access Restricted').first()).toBeVisible({ timeout: 15_000 });

  await page.goto(BASE + '/#/system/questions');
  await expect(page.getByText('Questions Studio — Access Restricted').first()).toBeVisible({ timeout: 15_000 });

  await page.goto(BASE + '/#/system');
  await expect(page.getByText('System Administration — Access Restricted').first()).toBeVisible({ timeout: 15_000 });
});
