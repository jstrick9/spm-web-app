import { test, expect } from '@playwright/test';

/**
 * Event emergency tab end-to-end: the venue activates Plan B (weather
 * backup) and pushes a mass emergency broadcast; both persist in the event
 * metadata and the Plan B warning banner renders.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('venue activates the weather backup plan and broadcasts an emergency announcement', async ({ page, request }) => {
  const allErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') allErrors.push(`[console.error] ${msg.text().slice(0, 260)}`);
  });
  page.on('pageerror', (err) => allErrors.push(`[pageerror] ${String(err).slice(0, 260)}`));
  page.on('response', (res) => {
    if (res.status() >= 400) allErrors.push(`[http ${res.status()}] ${res.url().slice(0, 200)}`);
  });

  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;

  // The Emergency tab is stage-gated to final_review/completed ("protocols
  // appear once the plan is concrete") — create planning then stage to
  // completed so the tab is visible.
  const created = await request.post('/api/events', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { organizationId: orgId, title: `Emergency ${Date.now()}`, status: 'planning', startDate: '2026-10-10', guestCount: 80 },
  });
  expect(created.status()).toBe(201);
  const eventId = ((await created.json()) as any).event.id as string;
  const staged = await request.post(`/api/events/${eventId}/stage`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { status: 'completed' },
  });
  expect(staged.status()).toBe(200);

  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.locator('#pw').fill('wedding123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  // ── 1. Open the Emergency tab ──
  await page.goto(`/#/events/${eventId}?tab=emergency`);
  await expect(page.getByRole('tab', { name: /^Emergency/ })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Weather & Contingency Status/i)).toBeVisible({ timeout: 15_000 });

  // ── 2. Activate Plan B ──
  await page.getByRole('button', { name: /Plan B: Weather Backup/i }).click();
  await expect(page.getByText(/Plan B: Weather Contingency is ACTIVE/i)).toBeVisible({ timeout: 10_000 });

  // ── 3. Compose + broadcast an announcement ──
  const broadcastText = `Weather alert for ${Date.now()}: moving indoors.`;
  await page.locator('#broadcast-input').fill(broadcastText);
  await page.getByRole('button', { name: /broadcast/i }).first().click();
  await expect(page.getByText('Emergency Announcement Broadcasted').first()).toBeVisible({ timeout: 15_000 });

  // ── 4. Server-side verification ──
  const evRes = await request.get(`/api/events/${eventId}`, { headers: { authorization: `Bearer ${token}` } });
  expect(evRes.status()).toBe(200);
  const { event } = (await evRes.json()) as { event: { metadata: string | Record<string, any> } };
  const meta = typeof event.metadata === 'string' ? JSON.parse(event.metadata || '{}') : (event.metadata || {});
  expect(meta.emergency_active_plan).toBe('plan-b');
  expect(meta.emergency_broadcast_announcement).toBe(broadcastText);

  expect(allErrors, `emergency tab produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
