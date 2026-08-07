import { test, expect, type Locator } from '@playwright/test';

async function fillInput(locator: Locator, value: string): Promise<void> {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await locator.fill(value);
  if ((await locator.inputValue()) !== value) {
    await locator.fill(value);
  }
  await expect(locator).toHaveValue(value);
}

/**
 * Couple contract signing end-to-end: the demo event ships a draft
 * "Master Venue Agreement"; the couple sees it in the hub's finance
 * section, signs it with a typed signature, and the server records the
 * signed certificate.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('couple signs the shared venue agreement from the hub', async ({ page, request }) => {
  const allErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') allErrors.push(`[console.error] ${msg.text().slice(0, 260)}`);
  });
  page.on('pageerror', (err) => allErrors.push(`[pageerror] ${String(err).slice(0, 260)}`));
  page.on('response', (res) => {
    if (res.status() >= 400) allErrors.push(`[http ${res.status()}] ${res.url().slice(0, 200)}`);
  });

  const coupleEmail = `couple-contract-${Date.now()}@example.com`;
  const reg = await request.post('/api/auth/register', {
    data: { email: coupleEmail, password: 'testpass123', fullName: 'Taylor Couple', orgName: 'Tmp' },
  });
  expect(reg.ok()).toBeTruthy();

  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;
  const events = (await (await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events;
  const event = events.find((e: any) => e.title === 'Smith & Jones Wedding') ?? events[0];
  const eventId = event.id as string;

  const invite = await request.post(`/api/events/${eventId}/couple-invitations`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { email: coupleEmail, roleKey: 'couple' },
  });
  expect(invite.status()).toBe(201);

  const coupleLogin = await request.post('/api/auth/login', { data: { email: coupleEmail, password: 'testpass123' } });
  const coupleToken = (await coupleLogin.json()).token;
  const coupleOrgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${coupleToken}` } })).json();
  const coupleOrgId = coupleOrgs.organizations[0].id;
  await request.put('/api/users/me/preferences', {
    headers: { authorization: `Bearer ${coupleToken}`, 'content-type': 'application/json' },
    data: {
      onboarding: {
        welcomeTourByOrg: {
          [coupleOrgId]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() },
        },
      },
    },
  });

  // Fresh contract per run: legal documents are append-only (PATCH cannot
  // unsign), so create a new draft the couple can sign.
  const title = `Master Venue Agreement ${Date.now()}`;
  const contractRes = await request.post(`/api/events/${eventId}/contracts`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { title, recipientName: 'Taylor Couple', amountCents: 1200000, content: 'Test agreement for e2e signing.' },
  });
  expect(contractRes.status()).toBe(201);
  const contract = ((await contractRes.json()) as any).contract || ((await contractRes.json()) as any);
  expect(contract.id).toBeTruthy();

  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill(coupleEmail);
  await page.getByLabel(/^password$/i).fill('testpass123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/your wedding hub/i, { timeout: 20_000 });
  await expect(page.getByText(event.title)).toBeVisible({ timeout: 20_000 });

  // ── 1. Find the contract in the hub and sign it ──
  const contractTitle = page.getByText(title).first();
  await contractTitle.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  const signBtn = page.getByRole('button', { name: 'Sign' }).first();
  await signBtn.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await signBtn.click();
  const prompt = page.getByRole('dialog');
  await expect(prompt).toBeVisible({ timeout: 10_000 });
  await fillInput(prompt.locator('input[type="text"], textarea').first(), 'Taylor Couple');
  await prompt.getByRole('button', { name: 'Sign' }).last().click();
  await expect(prompt).toBeHidden({ timeout: 10_000 });

  // ── 2. Server-side verification ──
  const afterRes = await request.get(`/api/events/${eventId}/contracts`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const { contracts: after } = (await afterRes.json()) as { contracts: Array<any> };
  const signed = after.find((c: any) => c.id === contract.id);
  expect(signed.status).toBe('signed');
  expect(signed.signature).toBe('Taylor Couple');
  expect(signed.signed_at).toBeTruthy();

  expect(allErrors, `contract signing produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
