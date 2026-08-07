import { test, expect } from '@playwright/test';

/**
 * Rain-plan wiring end-to-end: the coordinator toggles Plan B from the
 * Emergency tab and the event is REALLY moved to the configured backup
 * space (the server's activate-rain-plan route), then restored with
 * Plan A. Also covers the honest "no backup configured" path and the
 * Venue Builder UI that configures the backup space.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

const BASE = process.env.A11Y_BASE_URL || 'http://localhost:3000';

async function loginViaUi(page: import('@playwright/test').Page) {
  await page.goto(BASE + '/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.locator('#pw').fill('wedding123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });
}

test('Plan B moves the event to the configured backup space and Plan A restores it', async ({ page, request }) => {
  const allErrors: string[] = [];
  page.on('console', (msg) => { if (msg.type() === 'error') allErrors.push(`[console.error] ${msg.text().slice(0, 260)}`); });
  page.on('pageerror', (err) => allErrors.push(`[pageerror] ${String(err).slice(0, 260)}`));
  page.on('response', (res) => { if (res.status() >= 400) allErrors.push(`[http ${res.status()}] ${res.url().slice(0, 200)}`); });

  const stamp = Date.now();
  const login = await request.post('/api/auth/login', { data: { email: 'owner@demo.local', password: 'wedding123' } });
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;

  // Two approved spaces: the outdoor lawn (event home) + the garden tent (backup).
  const mkVenue = async (name: string) => {
    const res = await request.post(`/api/orgs/${orgId}/venues`, {
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      data: { name, category: 'outdoor', capacity: 200, approvalStatus: 'approved' },
    });
    expect(res.status()).toBe(201);
    return (await res.json()) as { venue: { id: string; name: string } };
  };
  const lawn = await mkVenue(`E2E Rain Lawn ${stamp}`);
  const tent = await mkVenue(`E2E Rain Tent ${stamp}`);

  const setRef = await request.patch(`/api/venues/${lawn.venue.id}`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { metadata: { rainPlanVenueId: tent.venue.id } },
  });
  expect(setRef.status()).toBe(200);

  // Planning event staged to completed so the Emergency tab is visible.
  const created = await request.post('/api/events', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { organizationId: orgId, title: `Rain Plan E2E ${stamp}`, status: 'planning', startDate: '2026-10-10', guestCount: 80 },
  });
  expect(created.status()).toBe(201);
  const eventId = ((await created.json()) as any).event.id as string;
  const assigned = await request.patch(`/api/events/${eventId}`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { venueId: lawn.venue.id },
  });
  expect(assigned.status()).toBe(200);
  const staged = await request.post(`/api/events/${eventId}/stage`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { status: 'completed' },
  });
  expect(staged.status()).toBe(200);

  const eventVenue = async () => {
    const res = await request.get(`/api/events/${eventId}`, { headers: { authorization: `Bearer ${token}` } });
    return ((await res.json()) as any).event.venue_id as string;
  };

  await loginViaUi(page);
  await page.goto(BASE + `/#/events/${eventId}?tab=emergency`);
  await expect(page.getByText(/Weather & Contingency Status/i)).toBeVisible({ timeout: 15_000 });

  // Buttons show the REAL space names, not placeholder copy.
  await expect(page.getByRole('button', { name: new RegExp(`Plan A: ${lawn.venue.name}`) })).toBeVisible();
  const planB = page.getByRole('button', { name: new RegExp(`Plan B: ${tent.venue.name}`) });
  await planB.click();

  // The event is actually moved server-side.
  await expect(page.getByText(new RegExp(`The event has been moved to ${tent.venue.name}`)).first()).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => eventVenue(), { timeout: 15_000 }).toBe(tent.venue.id);

  // Banner reflects the real backup space.
  await expect(page.getByText(/moved to/).first()).toBeVisible();

  // Plan A restores the original space.
  await page.getByRole('button', { name: new RegExp(`Plan A: ${tent.venue.name}`) }).click();
  await expect(page.getByText(new RegExp(`back at ${lawn.venue.name}`)).first()).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => eventVenue(), { timeout: 15_000 }).toBe(lawn.venue.id);

  expect(allErrors, `rain-plan activation flow produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});

test('Plan B without a configured backup records the flag but keeps the space, with honest guidance', async ({ page, request }) => {
  const stamp = Date.now();
  const login = await request.post('/api/auth/login', { data: { email: 'owner@demo.local', password: 'wedding123' } });
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;

  const lawnRes = await request.post(`/api/orgs/${orgId}/venues`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { name: `E2E NoBackup Lawn ${stamp}`, category: 'outdoor', capacity: 200, approvalStatus: 'approved' },
  });
  const lawnId = ((await lawnRes.json()) as any).venue.id as string;

  const created = await request.post('/api/events', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { organizationId: orgId, title: `Rain Plan NoBackup ${stamp}`, status: 'planning', startDate: '2026-10-10', guestCount: 80 },
  });
  const eventId = ((await created.json()) as any).event.id as string;
  await request.patch(`/api/events/${eventId}`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { venueId: lawnId },
  });
  await request.post(`/api/events/${eventId}/stage`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { status: 'completed' },
  });

  await loginViaUi(page);
  await page.goto(BASE + `/#/events/${eventId}?tab=emergency`);
  await expect(page.getByText(/Weather & Contingency Status/i)).toBeVisible({ timeout: 15_000 });

  // No backup configured → button falls back to generic label.
  await page.getByRole('button', { name: /Plan B: Weather Backup/i }).click();
  await expect(page.getByText(/No backup space is configured/).first()).toBeVisible({ timeout: 15_000 });

  // The event was NOT moved.
  const res = await request.get(`/api/events/${eventId}`, { headers: { authorization: `Bearer ${token}` } });
  expect(((await res.json()) as any).event.venue_id).toBe(lawnId);
});

test('Venue Builder configures the rain-plan backup space for a venue', async ({ page, request }) => {
  const stamp = Date.now();
  const login = await request.post('/api/auth/login', { data: { email: 'owner@demo.local', password: 'wedding123' } });
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;

  const mkVenue = async (name: string) => {
    const res = await request.post(`/api/orgs/${orgId}/venues`, {
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      data: { name, category: 'indoor', capacity: 150, approvalStatus: 'approved' },
    });
    return ((await res.json()) as any).venue as { id: string; name: string };
  };
  const main = await mkVenue(`E2E Backup Main ${stamp}`);
  const alt = await mkVenue(`E2E Backup Alt ${stamp}`);

  await loginViaUi(page);
  await page.goto(BASE + '/#/system/venue');
  await expect(page.getByText('Venue Space Setup').first()).toBeVisible({ timeout: 15_000 });

  // Select the space from the Existing spaces list.
  const card = page.getByRole('button', { name: new RegExp(main.name) });
  await card.click();

  // The rain-plan backup row appears with the current space selected.
  const backupSelect = page.locator('#rain-plan-backup');
  await expect(backupSelect).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/rain plan backup space/i).first()).toBeVisible();

  // Pick the alternate space and save.
  await backupSelect.selectOption(alt.id);
  await expect(page.getByText('Rain plan backup saved').first()).toBeVisible({ timeout: 15_000 });

  // Server-side verification.
  const venues = (await (await request.get(`/api/orgs/${orgId}/venues`, { headers: { authorization: `Bearer ${token}` } })).json()).venues as Array<any>;
  const saved = venues.find((v: any) => v.id === main.id);
  const meta = typeof saved.metadata === 'string' ? JSON.parse(saved.metadata || '{}') : saved.metadata || {};
  expect(meta.rainPlanVenueId).toBe(alt.id);
});
