/**
 * Gate: the public guest portal renders every section without console
 * errors or HTTP >=400 responses, in BOTH token states (secure-link guest
 * and generic token-less lookup), and the help-request flows work.
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.A11Y_BASE_URL || 'http://localhost:3000';

function watch(page: import('@playwright/test').Page, sink: string[]): void {
  page.on('console', (msg) => {
    if (msg.type() === 'error') sink.push(`[console.error] ${msg.text().slice(0, 260)}`);
  });
  page.on('pageerror', (err) => sink.push(`[pageerror] ${String(err).slice(0, 260)}`));
  page.on('requestfailed', (req) => {
    if (req.failure()?.errorText !== 'net::ERR_ABORTED') {
      sink.push(`[requestfailed] ${req.url().slice(0, 200)} ${req.failure()?.errorText || ''}`);
    }
  });
  page.on('response', (res) => {
    if (res.status() >= 400) sink.push(`[http ${res.status()}] ${res.url().slice(0, 200)}`);
  });
}

test('guest portal renders clean and help flows work in both token states', async ({ page, request }) => {
  const allErrors: string[] = [];
  watch(page, allErrors);

  // ── API setup: owner + fresh guest + portal link ──
  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;
  const events = (await (await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events;
  const event = events.find((e: any) => e.title === 'Smith & Jones Wedding') ?? events[0];
  const eventId = event.id as string;

  const stamp = Date.now();
  const guestName = `Portal Guest ${stamp}`;
  const guestEmail = `portal-${stamp}@example.com`;
  const created = await request.post(`/api/events/${eventId}/couple-guests`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { fullName: guestName, email: guestEmail, rsvpStatus: 'pending' },
  });
  expect(created.status()).toBe(201);
  const guestId = (await created.json()).guest.id as string;
  const linkRes = await request.post(`/api/events/${eventId}/couple-guests/${guestId}/portal-link`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(linkRes.status()).toBe(200);
  const { token: guestToken } = (await linkRes.json()) as { token: string };

  // ── 1. Token-less portal: generic lookup + "I cannot find my name" + resend ──
  await page.goto(`${BASE}/#/portal/${eventId}`);
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: 'I cannot find my name' })).toBeVisible({ timeout: 15000 });

  // help request from the generic state
  await page.getByRole('button', { name: 'I cannot find my name' }).click();
  const helpDialog = page.getByRole('dialog');
  await expect(helpDialog).toBeVisible({ timeout: 10000 });
  await helpDialog.getByLabel(/email where the venue/i).fill(guestEmail);
  await helpDialog.getByRole('button', { name: 'Save' }).click();
  await expect(helpDialog).toBeHidden({ timeout: 10000 });
  // a confirmation toast or message appears
  await expect(page.getByText(/help request|sent|received/i).first()).toBeVisible({ timeout: 10000 });

  // guest-name lookup finds the guest; then "Request secure link" queues a resend
  await page.getByLabel('Your name').fill(guestName.split(' ').slice(2).join(' '));
  await page.getByRole('button', { name: 'Look up' }).click();
  await expect(page.getByText(/possible match/i)).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Request secure link' }).click();
  const resendDialog = page.getByRole('dialog', { name: /request your secure rsvp link/i });
  await expect(resendDialog).toBeVisible({ timeout: 10000 });
  await resendDialog.getByLabel('Email address').fill(guestEmail);
  await resendDialog.getByRole('button', { name: 'Save' }).click();
  await expect(resendDialog).toBeHidden({ timeout: 10000 });
  await expect(page.getByText(/secure link|link sent|queued/i).first()).toBeVisible({ timeout: 10000 });

  // ── 2. Token guest: full RSVP wizard + "This link is not me" ──
  // Hash-only navigation does NOT remount the portal (SW-served shell), so
  // reload to re-read the token/guest query params at mount.
  await page.goto(`${BASE}/#/portal/${eventId}?guest=${guestId}&token=${guestToken}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(2000);

  // walk the wizard end to end (programmatic clicks per the CDP hit-test quirk)
  await page.getByRole('button', { name: 'Open RSVP' }).click();
  const form = page.getByRole('form', { name: 'RSVP form' });
  await expect(form).toBeVisible({ timeout: 15000 });
  await expect(form.getByLabel('Your Name', { exact: true })).toHaveValue(guestId, { timeout: 10000 });
  await form.getByRole('button', { name: 'Continue' }).evaluate((el) => (el as HTMLButtonElement).click());
  await expect(form.getByText('Joyfully accept')).toBeVisible({ timeout: 10000 });
  await form.getByText('Joyfully accept').first().click();
  await form.getByRole('button', { name: 'Continue' }).evaluate((el) => (el as HTMLButtonElement).click());
  await expect(form.getByText('Plus-one', { exact: true })).toBeVisible({ timeout: 10000 });
  await form.getByText('Plus-one', { exact: true }).first().click();
  await form.getByRole('button', { name: 'Continue' }).evaluate((el) => (el as HTMLButtonElement).click());
  await expect(form.getByText('Meal choice', { exact: true })).toBeVisible({ timeout: 10000 });
  await form.getByText('Meal choice', { exact: true }).first().click();
  await form.getByRole('button', { name: 'Continue' }).evaluate((el) => (el as HTMLButtonElement).click());
  await expect(form.getByText(/Review before submitting/i)).toBeVisible({ timeout: 10000 });
  // privacy acknowledgment is required before submit (label click toggles the native checkbox)
  await form.getByText(/i understand who can see my rsvp/i).click();
  await form.getByRole('button', { name: 'Submit RSVP' }).evaluate((el) => (el as HTMLButtonElement).click());
  await expect(page.getByText(/RSVP saved/i).first()).toBeVisible({ timeout: 15000 });

  // token-state help flow (help buttons live on the home tab)
  await page.getByRole('button', { name: 'Return Home' }).click();
  // a draft was saved mid-wizard → confirm discarding it
  const discard = page.getByRole('dialog', { name: /discard your draft/i });
  if (await discard.count()) {
    await discard.getByRole('button', { name: 'Confirm' }).click();
    await expect(discard).toBeHidden({ timeout: 10000 });
  }
  await page.getByRole('button', { name: 'This link is not me' }).click();
  const help2 = page.getByRole('dialog');
  await expect(help2).toBeVisible({ timeout: 10000 });
  await help2.getByRole('button', { name: 'Save' }).click();
  await expect(help2).toBeHidden({ timeout: 10000 });

  // ── 2b. Map tab (wayfinding canvas) renders without console errors ──
  const mapTab = page.getByRole('button', { name: /map/i }).first();
  if (await mapTab.count()) {
    await mapTab.click();
    await page.waitForTimeout(1500);
  }
  await page.getByRole('button', { name: /home/i }).first().click();
  await page.waitForTimeout(800);

  // ── 3. Full-page scroll to mount every lazy section ──
  await page.goto(`${BASE}/#/portal/${eventId}?guest=${guestId}&token=${guestToken}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
  });
  await page.waitForTimeout(1500);

  expect(allErrors, `guest portal produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
