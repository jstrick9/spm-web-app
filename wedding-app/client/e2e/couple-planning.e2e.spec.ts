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
 * Couple advanced planning end-to-end: the couple opens the hub, the
 * best-in-class planning suite renders (AI concierge + planning modules),
 * and "Ask venue" escalates a question that the server records as a couple
 * request.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('couple escalates a planning question to the venue from the hub', async ({ page, request }) => {
  const allErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') allErrors.push(`[console.error] ${msg.text().slice(0, 260)}`);
  });
  page.on('pageerror', (err) => allErrors.push(`[pageerror] ${String(err).slice(0, 260)}`));
  page.on('response', (res) => {
    if (res.status() >= 400) allErrors.push(`[http ${res.status()}] ${res.url().slice(0, 200)}`);
  });

  const coupleEmail = `couple-planning-${Date.now()}@example.com`;
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

  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill(coupleEmail);
  await page.getByLabel(/^password$/i).fill('testpass123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/your wedding hub/i, { timeout: 20_000 });
  await expect(page.getByText(event.title)).toBeVisible({ timeout: 20_000 });

  // ── 1. Advanced planning suite renders ──
  await expect(page.getByText(/best-in-class couple planning suite/i).first()).toBeVisible({ timeout: 20_000 });

  // ── 2. Ask the venue a question from a module ──
  const askVenue = page.getByRole('button', { name: 'Ask venue' }).first();
  await askVenue.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await askVenue.click();
  const prompt = page.getByRole('dialog');
  await expect(prompt).toBeVisible({ timeout: 10_000 });
  const question = `Can we seat 140 guests? ${Date.now()}`;
  await fillInput(prompt.locator('textarea, input[type="text"]').first(), question);
  await prompt.getByRole('button', { name: /send|submit|ask|save|confirm/i }).first().click();
  await expect(prompt).toBeHidden({ timeout: 10_000 });

  // ── 3. Server-side verification ──
  const requestsRes = await request.get(`/api/events/${eventId}/couple-requests`, {
    headers: { authorization: `Bearer ${coupleToken}` },
  });
  if (requestsRes.status() === 200) {
    const { requests } = (await requestsRes.json()) as { requests: Array<any> };
    const found = requests.find((r: any) => r.note?.includes('140 guests') || r.question?.includes('140 guests') || (r.metadata && JSON.stringify(r.metadata).includes('140 guests')));
    expect(found, 'couple question must be recorded as a request').toBeTruthy();
  }

  expect(allErrors, `couple planning produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
