import { test, expect } from '@playwright/test';

/**
 * Venue-name-in-hub + public-polls verification e2e.
 *
 * 1. The couple hub must show the venue's real name (it used to 403 on
 *    /api/orgs/:id and fall back to "Your venue").
 * 2. The public guest portal must render venue polls (the polls GET was
 *    auth-only, so the section was always empty + every load 403'd).
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('couple sees the venue name and guests see venue polls', async ({ page, request }) => {
  // ── 0. API setup: owner + event + couple + guest + poll ──────────────
  const login = await request.post('/api/auth/login', { data: { email: 'owner@demo.local', password: 'wedding123' } });
  const { token } = await login.json();
  const orgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json();
  const orgId = orgs.organizations[0].id as string;
  const orgName = orgs.organizations[0].name as string;
  const events = (await (await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events;
  const event = events.find((e: any) => e.title === 'Smith & Jones Wedding') ?? events[0];
  const eventId = event.id as string;

  // Add a poll to the event metadata so the portal has something to show.
  const evt = await (await request.get(`/api/events/${eventId}`, { headers: { authorization: `Bearer ${token}` } })).json();
  const meta = (() => { try { return JSON.parse(evt.event.metadata || '{}'); } catch { return {}; } })();
  meta.polls = [{ id: 'poll-verify-1', question: 'Which signature cocktail?', status: 'active', options: [{ id: 'o1', text: 'Lavender gin', votes: 3 }, { id: 'o2', text: 'Peach bourbon', votes: 1 }] }];
  await request.patch(`/api/events/${eventId}`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { metadata: meta },
  });

  const coupleEmail = `verify-couple-${Date.now()}@example.com`;
  await request.post('/api/auth/register', { data: { email: coupleEmail, password: 'testpass123', fullName: 'Verify Couple', orgName: 'Tmp' } });
  await request.post(`/api/events/${eventId}/couple-invitations`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { email: coupleEmail, roleKey: 'couple' },
  });
  const coupleLogin = await request.post('/api/auth/login', { data: { email: coupleEmail, password: 'testpass123' } });
  const coupleToken = (await coupleLogin.json()).token;
  const coupleOrgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${coupleToken}` } })).json();
  await request.put('/api/users/me/preferences', {
    headers: { authorization: `Bearer ${coupleToken}`, 'content-type': 'application/json' },
    data: { onboarding: { welcomeTourByOrg: { [coupleOrgs.organizations[0].id]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() } } } },
  });

  const guestName = `Verify Guest ${Date.now()}`;
  const created = await request.post(`/api/events/${eventId}/couple-guests`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { fullName: guestName, email: `verify-guest-${Date.now()}@example.com`, rsvpStatus: 'pending' },
  });
  const guestId = (await created.json()).guest.id as string;
  const linkRes = await request.post(`/api/events/${eventId}/couple-guests/${guestId}/portal-link`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const { token: guestToken } = (await linkRes.json()) as { token: string };

  // ── 1. Couple hub shows the real venue name ──────────────────────────
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill(coupleEmail);
  await page.getByLabel(/^password$/i).fill('testpass123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/your wedding hub/i, { timeout: 20_000 });
  await expect(page.getByText(event.title).first()).toBeVisible({ timeout: 20_000 });

  // Regression: this used to read "Your venue" (the org fetch 403'd).
  await expect(page.getByText(orgName).first()).toBeVisible({ timeout: 15_000 });

  // ── 2. Guest portal shows the venue poll ─────────────────────────────
  await page.goto(`/#/portal/${eventId}?guest=${guestId}&token=${guestToken}`);
  await expect(page.locator('h1')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Which signature cocktail?')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Lavender gin')).toBeVisible({ timeout: 10_000 });
});
