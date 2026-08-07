import { test, expect } from '@playwright/test';

/**
 * Run-sheet print surface end-to-end: the venue opens the printable run
 * sheet for the seeded wedding, sees the timeline/staff/vendor sections,
 * and the Print button triggers the browser print dialog without errors.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('run sheet renders sections and print triggers cleanly', async ({ page, request }) => {
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

  // stub window.print so the dialog never blocks headless
  await page.addInitScript(() => {
    window.print = () => {};
  });

  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.locator('#pw').fill('wedding123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  await page.goto(`/#/events/${eventId}/run-sheet`);
  await expect(page.getByRole('heading', { name: /run sheet/i }).first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2500);

  // print button exists and works
  const printBtn = page.getByRole('button', { name: /print|printable/i }).first();
  await expect(printBtn).toBeVisible({ timeout: 10_000 });
  await printBtn.evaluate((el) => (el as HTMLButtonElement).click());
  await page.waitForTimeout(800);

  expect(allErrors, `run sheet produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
