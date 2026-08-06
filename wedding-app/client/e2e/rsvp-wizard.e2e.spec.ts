import { test, expect } from '@playwright/test';

/**
 * Guest RSVP wizard end-to-end.
 *
 * The full guest journey: a fresh guest is added to the event, the couple
 * generates their secure portal link, and the guest opens the public portal
 * with it, walks the RSVP wizard (identify → attendance → party → meal →
 * review), submits, and the server records the submission + updates the
 * guest's RSVP status. The wizard is the portal's highest-value surface —
 * every wedding guest interacts with it exactly once per event.
 */
test.use({ viewport: { width: 1440, height: 1400 } });

test('guest submits an RSVP through the wizard with their secure link', async ({ page, request }) => {
  // ── 0. API setup: owner + fresh guest + portal link ──────────────────
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
  const guestName = `RSVP Guest ${stamp}`;
  const guestEmail = `rsvp-${stamp}@example.com`;
  const created = await request.post(`/api/events/${eventId}/couple-guests`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { fullName: guestName, email: guestEmail, rsvpStatus: 'pending' },
  });
  expect(created.status()).toBe(201);
  const guestId = (await created.json()).guest.id as string;

  const linkRes = await request.post(`/api/events/${eventId}/couple-guests/${guestId}/portal-link`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(linkRes.status()).toBe(200);
  const { token: guestToken } = (await linkRes.json()) as { token: string };

  // ── 1. Guest opens the public portal with their secure link ──────────
  await page.goto(`/#/portal/${eventId}?guest=${guestId}&token=${guestToken}`);
  await expect(page.locator('h1')).toBeVisible({ timeout: 20_000 });
  // The token identifies the guest: the home tab shows their personalized
  // itinerary line.
  await expect(page.getByText(new RegExp(`RSVP as ${guestName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))).toBeVisible({ timeout: 15_000 });

  // ── 2. Open the RSVP wizard ──────────────────────────────────────────
  await page.getByRole('button', { name: 'Open RSVP' }).click();
  const form = page.getByRole('form', { name: 'RSVP form' });
  await expect(form).toBeVisible({ timeout: 15_000 });

  // Step: identify — the guest is preselected from the link, and the
  // wizard confirms the token is verified.
  await expect(form.getByLabel('Your Name', { exact: true })).toHaveValue(guestId, { timeout: 10_000 });
  await expect(form.getByText('Secure invitation link verified for RSVP editing.')).toBeVisible();
  await form.getByRole('button', { name: 'Continue' }).click();

  // Step: attendance.
  await form.getByRole('button', { name: 'Joyfully accept' }).click();
  await form.getByRole('button', { name: 'Continue' }).click();

  // Step: party — leave plus-one/children blank.
  await form.getByRole('button', { name: 'Continue' }).click();

  // Step: meal — keep defaults, note a dietary restriction.
  await form.getByPlaceholder(/dietary restrictions/i).fill('Vegetarian');
  await form.getByRole('button', { name: 'Continue' }).click();

  // Step: review — privacy acknowledgement is required.
  await form.getByRole('button', { name: 'Submit RSVP' }).click();
  await expect(form.getByText(/review and acknowledge the guest privacy notice/i)).toBeVisible({ timeout: 10_000 });

  await form.getByText(/i understand who can see my rsvp/i).click();
  await form.getByRole('button', { name: 'Submit RSVP' }).click();

  // ── 3. Confirmation receipt ──────────────────────────────────────────
  await expect(page.getByText(guestName).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Response: attending')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Dietary: Vegetarian')).toBeVisible({ timeout: 10_000 });

  // ── 4. Server-side verification ──────────────────────────────────────
  const guestsRes = await request.get(`/api/events/${eventId}/couple-guests`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const { guests } = (await guestsRes.json()) as { guests: Array<any> };
  const updated = guests.find((g: any) => g.id === guestId);
  expect(updated).toBeTruthy();
  expect(updated.rsvpStatus, 'guest RSVP status must be attending').toBe('attending');

  // The full submission (meal, dietary notes, submitted_at) is recorded in
  // rsvp_submissions — exposed per-guest in the catering dietary export.
  const csvRes = await request.get(`/api/events/${eventId}/catering-dietary-export.csv`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(csvRes.status()).toBe(200);
  const csv = await csvRes.text();
  const lines = csv.split(/\r?\n/);
  const header = lines[0].split(',').map((h) => h.replace(/^"|"$/g, ''));
  const nameIdx = header.indexOf('Guest');
  const dietaryIdx = header.indexOf('Allergies / dietary notes');
  const submittedIdx = header.indexOf('Submitted at');
  const unquote = (s: string) => s.replace(/^"|"$/g, '');
  const row = lines.slice(1).map((l) => l.split(',').map(unquote)).find((cells) => cells[nameIdx] === guestName);
  expect(row, 'guest must appear in the catering export').toBeTruthy();
  expect(row![dietaryIdx]).toContain('Vegetarian');
  expect(row![submittedIdx]).toBeTruthy();

  // ── 5. EDIT: the guest changes their RSVP (latest submission wins) ──
  // Reopen the portal with the same link and submit a decline.
  await page.goto(`/#/portal/${eventId}?guest=${guestId}&token=${guestToken}`);
  await expect(page.locator('h1')).toBeVisible({ timeout: 20_000 });
  // Returning guest: the home tab shows their saved RSVP with an
  // "Edit response" button.
  await expect(page.getByText('Response: attending').first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /edit response/i }).click();
  const form2 = page.getByRole('form', { name: 'RSVP form' });
  await expect(form2).toBeVisible({ timeout: 15_000 });
  await expect(form2.getByLabel('Your Name', { exact: true })).toHaveValue(guestId, { timeout: 10_000 });
  await form2.getByRole('button', { name: 'Continue' }).click();          // → party
  await form2.getByRole('button', { name: 'Regretfully decline' }).click();
  await form2.getByPlaceholder(/optional private note for the couple/i).fill('Date conflict, sorry!');
  // Programmatic element clicks: a coordinate click on the footer's
  // Continue button can land on the re-rendered Submit RSVP button (same
  // position) and submit the form in the same interaction. element.click()
  // dispatches on the Continue node only — deterministic.
  await form2.getByRole('button', { name: 'Continue' }).evaluate((el) => (el as HTMLButtonElement).click()); // → party
  await expect(form2.getByText('Plus-one', { exact: true })).toBeVisible({ timeout: 10_000 });
  await form2.getByRole('button', { name: 'Continue' }).evaluate((el) => (el as HTMLButtonElement).click()); // → meal
  await expect(form2.getByText('Meal choice', { exact: true })).toBeVisible({ timeout: 10_000 });
  await form2.getByRole('button', { name: 'Continue' }).evaluate((el) => (el as HTMLButtonElement).click()); // → review
  const submitBtn = form2.getByRole('button', { name: 'Submit RSVP' });
  await expect(submitBtn).toBeVisible({ timeout: 10_000 });
  const privacy = form2.locator('input[type="checkbox"]').first();
  if (!(await privacy.isChecked().catch(() => true))) {
    await privacy.evaluate((el) => ((el as HTMLInputElement).checked = true) && el.dispatchEvent(new Event('change', { bubbles: true })));
  }
  await submitBtn.evaluate((el) => (el as HTMLButtonElement).click());
  await expect(page.getByText('Response: declined').first()).toBeVisible({ timeout: 15_000 });

  // Server: the guest is now declined; the decline note was recorded.
  const afterEdit = (await (await request.get(`/api/events/${eventId}/couple-guests`, {
    headers: { authorization: `Bearer ${token}` },
  })).json()) as { guests: Array<any> };
  const edited = afterEdit.guests.find((g: any) => g.id === guestId);
  expect(edited.rsvpStatus, 'latest submission must win').toBe('declined');
});
