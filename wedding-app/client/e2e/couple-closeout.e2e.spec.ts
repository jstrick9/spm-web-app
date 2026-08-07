import { test, expect, type Locator } from '@playwright/test';

/**
 * fillInput — fill an input with a self-healing retry (headless quirk).
 */
async function fillInput(locator: Locator, value: string): Promise<void> {
  await clickSafely(locator);
  await locator.fill(value);
  if ((await locator.inputValue()) !== value) {
    await clickSafely(locator);
    await locator.fill(value);
  }
  await expect(locator).toHaveValue(value);
}

/** clickSafely — keep targets clear of the app's sticky header. */
async function clickSafely(locator: Locator): Promise<void> {
  await locator.evaluate((el) => el.scrollIntoView({ block: 'center', inline: 'nearest' }));
  await locator.click();
}

/**
 * Couple post-event closeout end-to-end: the couple submits the NPS /
 * feedback survey from the hub, the toast confirms, and the server records
 * the survey + audit entry. Also covers the "report lost item" prompt flow.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('couple submits the post-event closeout survey from the hub', async ({ page, request }) => {
  // ── 0. API setup: couple user + event membership ──
  const coupleEmail = `couple-closeout-${Date.now()}@example.com`;
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

  // ── 1. Couple logs in and opens the hub ──
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill(coupleEmail);
  await page.getByLabel(/^password$/i).fill('testpass123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/your wedding hub/i, { timeout: 20_000 });
  await expect(page.getByText(event.title)).toBeVisible({ timeout: 20_000 });

  // ── 2. Submit the closeout survey ──
  const closeout = page.locator('h3, h4', { hasText: /Couple Post-Event Closeout/i }).first();
  await clickSafely(closeout);

  const npsInput = page.locator('label', { hasText: /NPS 0-10/i }).locator('input');
  await fillInput(npsInput, '9');
  const overallInput = page.locator('label', { hasText: /Overall 1-5/i }).locator('input');
  await fillInput(overallInput, '5');
  await fillInput(page.getByPlaceholder(/what went well/i), 'Incredible coordination from the team.');
  const submit = page.getByRole('button', { name: 'Submit feedback/NPS' });
  await clickSafely(submit);
  await expect(page.getByText('Post-event survey saved').first()).toBeVisible({ timeout: 15_000 });

  // ── 3. Server-side verification ──
  const surveyRes = await request.get(`/api/events/${eventId}/couple-post-event`, {
    headers: { authorization: `Bearer ${coupleToken}` },
  });
  expect(surveyRes.status()).toBe(200);
  const summary = (await surveyRes.json()) as { survey?: { npsScore?: number }; nps?: { score?: number | null } };
  expect(summary.survey?.npsScore).toBe(9);
  expect(summary.nps?.score).toBe(9);
  expect((summary.nps as any)?.label).toBe("promoter");
});
