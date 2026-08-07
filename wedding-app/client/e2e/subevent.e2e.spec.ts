import { test, expect } from '@playwright/test';

/**
 * Sub-event creation end-to-end — regression for the gap where the venue
 * could never create a sub-event from the UI (only edit pre-existing ones):
 *  - venue adds a sub-event from the event Portal settings tab,
 *  - the server records it,
 *  - the venue fills guest-facing details (location, host),
 *  - a guest's portal itinerary shows the sub-event with those details.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

const BASE = process.env.A11Y_BASE_URL || 'http://localhost:3000';

test('venue creates a sub-event and guests see it in their itinerary', async ({ page, request }) => {
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

  // Portal tab is stage-gated — planning exposes it
  const created = await request.post('/api/events', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { organizationId: orgId, title: `SubEvent ${Date.now()}`, status: 'planning', startDate: '2026-11-20', guestCount: 60 },
  });
  expect(created.status()).toBe(201);
  const eventId = ((await created.json()) as any).event.id as string;

  // guest for the itinerary check
  const stamp = Date.now();
  const g = await request.post(`/api/events/${eventId}/couple-guests`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { fullName: `Sub Guest ${stamp}`, email: `subg-${stamp}@example.com`, rsvpStatus: 'pending' },
  });
  expect(g.status()).toBe(201);
  const guestId = (await g.json()).guest.id as string;
  const linkRes = await request.post(`/api/events/${eventId}/couple-guests/${guestId}/portal-link`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const { token: guestToken } = (await linkRes.json()) as { token: string };

  // ── 1. Venue creates the sub-event from the Portal settings tab ──
  await page.goto(BASE + '/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.locator('#pw').fill('wedding123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  await page.goto(BASE + `/#/events/${eventId}?tab=portal`);
  await expect(page.getByText(/Guest-facing sub-event details/i)).toBeVisible({ timeout: 15_000 });

  const title = `Rehearsal Dinner ${stamp}`;
  await page.getByLabel('Sub-event title').fill(title);
  await page.getByLabel('Sub-event start time').fill('2026-11-19T17:30');
  await page.getByRole('button', { name: 'Add sub-event' }).click();
  await expect(page.getByText('Sub-event created').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });

  // fill guest-facing details: location + host
  const locationInput = page.locator(`input[placeholder="Location/address"]`).first();
  await locationInput.fill('Garden Pavilion');
  const hostInput = page.locator(`input[placeholder="Host"]`).first();
  await hostInput.fill('The Johnsons');
  await page.getByRole('button', { name: 'Save details' }).first().click();
  await expect(page.getByText('Sub-event guest details saved').first()).toBeVisible({ timeout: 15_000 });

  // ── 2. Server verification ──
  const subRes = await request.get(`/api/events/${eventId}/sub-events`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(subRes.status()).toBe(200);
  const { subEvents } = (await subRes.json()) as { subEvents: Array<any> };
  const sub = subEvents.find((s: any) => s.title === title);
  expect(sub, 'sub-event must be recorded server-side').toBeTruthy();
  const meta = typeof sub.metadata === 'string' ? JSON.parse(sub.metadata || '{}') : (sub.metadata || {});
  expect(meta.location).toBe('Garden Pavilion');
  expect(meta.host).toBe('The Johnsons');

  // ── 3. Guest sees the sub-event in their portal itinerary ──
  await page.goto(`${BASE}/#/portal/${eventId}?guest=${guestId}&token=${guestToken}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Guest Schedule').first()).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /Weekend Sub-Events/i }).click();
  await expect(page.getByText(title).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Garden Pavilion/i).first()).toBeVisible({ timeout: 10_000 });

  expect(allErrors, `sub-event flow produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
