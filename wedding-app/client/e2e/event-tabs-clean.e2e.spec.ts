/**
 * Gate: every tab of a seeded demo event renders without console errors,
 * page errors, or HTTP >=400 responses. Caught a real defect: the Layout
 * tab requested catalog kind 'decor' (not a server kind) → 400 on every open.
 */
import { test, expect, Page } from '@playwright/test';

const BASE = process.env.A11Y_BASE_URL || 'http://localhost:3000';

function watch(page: Page, sink: string[]): void {
  page.on('console', (msg) => {
    if (msg.type() === 'error') sink.push(`[console.error] ${msg.text().slice(0, 300)}`);
  });
  page.on('pageerror', (err) => sink.push(`[pageerror] ${String(err).slice(0, 300)}`));
  page.on('requestfailed', (req) => {
    if (req.failure()?.errorText !== 'net::ERR_ABORTED') {
      sink.push(`[requestfailed] ${req.url().slice(0, 200)} ${req.failure()?.errorText || ''}`);
    }
  });
  page.on('response', (res) => {
    if (res.status() >= 400) sink.push(`[http ${res.status()}] ${res.url().slice(0, 200)}`);
  });
}

const EXPECTED_TABS = ['Overview', 'Timeline', 'Layout', 'Guests', 'Invites', 'Polls & Feedback', 'Vendors', 'Budget', 'Contracts', 'Documents', 'Chat', 'Settings'];

test('every event-detail tab renders with zero console/network errors', async ({ page }) => {
  test.setTimeout(120_000);
  const allErrors: string[] = [];
  watch(page, allErrors);

  await page.goto(BASE + '/login');
  await page.getByLabel(/email/i).fill('owner@demo.local');
  await page.locator('#pw').fill('wedding123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await page.waitForTimeout(3000);

  const orgRes = await page.evaluate(async () => {
    const token = localStorage.getItem('wedding-jwt');
    const res = await fetch('/api/orgs', { headers: { Authorization: `Bearer ${token}` } });
    return res.json();
  });
  const orgId = orgRes.organizations[0].id;
  const evRes = await page.evaluate(async (oid) => {
    const token = localStorage.getItem('wedding-jwt');
    const res = await fetch(`/api/orgs/${oid}/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.json();
  }, orgId);
  const evs = evRes.events || evRes;
  const demo = evs.find((e: any) => e.title.includes('Smith & Jones')) || evs[0];
  expect(demo).toBeTruthy();

  await page.goto(BASE + `/#/events/${demo.id}`);
  await page.waitForTimeout(3500);

  const seen: string[] = [];
  for (const t of EXPECTED_TABS) {
    const before = allErrors.length;
    const trigger = page.getByRole('tab', { name: new RegExp(`^${t}`) });
    if (await trigger.count()) {
      await trigger.first().click();
      await page.waitForTimeout(1500);
      seen.push(t);
      if (allErrors.length > before) {
        // eslint-disable-next-line no-console
        console.log(`--- tab ${t} (${allErrors.length - before} issues) ---`);
      }
    }
  }

  // Every tab expected for a booked event must have rendered (stage-gated
  // tabs like staff/emergency/portal are intentionally absent pre-planning).
  expect(seen).toEqual(EXPECTED_TABS);

  // ── Stage-gated tabs: staff/emergency/portal appear in later stages ──
  // Create a planning event and walk it, then stage it to completed and
  // walk the remaining operational tabs (staff, emergency, portal).
  const created = await page.evaluate(async (oid) => {
    const token = localStorage.getItem('wedding-jwt');
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        organizationId: oid,
        title: `Tab Sweep ${Date.now()}`,
        status: 'planning',
        startDate: '2026-10-10',
        guestCount: 50,
      }),
    });
    return res.json();
  }, orgId);
  const sweepEventId = created.id || created.event?.id;
  expect(sweepEventId, 'planning event must be created').toBeTruthy();

  await page.goto(BASE + `/#/events/${sweepEventId}`);
  await page.waitForTimeout(3000);
  const stageTabs = ['Overview', 'Timeline', 'Guests', 'Staff', 'Portal'];
  const seenStage: string[] = [];
  for (const t of stageTabs) {
    const trigger = page.getByRole('tab', { name: new RegExp(`^${t}`) });
    if (await trigger.count()) {
      await trigger.first().click();
      await page.waitForTimeout(1200);
      seenStage.push(t);
    }
  }
  // planning shows staff + portal (emergency arrives at final_review/completed)
  expect(seenStage).toEqual(['Overview', 'Timeline', 'Guests', 'Staff', 'Portal']);

  // stage to completed → emergency tab appears
  await page.evaluate(async (eid) => {
    const token = localStorage.getItem('wedding-jwt');
    await fetch(`/api/events/${eid}/stage`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
  }, sweepEventId);
  await page.goto(BASE + `/#/events/${sweepEventId}`);
  await page.waitForTimeout(3000);
  const emergencyTab = page.getByRole('tab', { name: /^Emergency/ });
  expect(await emergencyTab.count()).toBe(1);
  await emergencyTab.first().click();
  await page.waitForTimeout(1200);

  expect(allErrors, `event tabs produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
