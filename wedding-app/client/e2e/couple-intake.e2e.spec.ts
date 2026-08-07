import { test, expect } from '@playwright/test';

/**
 * Couple intake questionnaire end-to-end — regression for the dead-ended
 * "Couple Intake Forms": the venue created questions but no UI let couples
 * answer them (answers API was events.edit-only; SDK had zero callers).
 *
 * Flow: venue publishes intake questions → fresh couple opens their hub →
 * answers the required question → venue Questions Studio "View answers"
 * shows the couple's answer.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

const BASE = process.env.A11Y_BASE_URL || 'http://localhost:3000';

/** Headless Chromium's first fill after an SPA navigation can silently
 *  no-op — click first, retry once if the value didn't stick. */
async function fillInput(locator: import('@playwright/test').Locator, value: string): Promise<void> {
  // the hub re-renders on SSE refetches (full-suite churn) — fill() retries
  // the silent first-fill quirk without a stability-gated click
  await locator.fill(value);
  if ((await locator.inputValue()) !== value) {
    await locator.fill(value);
  }
  await expect(locator).toHaveValue(value);
}

test('couple answers the venue intake questionnaire and the venue sees it', async ({ page, request }) => {
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

  // ── 0. Venue publishes intake questions ──
  const stamp = Date.now();
  // run-unique GROUP so leftover required questions from prior runs can
  // never block saving this run's group
  const groupName = `Intake ${stamp}`;
  const q1 = await request.post(`/api/orgs/${orgId}/questions`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { question: `Ceremony style ${stamp}?`, groupName, answerType: 'text', required: true },
  });
  expect(q1.status()).toBe(201);
  const q2 = await request.post(`/api/orgs/${orgId}/questions`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { question: `Guest count ${stamp}?`, groupName: 'Guests', answerType: 'integer', required: false },
  });
  expect(q2.status()).toBe(201);

  const event = (await (await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events
    .find((e: any) => e.title === 'Smith & Jones Wedding') ?? (await (await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events[0];
  const eventId = event.id as string;

  // fresh couple
  const coupleEmail = `intake-${stamp}@example.com`;
  const reg = await request.post('/api/auth/register', {
    data: { email: coupleEmail, password: 'testpass123', fullName: 'Intake Couple', orgName: 'Tmp' },
  });
  expect(reg.ok()).toBeTruthy();
  const invite = await request.post(`/api/events/${eventId}/couple-invitations`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { email: coupleEmail, roleKey: 'couple' },
  });
  expect(invite.status()).toBe(201);
  const coupleLogin = await request.post('/api/auth/login', { data: { email: coupleEmail, password: 'testpass123' } });
  const coupleToken = (await coupleLogin.json()).token;
  const coupleOrgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${coupleToken}` } })).json();
  await request.put('/api/users/me/preferences', {
    headers: { authorization: `Bearer ${coupleToken}`, 'content-type': 'application/json' },
    data: { onboarding: { welcomeTourByOrg: { [coupleOrgs.organizations[0].id]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() } } } },
  });

  // ── 1. Couple opens the hub → intake panel with the questions ──
  await page.goto(BASE + '/#/');
  await page.getByLabel(/email address/i).fill(coupleEmail);
  await page.locator('#pw').fill('testpass123');
  await page.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(page.locator('body')).toContainText(/your wedding hub/i, { timeout: 20_000 });

  await expect(page.getByText('Couple Intake & Questionnaire').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(`Ceremony style ${stamp}?`).first()).toBeVisible({ timeout: 15_000 });

  // ── 2. Answer the required question and save the group ──
  await fillInput(page.getByLabel(`Ceremony style ${stamp}?`), 'Garden ceremony with arbor');
  // the Save button lives in the group header — anchor on the run-unique
  // group heading and walk up to the group card
  const ceremonyGroup = page.getByText(groupName, { exact: true }).locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " rounded-xl ")][1]');
  const saveBtn = ceremonyGroup.getByRole('button', { name: 'Save group' });
  await saveBtn.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await saveBtn.click({ force: true });
  await expect(page.getByText('Intake answers saved').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/1\/1 answered/).first()).toBeVisible({ timeout: 10_000 });

  // ── 3. Venue sees the answer in the Questions Studio (separate context —
  // same-context pages share localStorage, which holds the couple token) ──
  const venueContext = await page.context().browser()!.newContext({ viewport: { width: 1440, height: 1400 } });
  const venuePage = await venueContext.newPage();
  await venuePage.goto(BASE + '/#/');
  await venuePage.getByLabel(/email address/i).fill('owner@demo.local');
  await venuePage.locator('#pw').fill('wedding123');
  await venuePage.getByRole('button', { name: 'Sign in securely' }).click();
  await expect(venuePage.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });
  await venuePage.goto(BASE + '/#/system/questions');
  await expect(venuePage.getByText(`Ceremony style ${stamp}?`).first()).toBeVisible({ timeout: 15_000 });
  // expand THIS question's answers (walk up from the question text to its row)
  const questionRow = venuePage.getByText(`Ceremony style ${stamp}?`).locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " p-4 ")][1]');
  await questionRow.getByRole('button', { name: 'View answers' }).click();
  await expect(questionRow.getByText('Garden ceremony with arbor').first()).toBeVisible({ timeout: 15_000 });
  await venueContext.close();

  // ── 4. Server verification ──
  const answersRes = await request.get(`/api/events/${eventId}/answers`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const { answers } = (await answersRes.json()) as { answers: Array<{ answer: string }> };
  expect(answers.some((a) => a.answer === 'Garden ceremony with arbor'), 'couple answer must be recorded server-side').toBe(true);

  expect(allErrors, `intake flow produced console/network errors:\n${allErrors.join('\n')}`).toEqual([]);
});
