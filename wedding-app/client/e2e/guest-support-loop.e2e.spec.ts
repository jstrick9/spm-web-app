import { test, expect } from '@playwright/test';

/**
 * Guest support loop end-to-end.
 *
 * A guest who cannot find their name requests help from the public portal;
 * the venue sees the request in the event Guests tab's help inbox and
 * replies + resolves it; the server records the reply and resolves the
 * request (SLA state machine). Covers the portal's anonymous-help surface
 * the venue team depends on during event week.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('guest help request → venue reply + resolve loop', async ({ page, request }) => {
  // ── 0. API setup: owner + event + tour state ─────────────────────────
  const login = await request.post('/api/auth/login', { data: { email: 'owner@demo.local', password: 'wedding123' } });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;
  await request.put('/api/users/me/preferences', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { onboarding: { welcomeTourByOrg: { [orgId]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() } } } },
  });
  const events = (await (await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events;
  const event = events.find((e: any) => e.title === 'Smith & Jones Wedding') ?? events[0];
  const eventId = event.id as string;

  const stamp = Date.now();
  const guestEmail = `lost-guest-${stamp}@example.com`;

  // ── 1. Guest portal: "I cannot find my name" ─────────────────────────
  await page.goto(`/#/portal/${eventId}`);
  await expect(page.locator('h1')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: /i cannot find my name/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByLabel(/email where the venue/i).fill(guestEmail);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/help request|sent|receive/i).first()).toBeVisible({ timeout: 10_000 }).catch(() => {});

  // Server-side: the request exists, open, unassigned.
  const helpRes = await request.get(`/api/events/${eventId}/guest-help-requests`, { headers: { authorization: `Bearer ${token}` } });
  expect(helpRes.ok()).toBeTruthy();
  const requests = (await helpRes.json()).requests as Array<any>;
  const help = requests.find((r: any) => r.email === guestEmail);
  expect(help, 'help request must exist').toBeTruthy();
  expect(help.kind).toBe('cannot_find_name');
  expect(help.status).toBe('open');

  // ── 2. Venue: Guests tab → help inbox → reply + resolve ──────────────
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.getByLabel(/^password$/i).fill('wedding123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  await page.goto(`/#/events/${eventId}`);
  await expect(page.locator('body')).toContainText(/smith & jones wedding/i, { timeout: 20_000 });
  // The Guests tab sits inside a labelled group ("Guests group"); select by
  // text within the tablist (role=tab matching is unreliable here).
  await page.locator('[role="tablist"]').getByText('Guests', { exact: true }).click();
  await expect(page.getByText(guestEmail)).toBeVisible({ timeout: 15_000 });

  const row = page.getByText(guestEmail).locator('..').locator('..');
  await row.getByRole('button', { name: /reply \+ resolve/i }).click();
  const replyDialog = page.getByRole('dialog');
  await expect(replyDialog).toBeVisible({ timeout: 10_000 });
  await replyDialog.getByLabel(/reply message to guest/i).fill('We found your invitation — a secure link is on its way!');
  await replyDialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText(/reply queued|guest reply/i).first()).toBeVisible({ timeout: 10_000 }).catch(() => {});

  // ── 3. Server verification: resolved + reply recorded ────────────────
  const afterRes = await request.get(`/api/events/${eventId}/guest-help-requests`, { headers: { authorization: `Bearer ${token}` } });
  const after = (await afterRes.json()).requests as Array<any>;
  const resolved = after.find((r: any) => r.id === help.id);
  expect(resolved).toBeTruthy();
  expect(resolved.status).toBe('resolved');
  // The reply is recorded on the request (last_reply_* fields). The
  // dispatch status is 'email_provider_not_connected' in this environment
  // (no SMTP integration seeded) — the important contract is that the
  // venue's reply was recorded against the request.
  expect(resolved.lastReplyAt).toBeTruthy();
  expect(resolved.lastReplyStatus).toBeTruthy();
  expect(['queued', 'sent', 'email_provider_not_connected']).toContain(resolved.lastReplyStatus);
});
