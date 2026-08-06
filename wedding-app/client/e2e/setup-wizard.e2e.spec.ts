import { test, expect } from '@playwright/test';

/**
 * First-run venue setup wizard end-to-end.
 *
 * A brand-new venue owner registering through the UI gets the 5-step setup
 * wizard (venue identity → spaces → rules → catalog → first event). This
 * spec drives the whole flow and verifies the org config persisted.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('first-run setup wizard completes and persists venue identity', async ({ page, request }) => {
  const stamp = Date.now();
  const venueName = `Willow Run Estate ${stamp}`;
  const email = `owner-${stamp}@example.com`;
  const password = 'testpass123';

  // ── 1. Register through the UI (the wizard flag is set client-side) ──
  await page.goto('/#/');
  await page.getByRole('button', { name: /create my venue account/i }).click();
  await page.getByLabel(/full name/i).fill('First Run Owner');
  await page.getByPlaceholder('Willow Creek Estate').fill(venueName);
  await page.getByLabel(/email address/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.locator('form').getByRole('button', { name: 'Create my venue account' }).click();

  // Wizard auto-opens after registration. Scope to THIS dialog — the
  // welcome tour opens right after it closes and both are role=dialog.
  const wizard = page.getByRole('dialog').filter({ hasText: 'Venue Owner Setup Wizard' });
  await expect(wizard).toBeVisible({ timeout: 20_000 });

  // ── 2. Step 1: identity ──────────────────────────────────────────────
  await wizard.getByPlaceholder('Willow Creek Estate').fill(venueName);
  await wizard.getByPlaceholder('hello@venue.com').fill('support@willowrun.test');
  await wizard.getByRole('button', { name: /^next/i }).click();

  // Step 2: spaces (fill the ceremony/reception to exercise the form)
  await wizard.getByPlaceholder('Ceremony space').fill('Garden Lawn');
  await wizard.getByPlaceholder('Reception space').fill('Grand Hall');
  await wizard.getByRole('button', { name: /^next/i }).click();

  // Step 3: rules — keep defaults, advance.
  await wizard.getByRole('button', { name: /^next/i }).click();

  // Step 4: catalog — keep defaults, advance.
  await wizard.getByRole('button', { name: /^next/i }).click();

  // Step 5: first event — "sample" is the default; finish.
  await wizard.getByRole('button', { name: /finish setup/i }).click();

  // Wizard closes; the app shell is usable. A fresh owner then gets the
  // Welcome tour modal (wizard → tour is the intended first-run order).
  await expect(wizard).toBeHidden({ timeout: 20_000 });
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });
  const welcomeTour = page.getByRole('dialog').filter({ hasText: 'Welcome tour' });
  if (await welcomeTour.isVisible().catch(() => false)) {
    await welcomeTour.getByRole('button', { name: /resume later|finish/i }).click().catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
  }

  // ── 3. Server-side verification ──────────────────────────────────────
  const login = await request.post('/api/auth/login', { data: { email, password } });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const orgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json();
  const orgId = orgs.organizations[0].id as string;
  const config = (await (await request.get(`/api/orgs/${orgId}/config`, { headers: { authorization: `Bearer ${token}` } })).json()) as { config: any };
  expect(config.config.branding?.platformName).toBe(venueName);
  expect(config.config.branding?.supportEmail).toBe('support@willowrun.test');
  expect(config.config.setup?.ownerSetup?.spaces?.ceremonySpace).toBe('Garden Lawn');
  expect(config.config.setup?.ownerSetup?.spaces?.receptionSpace).toBe('Grand Hall');

  // The sample event was created.
  const events = (await (await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events;
  expect(events.some((e: any) => e.title === 'Sample Wedding')).toBeTruthy();
});
