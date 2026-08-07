/**
 * Gate: the major authenticated surfaces render without console errors,
 * page errors, or HTTP >=400 responses. (Hash-routed app → #/path URLs.)
 * Regression guard for the class of bugs where a dead/unused API call
 * throws a user-visible 400 or console error on a surface.
 */
import { test, expect, Page } from '@playwright/test';

const BASE = process.env.A11Y_BASE_URL || 'http://localhost:3000';

function watch(page: Page, sink: string[]): void {
  page.on('console', (msg) => {
    if (msg.type() === 'error') sink.push(`[console.error] ${msg.text().slice(0, 300)}`);
  });
  page.on('pageerror', (err) => sink.push(`[pageerror] ${String(err).slice(0, 300)}`));
  page.on('requestfailed', (req) => {
    // ERR_ABORTED is navigation/EventSource-cleanup noise, not a defect.
    if (req.failure()?.errorText !== 'net::ERR_ABORTED') {
      sink.push(`[requestfailed] ${req.url().slice(0, 200)} ${req.failure()?.errorText || ''}`);
    }
  });
  page.on('response', (res) => {
    if (res.status() >= 400) sink.push(`[http ${res.status()}] ${res.url().slice(0, 200)}`);
  });
}

const SURFACES = [
  '/#/',
  '/#/calendar',
  '/#/intelligence',
  '/#/vendors',
  '/#/guests',
  '/#/events',
  '/#/system',
  '/#/system/venue',
  '/#/system/catalog',
  '/#/system/inventory',
  '/#/system/integrations',
  '/#/system/questions',
  '/#/system/email-automations',
  '/#/system/platform',
  '/#/system/audit',
  '/#/reports',
  '/#/settings/profile',
];

test('authenticated surfaces render with zero console/network errors', async ({ page }) => {
  test.setTimeout(150_000);
  const allErrors: string[] = [];
  watch(page, allErrors);

  await page.goto(BASE + '/login');
  await page.getByLabel(/email/i).fill('owner@demo.local');
  await page.locator('#pw').fill('wedding123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await page.waitForTimeout(3000);

  for (const surface of SURFACES) {
    const before = allErrors.length;
    await page.goto(BASE + surface);
    await page.waitForTimeout(2500);
    if (allErrors.length > before) {
      // eslint-disable-next-line no-console
      console.log(`--- ${surface} (${allErrors.length - before} issues) ---`);
    }
  }

  expect(allErrors, `surfaces produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
