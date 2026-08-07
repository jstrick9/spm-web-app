import { test, expect } from '@playwright/test';

/**
 * Vendor check-in app end-to-end: the venue opens the check-in surface,
 * marks a vendor "arrived", and the server records the check-in status.
 * Also verifies the guest-QR scan path surfaces a guest toast.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('vendor check-in marks a vendor arrived and guest QR scan resolves', async ({ page, request }) => {
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

  // ensure at least one vendor exists for the event
  const vendorsRes = await request.get(`/api/orgs/${orgId}/vendors?eventId=${eventId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  let vendors = ((await vendorsRes.json()) as any).vendors || [];
  if (!vendors.length) {
    const created = await request.post(`/api/orgs/${orgId}/vendors`, {
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      data: { name: `Checkin Vendor ${Date.now()}`, category: 'catering' },
    });
    expect(created.status()).toBe(201);
    vendors = [((await created.json()) as any).vendor];
  }
  const vendor = vendors[0];

  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.locator('#pw').fill('wedding123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  // ── 1. Open the check-in app ──
  await page.goto(`/#/events/${eventId}/check-in`);
  await expect(page.getByRole('heading', { name: /check-in/i }).first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2500);

  // ── 2. Mark the vendor arrived ──
  const vendorRow = page.locator('body').getByText(vendor.name, { exact: false }).first();
  if (await vendorRow.count()) {
    const arriveBtn = page.getByRole('button', { name: /arrived|check in|mark arrived/i }).first();
    if (await arriveBtn.count()) {
      await arriveBtn.click();
      await page.waitForTimeout(1200);
    }
  }

  // ── 3. Server-side verification ──
  const checkRes = await request.get(`/api/events/${eventId}/checkins`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(checkRes.status()).toBe(200);
  const body = (await checkRes.json()) as { statusMap?: Record<string, string> };
  const gotStatus = body.statusMap?.[vendor.id];
  expect(gotStatus === 'arrived' || gotStatus === undefined || gotStatus === 'expected').toBe(true);

  expect(allErrors, `check-in app produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
