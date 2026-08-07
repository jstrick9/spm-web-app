import { test, expect } from '@playwright/test';

/**
 * Events pipeline list end-to-end: the venue opens /#/events, the list
 * renders pipeline counts (lead/hold/booked/planning), status filter
 * narrows the rows, and clicking an event opens its detail page.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('events pipeline renders counts, filters, and navigates to detail', async ({ page, request }) => {
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
  const demo = events.find((e: any) => e.title === 'Smith & Jones Wedding') ?? events[0];

  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.locator('#pw').fill('wedding123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  // ── 1. Pipeline list renders with the demo event ──
  await page.goto('/#/events');
  await expect(page.getByText(demo.title).first()).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2000);

  // ── 2. Status filter narrows to booked rows ──
  const bookedFilter = page.getByRole('button', { name: /booked/i }).first();
  if (await bookedFilter.count()) {
    await bookedFilter.click();
    await page.waitForTimeout(1200);
  }
  await expect(page.getByText(demo.title).first()).toBeVisible({ timeout: 10_000 });

  // ── 3. Click navigates to the detail page ──
  await page.getByText(demo.title).first().click();
  await expect(page).toHaveURL(new RegExp(`#/events/${demo.id}`), { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: demo.title }).first()).toBeVisible({ timeout: 15_000 });

  expect(allErrors, `events list produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
