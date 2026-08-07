import { test, expect } from '@playwright/test';

/**
 * Password-protected guest portal end-to-end — regression for the broken
 * security toggle: the venue could require a password but NOTHING enforced
 * it (full guest data was served to anyone with the link).
 *
 * Flow: venue sets a portal password → guest opens the portal → sees the
 * unlock gate (NOT the RSVP data) → wrong password rejected → correct
 * password unlocks the full portal → reload keeps the session unlocked.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

const BASE = process.env.A11Y_BASE_URL || 'http://localhost:3000';

test('password-protected portal enforces the gate end-to-end', async ({ page, request }) => {
  const allErrors: string[] = [];
  page.on('console', (msg) => {
    // the wrong-password step intentionally triggers a 401 — the browser's
    // own "Failed to load resource" for it is expected, not a defect
    if (msg.type() === 'error' && !/401 \(Unauthorized\)/.test(msg.text())) {
      allErrors.push(`[console.error] ${msg.text().slice(0, 260)}`);
    }
  });
  page.on('pageerror', (err) => allErrors.push(`[pageerror] ${String(err).slice(0, 260)}`));
  page.on('response', (res) => {
    // the wrong-password step intentionally triggers a 401 — not a defect
    if (res.status() >= 400 && !res.url().includes('/verify-password')) {
      allErrors.push(`[http ${res.status()}] ${res.url().slice(0, 200)}`);
    }
  });

  // ── 0. Setup: owner + event + guest + portal password ──
  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;
  const created = await request.post('/api/events', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { organizationId: orgId, title: `Pw Portal ${Date.now()}`, status: 'planning', startDate: '2026-12-05', guestCount: 40 },
  });
  expect(created.status()).toBe(201);
  const eventId = ((await created.json()) as any).event.id as string;

  const g = await request.post(`/api/events/${eventId}/couple-guests`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { fullName: 'Pw Guest', email: `pw-${Date.now()}@example.com`, rsvpStatus: 'pending' },
  });
  const guestId = (await g.json()).guest.id as string;
  const linkRes = await request.post(`/api/events/${eventId}/couple-guests/${guestId}/portal-link`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const { token: guestToken } = (await linkRes.json()) as { token: string };

  const pw = 'guest-pass-123';
  const setPw = await request.put(`/api/events/${eventId}/portal-config`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { enabled: true, password: pw, config: {} },
  });
  expect(setPw.status()).toBe(200);

  // ── 1. Guest opens the portal → the unlock gate appears, NOT the RSVP UI ──
  await page.goto(`${BASE}/#/portal/${eventId}?guest=${guestId}&token=${guestToken}`);
  await expect(page.getByText(/password protected/i)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Guest Welcome / Start Here')).toHaveCount(0);
  await expect(page.getByText(/RSVP deadline/i)).toHaveCount(0);

  // ── 2. Wrong password is rejected ──
  await page.getByLabel(/portal password/i).fill('wrong-pass');
  await page.getByRole('button', { name: /unlock portal/i }).click();
  await expect(page.getByText(/not correct/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/password protected/i)).toBeVisible();

  // ── 3. Correct password unlocks the full portal ──
  await page.getByLabel(/portal password/i).fill(pw);
  await page.getByRole('button', { name: /unlock portal/i }).click();
  await expect(page.getByText('Guest Welcome / Start Here')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/RSVP deadline/i).first()).toBeVisible({ timeout: 15_000 });

  // ── 4. Reload keeps the session unlocked (proof in sessionStorage) ──
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Guest Welcome / Start Here')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/password protected/i)).toHaveCount(0);

  expect(allErrors, `password gate produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
