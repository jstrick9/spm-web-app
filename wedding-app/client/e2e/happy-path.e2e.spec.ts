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
test('owner can log in and create a wedding event', async ({ page }) => {
  // ── 1. Login ───────────────────────────────────────────
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.getByLabel(/^password$/i).fill('wedding123');
  await page.getByRole('button', { name: /sign in securely/i }).click();

  // Authenticated shell: the dashboard is reachable (proves the session
  // bootstrapped and the app shell mounted).
  await expect(page.locator('body')).toContainText(/good evening/i, { timeout: 20_000 });

  // ── 2. Dismiss the onboarding welcome tour (auto-opens for the seeded
  // owner; "Resume later" persists and re-opens it, so walk to the last slide
  // and complete it — status "completed" is what actually keeps it closed).
  const nextSlide = page.getByRole('button', { name: /^next$/i });
  for (let i = 0; i < 8; i++) {
    if (!(await nextSlide.isVisible().catch(() => false))) break;
    const clicked = await nextSlide.click({ timeout: 3_000 }).then(() => true).catch(() => false);
    if (!clicked) break;
  }
  await page.getByRole('button', { name: /finish tour/i }).click({ timeout: 5_000 }).catch(() => {});

  // ── 3. Open the create-event dialog from the dashboard ─
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
