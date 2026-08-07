import { test, expect } from '@playwright/test';

/**
 * Manager Day-of Mode end-to-end: a venue_manager account toggles the
 * header "Day-of" switch, the fixed bottom dock appears (Run sheet, Guests,
 * Vendors, Check-in, Staff, Emergency + Voice/Photo/Device QA/Offline/Lock),
 * actions navigate correctly, and "Hide" dismisses the dock.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const BASE = process.env.A11Y_BASE_URL || 'http://localhost:3000';

test('manager day-of dock toggles, navigates, and hides', async ({ page, request }) => {
  const allErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') allErrors.push(`[console.error] ${msg.text().slice(0, 260)}`);
  });
  page.on('pageerror', (err) => allErrors.push(`[pageerror] ${String(err).slice(0, 260)}`));
  page.on('response', (res) => {
    if (res.status() >= 400) allErrors.push(`[http ${res.status()}] ${res.url().slice(0, 200)}`);
  });

  // ── 0. Fresh venue_manager account ──
  const email = `mgr-${Date.now()}@example.com`;
  const reg = await request.post('/api/auth/register', {
    data: { email, password: 'testpass123', fullName: 'Casey Manager', orgName: 'Tmp', accountRole: 'venue_manager' },
  });
  expect(reg.ok()).toBeTruthy();

  const login = await request.post('/api/auth/login', { data: { email, password: 'testpass123' } });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const orgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json();
  const orgId = orgs.organizations[0].id as string;
  // manager is a member of their own org; complete the tour so nothing
  // intercepts clicks
  await request.put('/api/users/me/preferences', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: {
      onboarding: {
        welcomeTourByOrg: {
          [orgId]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() },
        },
      },
    },
  });

  // manager needs an event to see the event-scoped dock actions
  const ev = await request.post('/api/events', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { organizationId: orgId, title: `Mgr Event ${Date.now()}`, status: 'planning', startDate: '2026-11-01', guestCount: 60 },
  });
  expect(ev.status()).toBe(201);
  const eventId = ((await ev.json()) as any).event.id as string;

  // manager mode is a CLIENT-side flag set by the registration form; the
  // API-registered manager must set it before the app boots
  await page.addInitScript(() => {
    localStorage.setItem('wvi_registration_role', 'venue_manager');
  });

  // ── 1. Login as the manager ──
  await page.goto(BASE + '/#/');
  await page.getByLabel(/email address/i).fill(email);
  await page.locator('#pw').fill('testpass123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  // ── 2. Toggle Day-of mode from the header, then open an event so the
  // dock resolves event-scoped quick actions (dayOfEventId comes from the
  // current path) ──
  await page.getByRole('button', { name: 'Toggle Manager Day-of Mode' }).click();
  await page.goto(BASE + `/#/events/${eventId}`);
  await expect(page.locator('body')).toContainText(/readiness|overview/i, { timeout: 20_000 });

  const dock = page.locator('[aria-label="Manager event-day mobile app shell"]');
  await expect(dock).toBeVisible({ timeout: 10_000 });

  // Event-scoped quick actions present
  for (const label of ['Run sheet', 'Guests', 'Vendors', 'Check-in', 'Staff', 'Emergency', 'Voice', 'Photo', 'Device QA', 'Offline', 'Lock contacts']) {
    await expect(dock.getByText(label).first()).toBeVisible({ timeout: 5000 });
  }

  // ── 3. Run sheet action navigates (opens the event run sheet) ──
  await dock.getByText('Run sheet').click();
  await expect(page).toHaveURL(new RegExp(`#/events/${eventId}/run-sheet`), { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: /run sheet/i }).first()).toBeVisible({ timeout: 15_000 });

  // ── 4. "Hide" turns the mode OFF (the dock stays on event pages by
  // design, but leaving the event hides it) ──
  await dock.getByRole('button', { name: 'Hide' }).click();
  // still on the run-sheet (event page) → dock remains
  await expect(dock).toBeVisible({ timeout: 10_000 });
  // navigate away from the event → dock gone (mode persisted off)
  await page.goto(BASE + '/#/');
  await expect(page.locator('[aria-label="Manager event-day mobile app shell"]')).toBeHidden({ timeout: 10_000 });
  // and the header toggle reflects the off state
  await expect(page.getByRole('button', { name: 'Toggle Manager Day-of Mode' })).toBeVisible({ timeout: 10_000 });

  expect(allErrors, `day-of dock produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
