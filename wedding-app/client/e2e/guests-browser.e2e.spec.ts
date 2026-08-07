import { test, expect } from '@playwright/test';

/**
 * Cross-event guest browser click-through end-to-end:
 *  - the /#/guests surface lists guests across events,
 *  - the event link deep-links into that event's Guests tab (?tab=guests),
 *  - the Guests tab (restored for staff with guests.view) renders the guest
 *    row + the guest-help inbox container.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('cross-event guest browser deep-links into the event Guests tab', async ({ page, request }) => {
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

  // ── 1. Cross-event browser ──
  await page.goto('/#/guests');
  await expect(page.getByRole('heading', { name: /guests/i }).first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2500);

  // find a row linking to the demo event
  const eventLink = page.locator(`a[href="#/events/${eventId}?tab=guests"]`).first();
  expect(await eventLink.count()).toBeGreaterThanOrEqual(1);
  await eventLink.click();

  // ── 2. Deep-link lands on the event Guests tab ──
  await expect(page).toHaveURL(new RegExp(`#/events/${eventId}\\?tab=guests`), { timeout: 15_000 });
  const guestsTab = page.getByRole('tab', { name: /^Guests/ });
  await expect(guestsTab).toBeVisible({ timeout: 15_000 });
  // the tab content includes the guest table (guests.view holders)
  await expect(page.locator('[role="tabpanel"]').filter({ hasText: /guest/i }).first()).toBeVisible({ timeout: 15_000 });

  expect(allErrors, `guests browser produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
