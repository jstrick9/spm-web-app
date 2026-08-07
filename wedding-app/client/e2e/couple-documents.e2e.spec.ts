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
 * Self-cleaning: this spec's earlier runs leave sample-prefixed and
 * toggle-prefixed docs in the demo event forever. Without cleanup the fresh
 * upload can land beyond the hub's 8-card grid cap (docs sort newest-first)
 * and the test's "New version" card never renders. Delete this spec's own
 * leftovers before each test.
 */
async function cleanupLeftoverSpecDocs(request: import('@playwright/test').APIRequestContext, token: string, eventId: string): Promise<void> {
  const res = await request.get(`/api/events/${eventId}/couple-documents`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.status() !== 200) return;
  const { documents } = (await res.json()) as { documents: Array<any> };
  for (const doc of documents) {
    if (/^(sample-|toggle-)/.test(doc.filename)) {
      await request.delete(`/api/events/${eventId}/couple-documents/${doc.id}`, {
        headers: { authorization: `Bearer ${token}` },
      });
    }
  }
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
  await cleanupLeftoverSpecDocs(request, token, eventId);

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

  // ── 2. Upload a sample document (run-unique filename — prior runs leave
  // same-named docs behind, and .find/.first would hit stale rows) ──
  const docHub = page.locator('#couple-documents');
  const sampleDocName = `sample-doc-${Date.now()}.pdf`;
  await clickSafely(docHub.getByRole('button', { name: 'Use sample file' }));
  await fillInput(docHub.getByPlaceholder('Filename'), sampleDocName);
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
  const uploaded = documents.find((d: any) => d.filename === sampleDocName);
  expect(uploaded, 'sample document must be recorded server-side').toBeTruthy();
  expect(uploaded.category).toBe('menu'); // default draft category
  expect(uploaded.visibility).toBe('couple_venue');
  expect(uploaded.uploadedByRole || uploaded.createdByRole || 'couple').toBeTruthy();
  const versionBefore = uploaded.version ?? 1;

  // ── 3b. Upload a NEW VERSION from the document card (was UI-impossible:
  // versions were displayed as v{n} but never creatable) ──
  const versionName = `sample-document-v2-${Date.now()}.pdf`;
  const versionInput = docHub.locator(`input[aria-label="Choose a new version of ${sampleDocName}"]`).first();
  await versionInput.setInputFiles({
    name: versionName,
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
  expect(versioned.filename).toBe(versionName);
  expect((versioned.version ?? 1)).toBeGreaterThan(versionBefore);

  // ── 3c. Edit document metadata — category/visibility were set once at
  // upload and could never be corrected (regression: PATCH was UI-less) ──
  await clickSafely(docHub.getByRole('button', { name: `Edit details of ${versionName}` }).first());
  await docHub.getByLabel('Document category').selectOption('contract');
  await clickSafely(docHub.getByRole('button', { name: 'Save changes' }));
  await expect(page.getByText('Document details updated').first()).toBeVisible({ timeout: 15_000 });

  const docsRes3 = await request.get(`/api/events/${eventId}/couple-documents`, {
    headers: { authorization: `Bearer ${coupleToken}` },
  });
  const { documents: documents3 } = (await docsRes3.json()) as { documents: Array<any> };
  const edited = documents3.find((d: any) => d.id === uploaded.id);
  expect(edited.category, 'category edit must persist server-side').toBe('contract');

  // venue sees the shared document too
  const venueDocs = await request.get(`/api/events/${eventId}/couple-documents`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(venueDocs.status()).toBe(200);
  const { documents: venueDocuments } = (await venueDocs.json()) as { documents: Array<any> };
  expect(venueDocuments.find((d: any) => d.id === uploaded.id), 'venue must see the shared document').toBeTruthy();

  // audit trail: couple uploaded a document
  const auditRes = await request.get('/api/audit?limit=50', { headers: { authorization: `Bearer ${token}` } });
  if (auditRes.status() === 200) {
    const { entries } = (await auditRes.json()) as { entries: Array<any> };
    const entry = entries.find((e: any) => e.action === 'couple.document.upload' || e.action === 'document.upload');
    expect(entry, 'audit must record the couple document upload').toBeTruthy();
  }
});

/**
 * Regression: the hub hard-capped the document grid at 8 with no way to see
 * the rest — a couple with more files silently lost access to older ones.
 * The toggle reveals everything.
 */
test('couple hub shows all documents beyond the 8-card cap via Show all / Show fewer', async ({ page, request }) => {
  test.setTimeout(90_000); // staggered seeding of 10 docs takes ~11s
  // ── API setup: fresh couple + membership (same pattern as above) ──
  const coupleEmail = `couple-toggle-${Date.now()}@example.com`;
  const reg = await request.post('/api/auth/register', {
    data: { email: coupleEmail, password: 'testpass123', fullName: 'Casey Couple', orgName: 'Tmp' },
  });
  expect(reg.ok()).toBeTruthy();

  const login = await request.post('/api/auth/login', { data: { email: 'owner@demo.local', password: 'wedding123' } });
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;
  const events = (await (await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events;
  const event = events.find((e: any) => e.title === 'Smith & Jones Wedding') ?? events[0];
  const eventId = event.id as string;
  await cleanupLeftoverSpecDocs(request, token, eventId);

  await request.post(`/api/events/${eventId}/couple-invitations`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { email: coupleEmail, roleKey: 'couple' },
  });

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

  // ── seed 10 documents via API (all 'menu' category, newest first in UI) ──
  // created_at has 1-second precision, so stagger uploads >1s apart to make
  // the ORDER BY category, created_at DESC ordering deterministic.
  for (let i = 0; i < 10; i += 1) {
    const upload = await request.post(`/api/events/${eventId}/couple-documents`, {
      headers: { authorization: `Bearer ${coupleToken}`, 'content-type': 'application/json' },
      data: {
        filename: `toggle-doc-${i}.pdf`,
        dataUri: `data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEwIDAgb2JqCjw8L0xlbmd0aCAxMT4+CnN0cmVhbQpCRFIKc3RhcnR4cmVmCjExCiUlRU9GCg==`,
        mimeType: 'application/pdf',
        category: 'menu',
        visibility: 'couple_venue',
      },
    });
    expect(upload.status(), `seed upload ${i} must succeed`).toBe(201);
    if (i < 9) await new Promise((r) => setTimeout(r, 1100));
  }

  // ── couple opens the hub ──
  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill(coupleEmail);
  await page.getByLabel(/^password$/i).fill('testpass123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/your wedding hub/i, { timeout: 20_000 });

  const docHub = page.locator('#couple-documents');
  // newest-first ordering: toggle-doc-9 … toggle-doc-0; the 8-cap hides the last 2
  await expect(docHub.getByText('toggle-doc-9.pdf')).toBeVisible({ timeout: 20_000 });
  await expect(docHub.getByText('toggle-doc-1.pdf')).not.toBeVisible();

  const showAll = docHub.getByRole('button', { name: /show all \d+ documents/i });
  await expect(showAll).toBeVisible();
  await clickSafely(showAll);

  await expect(docHub.getByText('toggle-doc-1.pdf')).toBeVisible();
  await expect(docHub.getByText('toggle-doc-0.pdf')).toBeVisible();

  const showFewer = docHub.getByRole('button', { name: 'Show fewer' });
  await clickSafely(showFewer);
  await expect(docHub.getByText('toggle-doc-1.pdf')).not.toBeVisible();
});
