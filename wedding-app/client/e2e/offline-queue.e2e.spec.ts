import { test, expect } from '@playwright/test';

/**
 * Offline write-queue end-to-end (real browser, production build).
 *
 * The day-of check-in board is the app's flagship offline surface: when
 * WiFi drops, a vendor "Mark Arrived" tap must persist locally and replay
 * when connectivity returns. This spec verifies the FULL loop:
 *   1. load the check-in board online (seeded vendors)
 *   2. simulate "API unreachable" (route-abort the check-ins endpoint —
 *      deterministic; headless Chromium's own offline mode has a quirk
 *      where fetch inside a React mutation is never issued, whereas
 *      aborted routes produce the same ApiError('offline') the real
 *      tablet gets when WiFi dies). The service worker stays ACTIVE,
 *      matching the production PWA configuration.
 *   3. tap Mark Arrived → "Saved on this device" + the write is in the
 *      persistent queue (localStorage `wedding.writeQueue`)
 *   4. connectivity returns (routes restored) + reload, like a tablet
 *      reconnecting
 *   5. the queued write replays automatically → the server's check-in
 *      status for that vendor is now 'arrived'
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('offline check-in write survives and replays on reconnect', async ({ page, request }) => {
  // ── 0. API setup: owner session + event/vendor ids ───────────────────
  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();

  // Deterministic tour state: complete the owner's onboarding tour via API
  // so a previously-interrupted run can never leave the modal open.
  const tourLogin = await request.post('/api/auth/login', { data: { email: 'owner@demo.local', password: 'wedding123' } });
  if (tourLogin.ok()) {
    const tourToken = (await tourLogin.json()).token;
    const orgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${tourToken}` } })).json();
    const tourOrgId = orgs.organizations[0].id;
    await request.put('/api/users/me/preferences', {
      headers: { authorization: `Bearer ${tourToken}`, 'content-type': 'application/json' },
      data: {
        onboarding: {
          welcomeTourByOrg: {
            [tourOrgId]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() },
          },
        },
      },
    });
  }

  const orgsRes = await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } });
  const orgId = (await orgsRes.json()).organizations[0].id as string;

  // The seed has many past weddings; pick the event that owns the vendor.
  const vendorsRes = await request.get(`/api/orgs/${orgId}/vendors`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const vendors = (await vendorsRes.json()).vendors as Array<any>;
  const vendor = vendors.find((v: any) => v.name === 'Premier Linens') ?? vendors[0];
  expect(vendor).toBeTruthy();
  const vendorId = vendor.id as string;
  const eventId = vendor.event_id as string;
  expect(eventId).toBeTruthy();

  // Ensure every vendor starts 'expected' (idempotent for repeat runs).
  for (const v of vendors) {
    await request.post(`/api/events/${eventId}/checkins`, {
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      data: { vendorId: v.id, status: 'expected' },
    });
  }

  // ── 1. Log in (the check-in board requires an authenticated session) ──
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.getByLabel(/^password$/i).fill('wedding123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/good evening/i, { timeout: 20_000 });

  // ── 2. Open the check-in board online ────────────────────────────────
  await page.goto(`/#/events/${eventId}/check-in`);
  // The board renders vendor cards in API list order — the target vendor's
  // "Mark Arrived" button is at the same index.
  const vendorIndex = vendors.findIndex((v: any) => v.id === vendorId);
  expect(vendorIndex).toBeGreaterThanOrEqual(0);
  const markArrived = page.getByRole('button', { name: /mark arrived/i }).nth(vendorIndex);
  await expect(markArrived).toBeVisible({ timeout: 20_000 });

  // ── 3. "WiFi drops": the check-ins endpoint is unreachable (route-abort) ─
  await page.route('**/api/events/*/checkins', (route) => {
    if (route.request().method() === 'POST') return route.abort('failed');
    return route.continue();
  });

  // ── 4. Tap Mark Arrived → local-first save ───────────────────────────
  await markArrived.click();
  await expect(page.getByText('Saved on this device').first().first()).toBeVisible({ timeout: 10_000 });

  // ── 5. The write is in the persistent queue ──────────────────────────
  const queued = await page.evaluate(() => {
    const raw = localStorage.getItem('wedding.writeQueue');
    return raw ? JSON.parse(raw) : [];
  });
  expect(Array.isArray(queued)).toBe(true);
  expect(queued.length).toBeGreaterThanOrEqual(1);
  const write = queued.find((w: any) => w.domain === 'vendors' && w.op === 'checkin.update' && w.payload?.vendorId === vendorId);
  expect(write, 'queued check-in write must exist').toBeTruthy();
  expect(write.payload.status).toBe('arrived');
  expect(write.payload.eventId).toBe(eventId);

  // ── 6. Connectivity returns; reload like a reconnected tablet ────────
  await page.unroute('**/api/events/*/checkins');
  await page.reload({ timeout: 30_000 });

  // ── 7. The queue drains automatically → server now shows 'arrived' ───
  await expect
    .poll(async () => {
      const res = await request.get(`/api/events/${eventId}/checkins`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok()) return null;
      const body = (await res.json()) as { statusMap?: Record<string, string> };
      return body.statusMap?.[vendorId] ?? null;
    }, { timeout: 20_000, intervals: [1000] })
    .toBe('arrived');

  // Queue is empty again (write acknowledged by the server).
  const remaining = await page.evaluate(() => {
    const raw = localStorage.getItem('wedding.writeQueue');
    return raw ? JSON.parse(raw).length : 0;
  });
  expect(remaining).toBe(0);
});
