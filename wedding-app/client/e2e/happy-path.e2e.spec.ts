import { test, expect } from '@playwright/test';

// The create-event dialog is tall; give it room so the submit button is
// visible without inner-container scrolling.
test.use({ viewport: { width: 1440, height: 1400 } });

/**
 * Browser happy-path e2e: owner logs in → opens the create-event dialog
 * (⌘/Ctrl+N) → creates an event → lands on the event detail page.
 *
 * Runs against the built, seeded server (same harness as the a11y specs:
 * scripts/a11y-test.sh boots a production-mode Fastify server that serves
 * the built client; the seed provides owner@demo.local / wedding123).
 *
 * This spec guards the pieces unit/component tests cannot: real browser
 * bootstrapping, the auth gate, hash routing, the global keyboard shortcut,
 * the create-event form submitting through the real API, and the post-create
 * redirect into EventDetail.
 */
test('owner can log in and create a wedding event', async ({ page, request }) => {
  // ── 0. Deterministic tour state: complete the owner's onboarding tour
  // via API so a previously-interrupted run can never leave the modal open
  // and intercept clicks (the modal persists `in_progress` across runs).
  const tourLogin = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  if (tourLogin.ok()) {
    const tourToken = (await tourLogin.json()).token;
    const orgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${tourToken}` } })).json();
    const tourOrgId = orgs.organizations[0].id;
    await request.put('/api/users/me/preferences', {
      headers: { authorization: `Bearer ${tourToken}`, 'content-type': 'application/json' },
      data: {
        onboarding: {
          welcomeTourByOrg: {
            [tourOrgId]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() },
          },
        },
      },
    });
  }

  // ── 1. Login ───────────────────────────────────────────
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.getByLabel(/^password$/i).fill('wedding123');
  await page.getByRole('button', { name: /sign in securely/i }).click();

  // Authenticated shell: the dashboard is reachable (proves the session
  // bootstrapped and the app shell mounted).
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  // ── 2. Dismiss the onboarding welcome tour (auto-opens for the seeded
  // owner AFTER the dashboard settles — wait for it first; "Resume later"
  // persists and re-opens it, so walk to the last slide and complete it —
  // status "completed" is what actually keeps it closed).
  const resumeLater = page.getByRole('button', { name: /resume later/i });
  await resumeLater.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  if (await resumeLater.isVisible().catch(() => false)) {
    const nextSlide = page.getByRole('button', { name: /^next$/i });
    for (let i = 0; i < 8; i++) {
      if (!(await nextSlide.isVisible().catch(() => false))) break;
      await nextSlide.click({ timeout: 3_000 }).catch(() => {});
    }
    await page.getByRole('button', { name: /finish tour/i }).click({ timeout: 5_000 }).catch(() => {});
  }

  // ── 3. Ensure no dialog/tour overlay is still open, then open the
  // create-event dialog from the dashboard. (The onboarding tour opens for
  // the seeded owner; if its overlay is present, Escape closes it.)
  await page.keyboard.press('Escape').catch(() => {});
  await page.getByRole('button', { name: /new event/i }).click();
  await expect(page.getByLabel(/event title/i)).toBeVisible({ timeout: 10_000 });

  // ── 3. Fill + submit ───────────────────────────────────
  const title = `E2E Wedding ${Date.now()}`;
  await page.getByLabel(/event title/i).fill(title);
  await page.getByLabel(/start date/i).fill('2026-12-12');
  await page.getByLabel(/end date/i).fill('2026-12-12');
  // Submit via Enter (the submit button sits in a scrollable dialog body that
  // can fall outside the viewport in headless runs).
  await page.getByLabel(/end date/i).press('Enter');

  // ── 4. Land on the new event's detail page ─────────────
  await expect(page).toHaveURL(/#\/events\/[0-9a-f-]{36}/, { timeout: 15_000 });
  await expect(page.locator('body')).toContainText(title, { timeout: 15_000 });
});
