import { test, expect } from '@playwright/test';

/**
 * Browser push UX end-to-end.
 *
 * True RFC 8030 delivery needs VAPID keys + a reachable push service, so
 * this spec verifies the parts that are deterministic in any environment:
 *   1. the notification center surfaces the "Browser push" toggle,
 *   2. when the server has no VAPID keys (the honest degraded state) the
 *      UI SAYS SO up front instead of failing silently,
 *   3. clicking the toggle while unconfigured yields a graceful inline
 *      error (role="alert") — never an uncaught exception.
 *
 * If VAPID keys ARE configured, the click path degrades to the
 * permission-denied branch (headless Chromium denies Notification
 * permission) — also a graceful inline error. Either way the spec asserts
 * the same contract: a friendly, visible explanation, app stays usable.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('push toggle shows honest unconfigured state and fails gracefully', async ({ page, request }) => {
  // ── 0. API setup: owner session + deterministic tour state ──────────
  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();

  // Record what the server reports — the spec adapts to either config.
  const statusRes = await request.get('/api/push/status', {
    headers: { authorization: `Bearer ${token}` },
  });
  const serverConfigured = ((await statusRes.json()) as { configured: boolean }).configured;
  expect(typeof serverConfigured).toBe('boolean');

  const orgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json();
  const tourOrgId = orgs.organizations[0].id as string;
  await request.put('/api/users/me/preferences', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: {
      onboarding: {
        welcomeTourByOrg: {
          [tourOrgId]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() },
        },
      },
    },
  });

  // ── 1. Log in and open the notification center ──────────────────────
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.getByLabel(/^password$/i).fill('wedding123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  await page.getByRole('button', { name: /notifications/i }).click();
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();

  // ── 2. The push toggle exists with honest copy ──────────────────────
  await expect(page.getByText('Browser push')).toBeVisible();
  await expect(page.getByText('Get alerts on this device even when the tab is closed.')).toBeVisible();
  const toggle = page.getByRole('button', { name: 'Enable browser push notifications' });
  await expect(toggle).toBeVisible();

  // ── 3. Unconfigured server → upfront warning, then graceful error ───
  if (!serverConfigured) {
    await expect(
      page.getByText(/push isn't configured on this server yet/i),
    ).toBeVisible();
  }

  await toggle.click();

  // The click must end in a visible inline error (either the VAPID-missing
  // branch or the permission-denied branch), never a silent no-op or crash.
  const alert = page.getByRole('alert');
  await expect(alert).toBeVisible({ timeout: 15_000 });
  await expect(alert).toContainText(/push/i);
  const alertText = (await alert.textContent()) ?? '';
  const graceful = /isn.t configured on this server yet|notifications were blocked|not supported/i.test(alertText);
  expect(graceful).toBeTruthy();

  // App shell still alive and interactive after the failed attempt.
  await expect(page.locator('body')).toContainText(/dashboard/i);
});
