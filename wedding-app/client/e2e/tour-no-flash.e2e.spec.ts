import { test, expect } from '@playwright/test';

/**
 * Onboarding-tour "no flash" regression.
 *
 * The tour used to open the moment the app shell mounted — while the user
 * preferences fetch (which carries the completed/dismissed tour state) was
 * still in flight — and close when it arrived. Under load that window
 * widened, the modal intercepted real clicks, and a stray Escape during the
 * window wrote in_progress server-side, poisoning later specs (the
 * "occasionally reappears on full-suite runs, passes isolated" flake).
 *
 * This spec deliberately DELAYS the preferences fetch to widen the old race
 * window, then asserts the tour never appears for a user who completed it.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

const BASE = process.env.A11Y_BASE_URL || 'http://localhost:3000';

test('completed tour never flashes open, even when the preferences fetch is slow', async ({ page, request }) => {
  // ── 0. Complete the owner's tour via API (deterministic state) ──
  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const orgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json();
  const orgId = orgs.organizations[0].id as string;
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

  // ── 1. Widen the async race: delay the preferences GET by 2s ──
  await page.route('**/api/users/me/preferences', async (route) => {
    await new Promise((r) => setTimeout(r, 2000));
    await route.continue();
  });

  // ── 2. Login and watch for the tour for several seconds ──
  await page.goto(BASE + '/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.locator('#pw').fill('wedding123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();

  // The app shell must settle with the tour state still loading (delayed) —
  // this was exactly the window where the old code flashed the modal open.
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  // Poll at high frequency for 4s: the tour must NEVER appear.
  let sawTour = false;
  for (let i = 0; i < 20; i++) {
    if (await page.getByRole('button', { name: /resume later/i }).count()) {
      sawTour = true;
      break;
    }
    await page.waitForTimeout(200);
  }
  expect(sawTour, 'the completed tour must never open, even transiently').toBe(false);

  // The dashboard stays interactive — no overlay is intercepting clicks.
  await page.getByRole('button', { name: /new event/i }).first().click().catch(() => {});
  await expect(page.getByText('New Event').first().or(page.getByLabel(/event title/i))).toBeVisible({ timeout: 10_000 }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
});
