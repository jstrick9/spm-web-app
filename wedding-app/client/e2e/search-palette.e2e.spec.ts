import { test, expect } from '@playwright/test';

/**
 * Global search (Command K) end-to-end.
 *
 * The command palette is the app's primary navigation accelerator — search
 * for an event by title and jump straight to it. This spec verifies the
 * full loop: palette opens, dynamic event results appear as you type, and
 * selecting a result navigates to the event detail page.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('command palette searches events and navigates to the detail page', async ({ page, request }) => {
  // ── 0. API setup: owner session + deterministic tour state ──────────
  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  const { token } = await login.json();
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
  const events = (await (await request.get(`/api/orgs/${tourOrgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events;
  const event = events.find((e: any) => e.title === 'Smith & Jones Wedding') ?? events[0];
  const eventId = event.id as string;

  // ── 1. Log in ────────────────────────────────────────────────────────
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.getByLabel(/^password$/i).fill('wedding123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  // ── 2. Open the palette and search for the event ─────────────────────
  await page.getByRole('button', { name: /open search \(command k\)/i }).click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });

  await page.getByPlaceholder(/type a command or search/i).fill('Smith & Jones');
  const result = page.getByRole('option', { name: /smith & jones wedding/i }).first();
  await expect(result).toBeVisible({ timeout: 10_000 });

  await result.click();

  // ── 3. Lands on the event detail page ────────────────────────────────
  await expect(page).toHaveURL(new RegExp(`/#/events/${eventId}(\\?|$)`), { timeout: 15_000 });
  await expect(page.locator('body')).toContainText(/smith & jones wedding/i, { timeout: 15_000 });
});
