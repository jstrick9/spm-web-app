import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

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
