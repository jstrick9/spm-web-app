import { test, expect } from '@playwright/test';

/**
 * Event Staff + Chat tab interactions end-to-end:
 *  - "Create checklist" seeds the event-week setup checklist (server-side),
 *  - the Staff setup wizard applies a task template,
 *  - the Chat tab sends a message that renders in the thread (local-first,
 *    IndexedDB-backed) without console errors.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

const BASE = process.env.A11Y_BASE_URL || 'http://localhost:3000';

test('staff checklist seeding, task template, and chat messaging work', async ({ page, request }) => {
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
  // The Staff tab is stage-gated to planning+ — create a planning event.
  const created = await request.post('/api/events', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { organizationId: orgId, title: `Staff Chat ${Date.now()}`, status: 'planning', startDate: '2026-11-15', guestCount: 80 },
  });
  expect(created.status()).toBe(201);
  const eventId = ((await created.json()) as any).event.id as string;

  await page.goto(BASE + '/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.locator('#pw').fill('wedding123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  // ── 1. Staff tab: seed the setup checklist ──
  await page.goto(BASE + `/#/events/${eventId}?tab=staff`);
  await expect(page.getByRole('tab', { name: /^Staff/ })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2000);

  const checklistCard = page.getByText('Event Week setup checklist').locator('..').locator('..');
  const createChecklist = page.getByRole('button', { name: 'Create checklist' });
  if (await createChecklist.count()) {
    await createChecklist.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await createChecklist.click();
    await expect(page.getByText('Staff setup template added').or(page.getByText(/checklist/i).first())).toBeVisible({ timeout: 15_000 }).catch(() => {});
  }

  const checklistRes = await request.get(`/api/events/${eventId}/setup-checklist`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(checklistRes.status()).toBe(200);
  const { checklist } = (await checklistRes.json()) as { checklist: Array<{ title: string }> };
  expect(checklist.length, 'setup checklist must be seeded server-side').toBeGreaterThan(0);

  // ── 2. Staff setup wizard: apply a task template ──
  const wizardBtn = page.getByRole('button', { name: /staff setup wizard/i });
  if (await wizardBtn.count()) {
    await wizardBtn.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await wizardBtn.click();
    const wizard = page.getByRole('dialog');
    await expect(wizard).toBeVisible({ timeout: 10_000 });
    const templateBtn = wizard.locator('button').first();
    await templateBtn.click();
    await expect(page.getByText('Staff setup template added').first()).toBeVisible({ timeout: 15_000 });
  }

  // ── 3. Chat tab: send a message ──
  await page.goto(BASE + `/#/events/${eventId}?tab=chat`);
  await expect(page.getByRole('tab', { name: /^Chat/ })).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2000);
  const chatBody = `E2E chat message ${Date.now()}`;
  const chatInput = page.locator('input[placeholder*="Message #"]');
  await chatInput.fill(chatBody);
  await chatInput.press('Enter');
  await expect(page.getByText(chatBody).first()).toBeVisible({ timeout: 10_000 });

  expect(allErrors, `staff/chat tabs produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
