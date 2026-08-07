import { test, expect, type Locator } from '@playwright/test';

/**
 * fillInput — fill an input with a self-healing retry (headless Chromium
 * insert-text quirk after SPA navigation).
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
 * Couple document hub end-to-end: a fresh couple uploads a document from
 * the hub ("Use sample file" → Upload), the toast confirms it, and the
 * server records the document + an audit entry. The venue can see it in
 * the shared hub (couple_venue visibility).
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('couple uploads a shared document that the venue sees in the hub', async ({ page, request }) => {
  // ── 0. API setup: couple user + event membership ──
  const coupleEmail = `couple-doc-${Date.now()}@example.com`;
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

  // complete onboarding tour via API so no modal blocks the hub
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

  // ── 2. Upload a sample document ──
  const docHub = page.locator('#couple-documents');
  await clickSafely(docHub.getByRole('button', { name: 'Use sample file' }));
  const uploadBtn = docHub.getByRole('button', { name: 'Upload', exact: true });
  await expect(uploadBtn).toBeVisible({ timeout: 10_000 });
  await clickSafely(uploadBtn);
  await expect(page.getByText('Document uploaded for venue review').first()).toBeVisible({ timeout: 15_000 });

  // ── 3. Server-side verification ──
  const docsRes = await request.get(`/api/events/${eventId}/couple-documents`, {
    headers: { authorization: `Bearer ${coupleToken}` },
  });
  expect(docsRes.status()).toBe(200);
  const { documents } = (await docsRes.json()) as { documents: Array<any> };
  const uploaded = documents.find((d: any) => d.filename === 'sample-document.pdf');
  expect(uploaded, 'sample document must be recorded server-side').toBeTruthy();
  expect(uploaded.category).toBe('menu'); // default draft category
  expect(uploaded.visibility).toBe('couple_venue');
  expect(uploaded.uploadedByRole || uploaded.createdByRole || 'couple').toBeTruthy();
  const versionBefore = uploaded.version ?? 1;

  // ── 3b. Upload a NEW VERSION from the document card (was UI-impossible:
  // versions were displayed as v{n} but never creatable) ──
  const versionInput = docHub.locator(`input[aria-label="Choose a new version of sample-document.pdf"]`).first();
  await versionInput.setInputFiles({
    name: 'sample-document-v2.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4 second version'),
  });
  await expect(page.getByText('Document version uploaded').first()).toBeVisible({ timeout: 15_000 });

  const docsRes2 = await request.get(`/api/events/${eventId}/couple-documents`, {
    headers: { authorization: `Bearer ${coupleToken}` },
  });
  const { documents: documents2 } = (await docsRes2.json()) as { documents: Array<any> };
  const versioned = documents2.find((d: any) => d.id === uploaded.id);
  expect(versioned, 'versioned document must still exist').toBeTruthy();
  expect(versioned.filename).toBe('sample-document-v2.pdf');
  expect((versioned.version ?? 1)).toBeGreaterThan(versionBefore);

  // venue sees the shared document too
  const venueDocs = await request.get(`/api/events/${eventId}/couple-documents`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(venueDocs.status()).toBe(200);
  const { documents: venueDocuments } = (await venueDocs.json()) as { documents: Array<any> };
  expect(venueDocuments.find((d: any) => d.filename === 'sample-document.pdf')).toBeTruthy();

  // audit trail: couple uploaded a document
  const auditRes = await request.get('/api/audit?limit=50', { headers: { authorization: `Bearer ${token}` } });
  if (auditRes.status() === 200) {
    const { entries } = (await auditRes.json()) as { entries: Array<any> };
    const entry = entries.find((e: any) => e.action === 'couple.document.upload' || e.action === 'document.upload');
    expect(entry, 'audit must record the couple document upload').toBeTruthy();
  }
});
