import { test, expect } from '@playwright/test';

/**
 * Staff shift scheduling + EDITING end-to-end.
 *
 * Shifts could be created/deleted/clocked but NEVER edited from the UI
 * (updateShift existed server-side but had no caller) — a wrong time or
 * crew change meant delete + recreate, losing clock-in state.
 *
 * Flow: owner schedules a shift for the demo event → the shift appears →
 * "Edit" pre-fills the scheduler → change the time → "Save Shift Changes"
 * → server records the updated shift.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

const BASE = process.env.A11Y_BASE_URL || 'http://localhost:3000';

test('staff shifts can be scheduled and then edited from the UI', async ({ page, request }) => {
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

  const created = await request.post('/api/events', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { organizationId: orgId, title: `Shift Edit ${Date.now()}`, status: 'planning', startDate: '2026-12-10', guestCount: 80 },
  });
  expect(created.status()).toBe(201);
  const eventId = ((await created.json()) as any).event.id as string;

  // the scheduler needs a staff member to assign — org members include the owner
  const members = (await (await request.get(`/api/orgs/${orgId}/members`, { headers: { authorization: `Bearer ${token}` } })).json());
  const ownerMember = (members.members || []).find((m: any) => ['owner', 'admin', 'manager', 'staff'].includes(String(m.role_key || m.roleKey || '').toLowerCase()));
  expect(ownerMember, 'org must have an assignable staff member').toBeTruthy();
  const staffId = ownerMember.userId || ownerMember.user_id;

  await page.goto(BASE + '/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.locator('#pw').fill('wedding123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  // ── 1. Open the Staff tab (planning event) ──
  await page.goto(BASE + `/#/events/${eventId}?tab=staff`);
  await expect(page.getByRole('tab', { name: /^Staff/ })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2000);

  // ── 2. Schedule a shift (the scheduler is a collapsible card) ──
  const scheduler = page.getByRole('button', { name: /staff shift & crew scheduler/i });
  await scheduler.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await scheduler.click();
  await expect(page.getByRole('button', { name: /schedule staff shift/i })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /schedule staff shift/i }).click();

  const staffSelect = page.getByText('Assigned Staff Member').locator('..').locator('select');
  await staffSelect.selectOption({ label: 'owner@demo.local' });
  const starts = page.locator('input[type="datetime-local"]').nth(0);
  const ends = page.locator('input[type="datetime-local"]').nth(1);
  await starts.fill('2026-12-10T14:00');
  await ends.fill('2026-12-10T18:00');
  await page.getByRole('button', { name: 'Schedule Shift' }).click();
  await expect(page.getByText('Staff shift scheduled successfully').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('2:00 PM').first()).toBeVisible({ timeout: 10_000 });

  // ── 3. Edit the shift (time change) ──
  const editBtn = page.getByRole('button', { name: /edit shift for/i }).first();
  await editBtn.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await editBtn.click();
  await expect(page.getByText('Edit Crew Shift Assignment')).toBeVisible({ timeout: 10_000 });
  const starts2 = page.locator('input[type="datetime-local"]').nth(0);
  await starts2.fill('2026-12-10T15:00');
  await page.getByRole('button', { name: 'Save Shift Changes' }).click();
  await expect(page.getByText('Staff shift updated').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('3:00 PM').first()).toBeVisible({ timeout: 10_000 });

  // ── 4. Server-side verification ──
  const shiftsRes = await request.get(`/api/orgs/${orgId}/staff/shifts?eventId=${eventId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(shiftsRes.status()).toBe(200);
  const { shifts } = (await shiftsRes.json()) as { shifts: Array<any> };
  expect(shifts.length, 'shift must be recorded server-side').toBeGreaterThan(0);
  const latest = shifts[0];
  expect(new Date(latest.starts_at).getHours()).toBe(15); // 3:00 PM local

  expect(allErrors, `shift scheduling produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
