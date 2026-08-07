import { test, expect } from '@playwright/test';

/**
 * Couple "starting plan" end-to-end: the couple opens the hub, chooses a
 * venue-approved layout template ("Use this template"), the toast confirms,
 * and the server records the layout proposal tied to that template.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('couple applies a venue-approved starting plan template', async ({ page, request }) => {
  const allErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') allErrors.push(`[console.error] ${msg.text().slice(0, 260)}`);
  });
  page.on('pageerror', (err) => allErrors.push(`[pageerror] ${String(err).slice(0, 260)}`));
  page.on('response', (res) => {
    if (res.status() >= 400) allErrors.push(`[http ${res.status()}] ${res.url().slice(0, 200)}`);
  });

  const coupleEmail = `couple-tpl-${Date.now()}@example.com`;
  const reg = await request.post('/api/auth/register', {
    data: { email: coupleEmail, password: 'testpass123', fullName: 'Taylor Couple', orgName: 'Tmp' },
  });
  expect(reg.ok()).toBeTruthy();

  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;
  const events = (await (await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events;
  const event = events.find((e: any) => e.title === 'Smith & Jones Wedding') ?? events[0];
  const eventId = event.id as string;

  // the venue must have published at least one template. Templates are
  // catalog items of kind 'template' bound to an APPROVED venue, so create
  // both when the org has none.
  const templatesRes = await request.get(`/api/events/${eventId}/venue-templates`, {
    headers: { authorization: `Bearer ${token}` },
  });
  let templates = (await templatesRes.json() as any).templates || [];
  if (!templates.length) {
    const venueRes = await request.post(`/api/orgs/${orgId}/venues`, {
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      data: { name: `E2E Ballroom ${Date.now()}`, category: 'ballroom', capacity: 200, approvalStatus: 'approved' },
    });
    expect(venueRes.status()).toBe(201);
    const venueId = ((await venueRes.json()) as any).venue.id as string;
    const created = await request.post(`/api/orgs/${orgId}/catalog/template`, {
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      data: {
        name: `E2E Template ${Date.now()}`,
        visible: true,
        spec: { venueId, weddingMoment: 'Reception', serviceStyle: 'plated', minGuests: 50, maxGuests: 150, payload: { items: [{ id: 't1', type: 'round_table', x: 100, y: 100, radius: 30 }] } },
      },
    });
    expect(created.status()).toBe(201);
    templates = [((await created.json()) as any).item];
  }
  const template = templates[0];

  const invite = await request.post(`/api/events/${eventId}/couple-invitations`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { email: coupleEmail, roleKey: 'couple' },
  });
  expect(invite.status()).toBe(201);

  const coupleLogin = await request.post('/api/auth/login', { data: { email: coupleEmail, password: 'testpass123' } });
  const coupleToken = (await coupleLogin.json()).token;
  const coupleOrgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${coupleToken}` } })).json();
  const coupleOrgId = coupleOrgs.organizations[0].id;
  await request.put('/api/users/me/preferences', {
    headers: { authorization: `Bearer ${coupleToken}`, 'content-type': 'application/json' },
    data: {
      onboarding: {
        welcomeTourByOrg: {
          [coupleOrgId]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() },
        },
      },
    },
  });

  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill(coupleEmail);
  await page.getByLabel(/^password$/i).fill('testpass123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/your wedding hub/i, { timeout: 20_000 });
  await expect(page.getByText(event.title)).toBeVisible({ timeout: 20_000 });

  // ── 1. Apply the template ──
  const useBtn = page.getByRole('button', { name: 'Use this template' }).first();
  await useBtn.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  // the hub re-renders on SSE refetches (full-suite churn) — force-click
  await useBtn.click({ force: true });
  await expect(page.getByText('Template applied as your layout proposal').first()).toBeVisible({ timeout: 15_000 });

  // ── 2. Server-side verification: a layout proposal now exists ──
  const layoutsRes = await request.get(`/api/orgs/${orgId}/layouts?eventId=${eventId}`, {
    headers: { authorization: `Bearer ${coupleToken}` },
  });
  expect(layoutsRes.status()).toBe(200);
  const { layouts } = (await layoutsRes.json()) as { layouts: Array<any> };
  const proposal = layouts.find((l: any) => l.event_id === eventId);
  expect(proposal, 'a layout proposal must exist after applying the template').toBeTruthy();

  expect(allErrors, `template flow produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
