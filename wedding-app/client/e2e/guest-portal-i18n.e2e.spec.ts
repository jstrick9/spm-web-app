import { test, expect } from '@playwright/test';

/**
 * Guest portal i18n end-to-end:
 *  - the language selector translates the UI live (Español / Français / 中文),
 *  - the choice persists across reloads (localStorage),
 *  - a token-holding guest's choice round-trips to the server (info payload)
 *    and survives a fresh browser context (server-side restore).
 */
test.use({ viewport: { width: 1440, height: 1400 } });

const BASE = process.env.A11Y_BASE_URL || 'http://localhost:3000';

async function setupGuest(request: import('@playwright/test').APIRequestContext) {
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
  const created = await request.post(`/api/events/${eventId}/couple-guests`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { fullName: `I18n Guest ${stamp}`, email: `i18n-${stamp}@example.com`, rsvpStatus: 'pending' },
  });
  expect(created.status()).toBe(201);
  const guestId = (await created.json()).guest.id as string;
  const linkRes = await request.post(`/api/events/${eventId}/couple-guests/${guestId}/portal-link`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const { token: guestToken } = (await linkRes.json()) as { token: string };
  return { eventId, guestId, guestToken };
}

test('language selector translates, persists locally, and round-trips to the server', async ({ page, request }) => {
  const { eventId, guestId, guestToken } = await setupGuest(request);

  // ── 1. Open the portal in English ──
  await page.goto(`${BASE}/#/portal/${eventId}?guest=${guestId}&token=${guestToken}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(/Guest Welcome \/ Start Here/i)).toBeVisible({ timeout: 15000 });

  // ── 2. Switch to Español → UI translates live ──
  await page.getByLabel('Portal shell language').selectOption('es');
  await expect(page.getByText(/Bienvenida del invitado \/ Comienza aquí/i)).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Abrir RSVP' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Inicio' })).toBeVisible(); // bottom nav

  // ── 3. Persists across reload (localStorage) ──
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Bienvenida del invitado \/ Comienza aquí/i)).toBeVisible({ timeout: 15000 });

  // ── 4. Round-trip: server info payload now reports es ──
  const info = await request.get(`/api/portal/${eventId}/info?guest=${guestId}&token=${guestToken}`);
  expect(info.status()).toBe(200);
  expect((await info.json()).language).toBe('es');

  // ── 5. Français + 中文 also render ──
  await page.getByLabel('Idioma del portal').selectOption('fr');
  await expect(page.getByText(/Bienvenue invités \/ Commencer ici/i)).toBeVisible({ timeout: 10000 });
  await page.getByLabel('Langue du portail').selectOption('zh');
  await expect(page.getByText(/宾客欢迎 \/ 从这里开始/i)).toBeVisible({ timeout: 10000 });

  // ── 6. A FRESH browser context restores the saved language (server + localStorage) ──
  const info2 = await request.get(`/api/portal/${eventId}/info?guest=${guestId}&token=${guestToken}`);
  expect((await info2.json()).language).toBe('zh');
});
