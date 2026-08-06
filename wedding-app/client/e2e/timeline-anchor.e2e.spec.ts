import { test, expect } from '@playwright/test';

/**
 * Timeline item anchoring end-to-end.
 *
 * New timeline items must be stored on the EVENT's wedding date — the old
 * code anchored them to the creation day, so guest ICS exports carried the
 * wrong day and items were flagged "late" the same evening they were made.
 * The e2e creates an event ~6 weeks out, adds a timeline item through the
 * real UI, and verifies the server stored it ON the wedding date.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('timeline items are anchored to the wedding date, not the creation date', async ({ page, request }) => {
  // ── 0. API setup: owner + event ~6 weeks out ─────────────────────────
  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;

  const pad = (n: number) => String(n).padStart(2, '0');
  const wedding = new Date();
  wedding.setDate(wedding.getDate() + 42);
  const weddingDate = `${wedding.getFullYear()}-${pad(wedding.getMonth() + 1)}-${pad(wedding.getDate())}`;

  const created = await request.post('/api/events', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { organizationId: orgId, title: `Timeline Anchor ${Date.now()}`, startDate: weddingDate, status: 'booked' },
  });
  expect(created.status()).toBe(201);
  const eventId = (await created.json()).event.id as string;

  await request.put('/api/users/me/preferences', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { onboarding: { welcomeTourByOrg: { [orgId]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() } } } },
  });

  // ── 1. Open the event timeline tab ───────────────────────────────────
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.getByLabel(/^password$/i).fill('wedding123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  await page.goto(`/#/events/${eventId}`);
  await expect(page.locator('body')).toContainText(/smith|timeline/i, { timeout: 20_000 }).catch(() => {});
  // The event tabs are in-page controls (not URL segments): open Timeline.
  await page.getByRole('tab', { name: /timeline/i }).click();
  const addButton = page.getByRole('button', { name: /add item|create first item/i }).first();
  await expect(addButton).toBeVisible({ timeout: 20_000 });
  await addButton.click();

  // ── 2. Fill the dialog ───────────────────────────────────────────────
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByPlaceholder('e.g., Cocktail Hour').fill('Ceremony');
  await dialog.locator('input[type="time"]').fill('16:30');
  await dialog.getByRole('button', { name: 'Add Item' }).click();

  // Toast confirms the item was added.
  await expect(page.getByText(/timeline item (added|saved)/i).first()).toBeVisible({ timeout: 10_000 }).catch(() => {});

  // ── 3. Server-side verification: stored ON the wedding date ──────────
  const list = await (await request.get(`/api/events/${eventId}/timeline`, { headers: { authorization: `Bearer ${token}` } })).json();
  const items = (list as any).items ?? (list as any).schedule ?? [];
  const ceremony = items.find((i: any) => i.title === 'Ceremony');
  expect(ceremony, 'created item must exist').toBeTruthy();
  expect(String(ceremony.starts_at).startsWith(weddingDate), `starts_at ${ceremony.starts_at} must be on ${weddingDate}`).toBeTruthy();
  expect(String(ceremony.starts_at)).toContain('16:30');
});
