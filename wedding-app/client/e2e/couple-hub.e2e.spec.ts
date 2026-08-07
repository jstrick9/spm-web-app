import { test, expect, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * fillInput — fill an input with a self-healing retry.
 *
 * Headless Chromium quirk: the first Input.insertText after an SPA
 * navigation can silently no-op (the DOM value never changes, React state
 * never updates), so a bare `fill()` on a freshly-navigated form field is
 * flaky. A real click first, plus one retry when the value didn't stick,
 * makes it deterministic. Real user typing is unaffected by this quirk.
 */
async function fillInput(locator: Locator, value: string): Promise<void> {
  await clickSafely(locator);
  await locator.fill(value);
  if ((await locator.inputValue()) !== value) {
    await clickSafely(locator);
    await locator.fill(value);
  }
  await expect(locator).toHaveValue(value);
}

/**
 * clickSafely — click something under the app's sticky header.
 *
 * The app shell header is sticky (56px); Playwright's auto-scroll aligns
 * the target to the viewport edge, which can leave it UNDER the header —
 * the hit-target check then loops until timeout ("header subtree
 * intercepts pointer events"). Centering the element in the viewport
 * first keeps it clear of the header deterministically.
 */
async function clickSafely(locator: Locator): Promise<void> {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await locator.click();
}

/**
 * Couple hub share/summary end-to-end (real browser, production build).
 *
 * Covers the couple's two client-side export surfaces:
 *   1. "Share" — Web Share API falls back to the clipboard in headless;
 *      success toast must appear.
 *   2. "Save summary" — downloads a real .txt wedding summary whose
 *      contents include the event title, date, and guest/RSVP context.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('couple can share and download their wedding summary', async ({ page, context, request }) => {
  // ── 0. API setup: couple user + event membership ─────────────────────
  const coupleEmail = `couple-e2e-${Date.now()}@example.com`;
  const reg = await request.post('/api/auth/register', {
    data: { email: coupleEmail, password: 'testpass123', fullName: 'Taylor Couple', orgName: 'Tmp' },
  });
  expect(reg.ok()).toBeTruthy();

  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;
  const events = (await (await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events;
  const event = events.find((e: any) => e.title === 'Smith & Jones Wedding') ?? events[0];
  const eventId = event.id as string;

  const invite = await request.post(`/api/events/${eventId}/couple-invitations`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { email: coupleEmail, roleKey: 'couple' },
  });
  expect(invite.status()).toBe(201);
  expect((await invite.json()).status).toBe('added_existing_user');

  // ── 1. Couple logs in ────────────────────────────────────────────────
  // Deterministic tour state: complete the couple's onboarding tour via API
  // before the browser session (a fresh account always opens the modal and
  // its `in_progress` state persists across interrupted runs).
  const coupleLogin = await request.post('/api/auth/login', {
    data: { email: coupleEmail, password: 'testpass123' },
  });
  expect(coupleLogin.ok()).toBeTruthy();
  const coupleToken = (await coupleLogin.json()).token;
  // The tour is keyed by the user's ORG id (a fresh registration owns one).
  const coupleOrgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${coupleToken}` } })).json();
  const coupleOrgId = coupleOrgs.organizations[0].id;
  await request.put('/api/users/me/preferences', {
    headers: { authorization: `Bearer ${coupleToken}`, 'content-type': 'application/json' },
    data: {
      onboarding: {
        welcomeTourByOrg: {
          [coupleOrgId]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() },
        },
      },
    },
  });

  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  // Headless Chromium exposes navigator.share but rejects it (no OS share
  // sheet) — stub it away so the clipboard fallback path runs deterministically.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill(coupleEmail);
  await page.getByLabel(/^password$/i).fill('testpass123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/your wedding hub/i, { timeout: 20_000 });
  await expect(page.getByText(event.title)).toBeVisible({ timeout: 20_000 });

  // ── 2. Share summary (clipboard fallback in headless) ────────────────
  await page.getByRole('button', { name: /share/i }).click();
  await expect(page.getByText('Wedding summary ready to share').first().first()).toBeVisible({ timeout: 10_000 });
  const clip = await page.evaluate(() => navigator.clipboard?.readText().catch(() => ''));
  expect(clip).toContain(event.title);

  // ── 3. Save summary (real .txt download) ─────────────────────────────
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15_000 }),
    page.getByRole('button', { name: /save summary/i }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/wedding-summary-.*\.txt/);
  const path = await download.path();
  const text = readFileSync(path!, 'utf8');
  expect(text).toContain(event.title);
  expect(text).toContain('Wedding Summary');
  // The summary is built from the hub's real data — the RSVP line exists.
  expect(text).toMatch(/Guests:/);
});

test('couple adds a guest and acknowledges a critical event-week update', async ({ page, request }) => {
  // ── 0. API setup: couple user + event membership ─────────────────────
  const coupleEmail = `couple-flow-${Date.now()}@example.com`;
  const reg = await request.post('/api/auth/register', {
    data: { email: coupleEmail, password: 'testpass123', fullName: 'Riley Flow', orgName: 'Tmp' },
  });
  expect(reg.ok()).toBeTruthy();

  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;
  const events = (await (await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events;
  const event = events.find((e: any) => e.title === 'Smith & Jones Wedding') ?? events[0];
  const eventId = event.id as string;

  const invite = await request.post(`/api/events/${eventId}/couple-invitations`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { email: coupleEmail, roleKey: 'couple' },
  });
  expect(invite.status()).toBe(201);

  // Owner publishes a CRITICAL event-week update (shows the "I understand"
  // acknowledgement button to the couple). Title is unique per run — the
  // seed DB persists between runs, and the spec must only match its own.
  const updateTitle = `Parking lot closed ${Date.now()}`;
  const update = await request.post(`/api/events/${eventId}/couple-updates`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: {
      title: updateTitle,
      body: 'Use the north overflow lot while the main lot is resurfaced.',
      category: 'parking',
      critical: true,
    },
  });
  expect(update.status()).toBe(201);
  const updateId = (await update.json()).update.id as string;

  // Deterministic tour state (couple's own org id keys the tour).
  const coupleLogin = await request.post('/api/auth/login', { data: { email: coupleEmail, password: 'testpass123' } });
  const coupleToken = (await coupleLogin.json()).token;
  const coupleOrgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${coupleToken}` } })).json();
  await request.put('/api/users/me/preferences', {
    headers: { authorization: `Bearer ${coupleToken}`, 'content-type': 'application/json' },
    data: {
      onboarding: {
        welcomeTourByOrg: {
          [coupleOrgs.organizations[0].id]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() },
        },
      },
    },
  });

  // ── 1. Couple logs in and lands on the hub ───────────────────────────
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill(coupleEmail);
  await page.getByLabel(/^password$/i).fill('testpass123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/your wedding hub/i, { timeout: 20_000 });
  await expect(page.getByText(event.title).first()).toBeVisible({ timeout: 20_000 });

  // ── 2. Add a guest from the Couple Guest List Center ─────────────────
  const guestName = `E2E Guest ${Date.now()}`;
  const guestCard = page.locator('#couple-guest-list');
  await fillInput(guestCard.getByPlaceholder('Full name'), guestName);
  await fillInput(guestCard.getByPlaceholder(/^email/i), `e2e-guest-${Date.now()}@example.com`);
  await fillInput(guestCard.getByPlaceholder(/^tags/i), 'vip,family');
  await guestCard.getByRole('combobox').selectOption('attending');
  await clickSafely(guestCard.getByRole('button', { name: 'Add guest' }));

  await expect(page.getByText('Guest added').first()).toBeVisible({ timeout: 10_000 });

  // Server-side verification: the guest really exists in the event guest list.
  const guestsRes = await request.get(`/api/events/${eventId}/couple-guests`, {
    headers: { authorization: `Bearer ${coupleToken}` },
  });
  expect(guestsRes.ok()).toBeTruthy();
  const { guests } = (await guestsRes.json()) as { guests: Array<any> };
  const created = guests.find((g: any) => g.fullName === guestName);
  expect(created).toBeTruthy();
  expect(created.rsvpStatus).toBe('attending');
  expect(created.tags).toContain('vip');

  // ── 2b. Edit the guest (typo fix) — regression: no UI could edit a guest ──
  await guestCard.getByRole('button', { name: `Edit guest ${guestName}` }).click();
  const editDialog = page.getByRole('dialog');
  await expect(editDialog).toBeVisible({ timeout: 10_000 });
  await editDialog.locator('#prompt-fullName').fill(`${guestName} Jr.`);
  await clickSafely(editDialog.getByRole('button', { name: 'Save' }));
  await expect(page.getByText('Guest updated').first()).toBeVisible({ timeout: 10_000 });

  const guestsRes2 = await request.get(`/api/events/${eventId}/couple-guests`, {
    headers: { authorization: `Bearer ${coupleToken}` },
  });
  const { guests: guests2 } = (await guestsRes2.json()) as { guests: Array<any> };
  expect(guests2.find((g: any) => g.fullName === `${guestName} Jr.`)).toBeTruthy();

  // ── 3. Acknowledge the critical update ───────────────────────────────
  // The update title's parent card holds THIS run's "I understand" button
  // (older runs leave acknowledged/unacknowledged updates behind).
  const updateCard = page.getByText(updateTitle).locator('..');
  await expect(updateCard).toBeVisible({ timeout: 10_000 });
  await clickSafely(updateCard.getByRole('button', { name: 'I understand' }));
  await expect(page.getByText('Update acknowledged').first()).toBeVisible({ timeout: 10_000 });

  // Server-side verification: acknowledged_at is now set for this couple.
  const updatesRes = await request.get(`/api/events/${eventId}/couple-updates`, {
    headers: { authorization: `Bearer ${coupleToken}` },
  });
  const { updates } = (await updatesRes.json()) as { updates: Array<any> };
  const acked = updates.find((u: any) => u.id === updateId);
  expect(acked).toBeTruthy();
  expect(acked.acknowledged_at).toBeTruthy();

  // The couple VIEWED the update too — the venue's "viewed X/Y" panel
  // depends on these read receipts (regression: it stayed 0 forever).
  const summaryRes = await request.get(`/api/events/${eventId}/couple-updates/summary`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(summaryRes.ok()).toBeTruthy();
  const { updates: summaryUpdates } = (await summaryRes.json()) as { updates: Array<any> };
  const viewed = summaryUpdates.find((u: any) => u.id === updateId);
  expect(viewed, 'summary must include the update').toBeTruthy();
  expect((viewed.viewed_count ?? 0), 'viewed_count must reflect the couple reading the update').toBeGreaterThanOrEqual(1);
});

test('couple imports their guest list from a CSV in the import concierge', async ({ page, request }) => {
  // ── 0. API setup: couple user + event membership ─────────────────────
  const coupleEmail = `couple-import-${Date.now()}@example.com`;
  const reg = await request.post('/api/auth/register', {
    data: { email: coupleEmail, password: 'testpass123', fullName: 'Sam Import', orgName: 'Tmp' },
  });
  expect(reg.ok()).toBeTruthy();

  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;
  const events = (await (await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events;
  const event = events.find((e: any) => e.title === 'Smith & Jones Wedding') ?? events[0];
  const eventId = event.id as string;

  const invite = await request.post(`/api/events/${eventId}/couple-invitations`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { email: coupleEmail, roleKey: 'couple' },
  });
  expect(invite.status()).toBe(201);

  const coupleLogin = await request.post('/api/auth/login', { data: { email: coupleEmail, password: 'testpass123' } });
  const coupleToken = (await coupleLogin.json()).token;
  const coupleOrgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${coupleToken}` } })).json();
  await request.put('/api/users/me/preferences', {
    headers: { authorization: `Bearer ${coupleToken}`, 'content-type': 'application/json' },
    data: {
      onboarding: {
        welcomeTourByOrg: {
          [coupleOrgs.organizations[0].id]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() },
        },
      },
    },
  });

  // ── 1. Couple logs in ────────────────────────────────────────────────
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill(coupleEmail);
  await page.getByLabel(/^password$/i).fill('testpass123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/your wedding hub/i, { timeout: 20_000 });

  // ── 2. Import concierge: paste CSV → preview → import ────────────────
  const stamp = Date.now();
  // NOTE: names must be unique per run too — rows WITHOUT an email dedupe
  // by name (their only identity), so a no-email guest left behind by an
  // earlier run would otherwise be skipped as a duplicate.
  const csv = [
    'fullName,email,phone,householdName,mailingAddress,rsvpStatus,mealChoice',
    `Ada Import ${stamp},ada-${stamp}@example.com,555-1000,Import Family,1 Main St,attending,Chicken`,
    `Ben Import ${stamp},ben-${stamp}@example.com,555-1001,Import Family,1 Main St,pending,Beef`,
    `Cara Import ${stamp},,555-1002,Import Family,1 Main St,pending,Fish`,
  ].join('\n');

  await clickSafely(page.getByRole('heading', { name: 'Guest import concierge' }));
  const csvBox = page.getByLabel('Guest list CSV');
  await fillInput(csvBox, csv);

  await clickSafely(page.getByRole('button', { name: 'Preview import' }));
  const importBtn = page.getByRole('button', { name: 'Import 3 guest(s)' });
  await expect(importBtn).toBeVisible({ timeout: 10_000 });
  await clickSafely(importBtn);

  await expect(page.getByText('3 guests imported').first()).toBeVisible({ timeout: 10_000 });

  // ── 3. Server-side verification: the guests really exist ─────────────
  const guestsRes = await request.get(`/api/events/${eventId}/couple-guests`, {
    headers: { authorization: `Bearer ${coupleToken}` },
  });
  const { guests } = (await guestsRes.json()) as { guests: Array<any> };
  const ada = guests.find((g: any) => g.fullName === `Ada Import ${stamp}`);
  expect(ada).toBeTruthy();
  expect(ada).toMatchObject({ email: `ada-${stamp}@example.com`, rsvpStatus: 'attending', mealChoice: 'Chicken', householdName: 'Import Family' });
  expect(guests.find((g: any) => g.fullName === `Cara Import ${stamp}`)).toBeTruthy();
});
