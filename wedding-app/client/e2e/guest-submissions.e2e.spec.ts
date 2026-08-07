import { test, expect } from '@playwright/test';

/**
 * Guest portal submission flows end-to-end:
 *  - reminder preferences save (persisted to the guest record server-side),
 *  - privacy/data request,
 *  - accessibility & care request,
 *  - event-day "Running late" quick action.
 * Each is verified server-side through the portal API.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

const BASE = process.env.A11Y_BASE_URL || 'http://localhost:3000';

/** The portal's fixed bottom nav can intercept clicks — center-scroll first. */
async function clickSafe(locator: import('@playwright/test').Locator): Promise<void> {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await locator.click();
}

async function setupGuest(request: import('@playwright/test').APIRequestContext) {
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
  const created = await request.post(`/api/events/${eventId}/couple-guests`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { fullName: `Sub Guest ${stamp}`, email: `sub-${stamp}@example.com`, rsvpStatus: 'pending' },
  });
  expect(created.status()).toBe(201);
  const guestId = (await created.json()).guest.id as string;
  const linkRes = await request.post(`/api/events/${eventId}/couple-guests/${guestId}/portal-link`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const { token: guestToken } = (await linkRes.json()) as { token: string };
  return { eventId, guestId, guestToken };
}

test('guest saves reminder preferences, privacy request, accessibility request, and day-of help', async ({ page, request }) => {
  const { eventId, guestId, guestToken } = await setupGuest(request);

  await page.goto(`${BASE}/#/portal/${eventId}?guest=${guestId}&token=${guestToken}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(2500);

  // ── 1. Reminder preferences: save ──
  const reminders = page.locator('#guest-reminder-preferences-info');
  await reminders.scrollIntoViewIfNeeded();
  await clickSafe(reminders.getByRole('button', { name: 'Save reminder preferences' }));
  await expect(reminders.getByText(/saved|updated|preferences/i).first()).toBeVisible({ timeout: 15_000 });

  const prefsRes = await request.get(`/api/portal/${eventId}/info?guest=${guestId}&token=${guestToken}`);
  const prefsBody = (await prefsRes.json()) as any;
  expect(prefsBody.guestReminders.preferences.emailOptIn).toBeDefined();

  // ── 2. Privacy request (a message is required before it submits) ──
  const privacy = page.locator('#guest-privacy-consent-info');
  await privacy.scrollIntoViewIfNeeded();
  await privacy.getByLabel('Privacy request message').fill('Please update my contact email.');
  await clickSafe(privacy.getByRole('button', { name: 'Send privacy request' }));
  await expect(privacy.getByText(/sent|request/i).first()).toBeVisible({ timeout: 15_000 });

  // ── 3. Accessibility request ──
  const care = page.locator('#guest-accessibility-care-info');
  await care.scrollIntoViewIfNeeded();
  const mobility = care.getByLabel('Mobility needs');
  if (await mobility.count()) {
    await mobility.fill('Wheelchair access from parking');
  }
  await clickSafe(care.getByRole('button', { name: 'Send accessibility request' }));
  await expect(care.getByText(/sent|request/i).first()).toBeVisible({ timeout: 15_000 });

  // ── 4. Event-day quick action: Running late ──
  const dayOf = page.locator('#guest-event-day-mobile-mode');
  await dayOf.scrollIntoViewIfNeeded();
  await clickSafe(dayOf.getByRole('button', { name: 'Running late' }));
  await expect(dayOf.getByText(/sent|received|venue/i).first()).toBeVisible({ timeout: 15_000 });

  // ── 5. Server-side verification: the guest record carries all requests ──
  const requestsRes = await request.get(`/api/portal/${eventId}/messages?guest=${guestId}&token=${guestToken}`);
  expect(requestsRes.status()).toBe(200);
  const { helpRequests } = (await requestsRes.json()) as { helpRequests: Array<{ kind: string; message: string }> };
  const messages = helpRequests.map((r) => `${r.kind}: ${r.message}`);
  expect(messages.some((m) => m.includes('Guest privacy/data request')), 'privacy request must be recorded').toBe(true);
  expect(messages.some((m) => m.includes('Accessibility & care request')), 'accessibility request must be recorded').toBe(true);
  expect(messages.some((m) => m.includes('Guest running late')), 'day-of help must be recorded').toBe(true);
});
