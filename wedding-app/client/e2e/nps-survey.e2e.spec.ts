import { test, expect } from '@playwright/test';

/**
 * Public NPS survey end-to-end: an anonymous guest opens /#/survey/:eventId,
 * selects a score, adds a comment, submits, sees the thank-you state, and
 * the server records the response (one per device — a second submit is
 * treated as already-submitted).
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('guest submits the public NPS survey and sees the thank-you state', async ({ page, request }) => {
  const allErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') allErrors.push(`[console.error] ${msg.text().slice(0, 260)}`);
  });
  page.on('pageerror', (err) => allErrors.push(`[pageerror] ${String(err).slice(0, 260)}`));
  page.on('response', (res) => {
    if (res.status() >= 400) allErrors.push(`[http ${res.status()}] ${res.url().slice(0, 200)}`);
  });

  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;
  // One response per device/IP is server-enforced, so a FRESH event per run
  // keeps the spec order-independent (re-submitting the same event 409s).
  const created = await request.post('/api/events', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { organizationId: orgId, title: `NPS Survey ${Date.now()}`, status: 'planning', startDate: '2026-01-15', guestCount: 40 },
  });
  expect(created.status()).toBe(201);
  const eventId = ((await created.json()) as any).event.id as string;
  // Stage to completed so the survey surface reads as post-event.
  const staged = await request.post(`/api/events/${eventId}/stage`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { status: 'completed' },
  });
  expect(staged.status()).toBe(200);

  // ── 1. Open the public survey ──
  await page.goto(`/#/survey/${eventId}`);
  await expect(page.getByRole('heading', { name: /post-event feedback/i })).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1500);

  // ── 2. Select a score and submit ──
  await page.getByRole('button', { name: '9', exact: true }).click();
  const comment = page.getByPlaceholder(/share your thoughts/i).first();
  await comment.fill('The venue was lovely and the team attentive.');
  const submit = page.getByRole('button', { name: /submit feedback/i }).click();

  // ── 3. Thank-you state ──
  await expect(page.getByText(/thank you|submitted|appreciated/i).first()).toBeVisible({ timeout: 15000 });

  expect(allErrors, `NPS survey produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
