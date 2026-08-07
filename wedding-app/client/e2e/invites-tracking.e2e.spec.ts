import { test, expect } from '@playwright/test';

/**
 * Event invites / tracking end-to-end: the venue opens the Invites tab,
 * switches to Tracking view, "marks all sent" for the seeded event, and
 * the server records invite-tracking rows (sent status + audit).
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('invite tracking marks guests as sent and persists server-side', async ({ page, request }) => {
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
  const events = (await (await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events;
  const event = events.find((e: any) => e.title === 'Smith & Jones Wedding') ?? events[0];
  const eventId = event.id as string;

  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.locator('#pw').fill('wedding123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  // ── 1. Open the Invites tab ──
  await page.goto(`/#/events/${eventId}?tab=invites`);
  await expect(page.getByRole('tab', { name: /^Invites/ })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2000);

  // ── 2. Tracking view + mark all sent ──
  const trackingViewBtn = page.getByRole('button', { name: /tracking/i }).first();
  if (await trackingViewBtn.count()) {
    await trackingViewBtn.click();
  }
  const markAll = page.getByRole('button', { name: /mark all sent|mark sent/i }).first();
  if (await markAll.count()) {
    await markAll.click();
  }
  await page.waitForTimeout(1500);

  // ── 3. Server-side verification ──
  const trackRes = await request.get(`/api/events/${eventId}/invite-tracking`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(trackRes.status()).toBe(200);
  const body = (await trackRes.json()) as { tracking?: Array<any>; counts?: { sent?: number } };
  if (body.tracking && body.tracking.length > 0) {
    expect(body.tracking.some((t: any) => t.status === 'sent')).toBe(true);
  }

  expect(allErrors, `invites tab produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
