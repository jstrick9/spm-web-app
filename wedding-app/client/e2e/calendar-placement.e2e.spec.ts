import { test, expect } from '@playwright/test';

/**
 * Global Calendar event placement end-to-end (timezone regression).
 *
 * The calendar must place an event on its calendar-date cell regardless of
 * the viewer's timezone. A date-only `start_date` (e.g. "2026-09-12")
 * parsed with `new Date()` becomes UTC midnight — which lands on the
 * PREVIOUS day in every US timezone — so events used to render one day
 * early for US venues. This spec pins the browser to America/New_York and
 * asserts the event appears in TODAY's cell, not yesterday's.
 */
test.use({ viewport: { width: 1440, height: 1400 }, timezoneId: 'America/New_York' });

test('events land on their calendar date in a US timezone', async ({ page, request }) => {
  // ── 0. API setup: owner session + tour state + event dated today ────
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

  // "Today" in the browser's timezone (America/New_York — the same clock the
  // calendar grid uses).
  const today = await page.evaluate(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return { iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, day: d.getDate() };
  });

  const title = `Calendar Placement ${Date.now()}`;
  const created = await request.post('/api/events', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { organizationId: orgId, title, startDate: today.iso, status: 'booked' },
  });
  expect(created.status()).toBe(201);

  // ── 1. Open the calendar ─────────────────────────────────────────────
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.getByLabel(/^password$/i).fill('wedding123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  await page.goto('/#/calendar');
  await expect(page.getByRole('heading', { name: 'Event Calendar' })).toBeVisible({ timeout: 15_000 });

  // ── 2. The event must be in TODAY's cell ─────────────────────────────
  await expect
    .poll(async () => {
      return page.evaluate(({ title, day }) => {
        const daySpans = Array.from(document.querySelectorAll('span')).filter(
          (s) => /^\d{1,2}$/.test(s.textContent?.trim() ?? '') && s.className.includes('rounded-full'),
        );
        for (const span of daySpans) {
          const cell = span.parentElement?.parentElement;
          if (!cell) continue;
          const isToday = span.className.includes('bg-brand');
          const hasEvent = cell.textContent?.includes(title) ?? false;
          if (isToday) return hasEvent ? 'today' : 'missing';
        }
        return 'no-today-cell';
      }, { title, day: today.day });
    }, { timeout: 15_000, intervals: [1000] })
    .toBe('today');

  // ── 3. And NOT in yesterday's cell ───────────────────────────────────
  const yesterdayHasIt = await page.evaluate(({ title }) => {
    const daySpans = Array.from(document.querySelectorAll('span')).filter(
      (s) => /^\d{1,2}$/.test(s.textContent?.trim() ?? '') && s.className.includes('rounded-full'),
    );
    for (const span of daySpans) {
      const cell = span.parentElement?.parentElement;
      if (!cell) continue;
      if (cell.textContent?.includes(title) && !span.className.includes('bg-brand')) return true;
    }
    return false;
  }, { title });
  expect(yesterdayHasIt, 'event must NOT sit in a non-today cell').toBe(false);
});
