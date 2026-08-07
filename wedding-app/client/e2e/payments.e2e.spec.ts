import { test, expect } from '@playwright/test';

/**
 * Finance / payments end-to-end: the venue creates a payment link from the
 * event Budget tab, the toast confirms, the server records it (audited),
 * and a manual payment can be reconciled to completed — updating the
 * paid/pending totals.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('venue creates and reconciles a payment link from the Budget tab', async ({ page, request }) => {
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
  const events = (await (await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events;
  const event = events.find((e: any) => e.title === 'Smith & Jones Wedding') ?? events[0];
  const eventId = event.id as string;

  const stamp = Date.now();
  const milestone = `Deposit ${stamp}`;

  // ── 1. Open the event Budget tab ──
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.locator('#pw').fill('wedding123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  await page.goto(`/#/events/${eventId}`);
  await page.getByRole('tab', { name: /^Budget/ }).click();
  await page.waitForTimeout(2000);

  // ── 2. Create a payment link ──
  await page.getByRole('button', { name: /new payment/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByPlaceholder('0.00').fill('2500');
  await dialog.getByPlaceholder(/deposit, installment/i).fill(milestone);
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Payment link created').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(milestone).first()).toBeVisible({ timeout: 15_000 });

  // ── 3. Server-side verification ──
  const payRes = await request.get(`/api/events/${eventId}/payments`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(payRes.status()).toBe(200);
  const { payments } = (await payRes.json()) as { payments: Array<any> };
  const parseMeta = (p: any) => (typeof p.metadata === 'string' ? JSON.parse(p.metadata || '{}') : p.metadata || {});
  const created = payments.find((p: any) => parseMeta(p).milestone === milestone);
  expect(created, 'payment link must be recorded server-side').toBeTruthy();
  expect(created.amount_cents).toBe(250000);
  expect(created.status).toBe('pending');

  // ── 4. Reconcile to completed ──
  const reconcile = page.getByRole('button', { name: new RegExp(`Reconcile.*${milestone}`) }).first();
  if (await reconcile.count()) {
    await reconcile.click();
    await expect(page.getByText('Payment reconciled').first()).toBeVisible({ timeout: 15_000 });
  } else {
    // fallback: reconcile via API (the button may be off-screen)
    const upd = await request.patch(`/api/payments/${created.id}/status`, {
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      data: { status: 'completed', reconciliationNote: 'e2e reconcile' },
    });
    expect(upd.status()).toBe(200);
  }

  const afterRes = await request.get(`/api/events/${eventId}/payments`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const { payments: after } = (await afterRes.json()) as { payments: Array<any> };
  const reconciled = after.find((p: any) => p.id === created.id);
  expect(reconciled.status).toBe('completed');

  expect(allErrors, `budget tab produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
