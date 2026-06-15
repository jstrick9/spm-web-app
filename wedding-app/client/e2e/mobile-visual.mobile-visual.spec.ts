import { test, expect, type Page } from '@playwright/test';

/**
 * Authenticated mobile/tablet visual regression snapshots.
 *
 * These screens are the most important first-time-owner and day-of workflows:
 * dashboard, pipeline, Event Detail mobile tab selector, mobile guest lookup,
 * phone-friendly run sheet, QR/manual check-in, and Integration Hub setup.
 */
const OWNER_EMAIL = process.env.MOBILE_VISUAL_EMAIL ?? 'owner@demo.local';
const OWNER_PASSWORD = process.env.MOBILE_VISUAL_PASSWORD ?? 'wedding123';

type SeedContext = { token: string; orgId: string; eventId: string };

async function authenticate(page: Page): Promise<SeedContext> {
  const loginResponse = await page.request.post('/api/auth/login', {
    data: { email: OWNER_EMAIL, password: OWNER_PASSWORD },
  });
  if (!loginResponse.ok()) throw new Error(`Login failed: ${loginResponse.status()} ${await loginResponse.text()}`);
  const { token } = await loginResponse.json() as { token: string };

  const orgResponse = await page.request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } });
  if (!orgResponse.ok()) throw new Error(`Org lookup failed: ${orgResponse.status()} ${await orgResponse.text()}`);
  const { organizations } = await orgResponse.json() as { organizations: Array<{ id: string }> };
  const orgId = organizations[0]?.id;
  if (!orgId) throw new Error('No seeded organization found. Run seed before mobile visual tests.');

  const eventsResponse = await page.request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } });
  if (!eventsResponse.ok()) throw new Error(`Event lookup failed: ${eventsResponse.status()} ${await eventsResponse.text()}`);
  const { events } = await eventsResponse.json() as { events: Array<{ id: string }> };
  const eventId = events[0]?.id;
  if (!eventId) throw new Error('No seeded event found. Run seed before mobile visual tests.');

  await page.addInitScript((jwt) => {
    window.localStorage.setItem('wedding-jwt', jwt as string);
    window.localStorage.setItem('wvi_welcome_seen', 'true');
    window.localStorage.setItem('wvi_show_owner_setup', 'false');

    // Freeze time so day-of clock/status surfaces do not churn screenshots.
    const fixed = new Date('2026-06-08T15:30:00-04:00').valueOf();
    const RealDate = Date;
    class FixedDate extends RealDate {
      constructor(...args: any[]) {
        super(...(args.length ? args : [fixed]));
      }
      static now() { return fixed; }
    }
    (window as any).Date = FixedDate;
  }, token);

  return { token, orgId, eventId };
}

async function dismissOnboarding(page: Page) {
  for (const label of [/Skip for now/i, /Resume later/i, /Close/i, /Not now/i]) {
    const button = page.getByRole('button', { name: label }).first();
    if (await button.isVisible().catch(() => false)) {
      await button.click().catch(() => undefined);
      await page.waitForTimeout(150);
    }
  }
}

async function stabilize(page: Page) {
  await page.addStyleTag({ content: `
    *, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; caret-color: transparent !important; }
    .animate-ping, .animate-pulse, .animate-spin { animation: none !important; }
  ` });
  await dismissOnboarding(page);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(750);
}

async function capture(page: Page, name: string) {
  await stabilize(page);
  await expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.015,
    timeout: 15_000,
  });
}

test.describe('mobile/tablet visual regression @mobile-visual', () => {
  test('authenticated owner and day-of workflows are viewport-stable', async ({ page }) => {
    const { eventId } = await authenticate(page);
    const viewport = page.viewportSize();
    const isPhone = (viewport?.width ?? 999) < 640;
    const isCompact = (viewport?.width ?? 999) < 768;

    await page.goto('/#/');
    await expect(page.locator('#main-content')).toBeVisible();
    await capture(page, 'owner-dashboard');

    await page.goto('/#/events');
    await expect(page.locator('#main-content')).toBeVisible();
    await capture(page, 'event-pipeline');

    await page.goto(`/#/events/${eventId}`);
    await expect(page.locator('#main-content')).toBeVisible();
    await capture(page, 'event-detail-overview');

    await page.goto(`/#/events/${eventId}?tab=guests`);
    await expect(page.locator('#main-content')).toBeVisible();
    await capture(page, isPhone ? 'event-guests-mobile-lookup' : 'event-guests-tablet');

    await page.goto(`/#/events/${eventId}?tab=layout`);
    await expect(page.locator('#main-content')).toBeVisible();
    await capture(page, isCompact ? 'layout-mobile-review' : 'layout-tablet-review');

    await page.goto(`/#/events/${eventId}/run-sheet`);
    await expect(page.getByText('Phone-friendly day-of command center')).toBeVisible();
    await capture(page, 'day-of-run-sheet');

    await page.goto(`/#/events/${eventId}/check-in`);
    await expect(page.getByText('Vendor Check-In')).toBeVisible();
    await capture(page, 'vendor-check-in');

    await page.goto('/#/system/integrations');
    await expect(page.locator('#main-content')).toBeVisible();
    await capture(page, 'integration-hub');
  });
});
