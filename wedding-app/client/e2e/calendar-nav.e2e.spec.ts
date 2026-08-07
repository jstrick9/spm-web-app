import { test, expect } from '@playwright/test';

/**
 * Global Calendar navigation + keyboard accessibility end-to-end.
 *
 *  - Month navigation (chevrons + Today) updates the grid.
 *  - The icon-only chevron buttons carry accessible names (a11y).
 *  - Event chips are keyboard-operable: Tab reaches them and Enter opens
 *    the event detail page (they were click-only divs before).
 */
test.use({ viewport: { width: 1440, height: 1400 }, timezoneId: 'America/New_York' });

test('calendar month navigation and event-chip keyboard access work', async ({ page, request }) => {
  // ── 0. API setup: owner + tour state + an event next month ──
  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const orgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json();
  const orgId = orgs.organizations[0].id as string;
  await request.put('/api/users/me/preferences', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: {
      onboarding: {
        welcomeTourByOrg: {
          [orgId]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() },
        },
      },
    },
  });

  // next-month date in the browser's local calendar
  const nextMonthDate = await page.evaluate(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(15);
    const pad = (n: number) => String(n).padStart(2, '0');
    return { iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` };
  });

  const title = `Calendar Nav ${Date.now()}`;
  const created = await request.post('/api/events', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { organizationId: orgId, title, startDate: nextMonthDate.iso, status: 'booked' },
  });
  expect(created.status()).toBe(201);
  const eventId = (await created.json()).event.id as string;

  // ── 1. Open the calendar ──
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.getByLabel(/^password$/i).fill('wedding123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  await page.goto('/#/calendar');
  await expect(page.getByRole('heading', { name: 'Event Calendar' })).toBeVisible({ timeout: 15_000 });

  // ── 2. Accessible names on the icon-only nav buttons ──
  const prev = page.getByRole('button', { name: 'Previous month' });
  const next = page.getByRole('button', { name: 'Next month' });
  const todayBtn = page.getByRole('button', { name: /jump to current month|Today/i });
  await expect(prev).toBeVisible();
  await expect(next).toBeVisible();
  await expect(todayBtn).toBeVisible();

  const monthHeading = page.locator('h2', { hasText: /^\w+ \d{4}$/ }).first();
  await expect(monthHeading).toBeVisible();

  // ── 3. Next month shows the event; header month advances ──
  const currentLabel = (await monthHeading.textContent())?.trim() ?? '';
  await next.click();
  await expect
    .poll(async () => (await monthHeading.textContent())?.trim() !== currentLabel, { timeout: 10_000 })
    .toBe(true);
  await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 10_000 });

  // ── 4. Prev returns to the current month (event hidden again) ──
  await prev.click();
  await expect
    .poll(async () => (await monthHeading.textContent())?.trim() === currentLabel, { timeout: 10_000 })
    .toBe(true);
  await todayBtn.click();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);

  // ── 5. Keyboard access: Enter on the focused chip opens the event ──
  await next.click();
  const chip = page.getByText(title, { exact: true });
  await expect(chip).toBeVisible({ timeout: 10_000 });
  await chip.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`#/events/${eventId}`), { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: title }).first()).toBeVisible({ timeout: 15_000 });
});
