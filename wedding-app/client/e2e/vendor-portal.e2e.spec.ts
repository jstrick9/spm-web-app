import { test, expect } from '@playwright/test';

/**
 * Vendor portal end-to-end (real browser, production build).
 *
 * Covers the full vendor onboarding loop the API tests can't:
 *   1. venue issues a portal token for a seeded vendor (API setup)
 *   2. vendor opens their secure portal link
 *   3. vendor fills + submits the Logistics Questionnaire
 *   4. vendor uploads a real COI PDF (magic-byte validated by the server)
 *   5. vendor sends a chat message to the venue ("Direct Coordinator Live Chat")
 *   6. venue-side verification: questionnaire + COI review state + the
 *      vendor's chat message visible in the shared thread
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('vendor completes questionnaire, uploads COI, and chats with the venue', async ({ page, request }) => {
  // ── 0. API setup: login as the seeded owner, find a vendor, issue token ──
  const login = await request.post('/api/auth/login', {
    data: { email: 'owner@demo.local', password: 'wedding123' },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();

  // Deterministic tour state: complete the owner's onboarding tour via API
  // so a previously-interrupted run can never leave the modal open.
  const tourLogin = await request.post('/api/auth/login', { data: { email: 'owner@demo.local', password: 'wedding123' } });
  if (tourLogin.ok()) {
    const tourToken = (await tourLogin.json()).token;
    const orgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${tourToken}` } })).json();
    const tourOrgId = orgs.organizations[0].id;
    await request.put('/api/users/me/preferences', {
      headers: { authorization: `Bearer ${tourToken}`, 'content-type': 'application/json' },
      data: {
        onboarding: {
          welcomeTourByOrg: {
            [tourOrgId]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() },
          },
        },
      },
    });
  }

  const orgsRes = await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } });
  const orgId = (await orgsRes.json()).organizations[0].id as string;

  // Create a FRESH vendor each run so the spec is idempotent (a repeated
  // run must not find the questionnaire already submitted).
  const eventsRes = await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } });
  const events = (await eventsRes.json()).events as Array<any>;
  const event = events.find((e: any) => e.title === 'Smith & Jones Wedding') ?? events[0];
  const eventId = event.id as string;

  const vendorRes = await request.post(`/api/orgs/${orgId}/vendors`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { name: `E2E Vendor ${Date.now()}`, category: 'DJ / Music', eventId, email: `e2e-${Date.now()}@vendor.test`, contactPreference: 'email' },
  });
  expect(vendorRes.status()).toBe(201);
  const vendor = (await vendorRes.json()).vendor;
  const vendorId = vendor.id as string;

  const tokRes = await request.post(`/api/vendors/${vendorId}/portal-token`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { expiresInDays: 30 },
  });
  expect(tokRes.status()).toBe(201);
  const vToken = (await tokRes.json()).token as string;

  // ── 1. Vendor opens their secure portal ──────────────────────────────
  await page.goto(`/#/vendor/${vendorId}?token=${encodeURIComponent(vToken)}`);
  await expect(page.getByText('Logistics Questionnaire')).toBeVisible({ timeout: 20_000 });

  // ── 2. Fill + submit the questionnaire ───────────────────────────────
  await page.locator('#arr').fill('10:00');
  await page.locator('#dep').fill('18:00');
  await page.locator('#team').fill('4');
  await page.locator('#coiExpiration').fill('2027-01-01');
  await page.getByRole('button', { name: /submit logistics/i }).click();
  await expect(page.getByText('Logistics details submitted successfully').first()).toBeVisible({ timeout: 15_000 });
  // Submitted state is persisted server-side and reflected on reload.
  await expect(page.getByText('Submitted', { exact: true })).toBeVisible({ timeout: 10_000 });

  // ── 3. Upload a COI PDF (real file through the browser) ─────────────
  const fileInput = page.locator('#logistics-card input[type="file"]');
  await fileInput.setInputFiles('e2e/fixtures/vendor-coi.pdf');
  await expect(page.getByText('Certificate of Insurance uploaded for review').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Pending venue review')).toBeVisible({ timeout: 10_000 });

  // ── 4. Send a chat message to the venue ──────────────────────────────
  const chatInput = page.getByPlaceholder('Type message to venue crew...');
  await expect(chatInput).toBeVisible({ timeout: 15_000 });
  await chatInput.fill('Load-in confirmed for 10:00 at dock B.');
  await page.getByRole('button', { name: /send/i }).click();
  await expect(page.getByText('Load-in confirmed for 10:00 at dock B.')).toBeVisible({ timeout: 15_000 });

  // ── 5. Venue-side verification (API): questionnaire + COI + thread ───
  const vendorAfter = await request.get(`/api/orgs/${orgId}/vendors?eventId=${eventId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const vendorRow = (await vendorAfter.json()).vendors.find((v: any) => v.id === vendorId) as any;
  const meta = JSON.parse(vendorRow.metadata || '{}');
  expect(meta.questionnaire?.teamSize).toBe('4');
  expect(meta.questionnaire?.arrivalTime).toBe('10:00');
  expect(meta.questionnaire?.submittedAt).toBeTruthy();
  expect(meta.coiReceived).toBe(true);
  expect(meta.coiVerificationStatus).toBe('pending_review');
  expect(meta.coiFileName).toBe('vendor-coi.pdf');

  // The vendor's chat message lives in the SAME thread the venue reads.
  const threadRes = await request.get(`/api/messages/${encodeURIComponent(`${eventId}:vendor-${vendorId}`)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const thread = (await threadRes.json()).messages as Array<any>;
  const vendorMsg = thread.find((m: any) => m.body === 'Load-in confirmed for 10:00 at dock B.');
  expect(vendorMsg).toBeTruthy();
  expect(vendorMsg.sender_role).toBe('vendor');
});
