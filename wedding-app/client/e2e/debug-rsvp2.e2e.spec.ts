import { test, expect } from '@playwright/test';

test('debug rsvp edit remount', async ({ page, request }) => {
  const login = await request.post('/api/auth/login', { data: { email: 'owner@demo.local', password: 'wedding123' } });
  const { token } = await login.json();
  const orgId = (await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json()).organizations[0].id;
  const events = (await (await request.get(`/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json()).events;
  const event = events.find((e: any) => e.title === 'Smith & Jones Wedding') ?? events[0];
  const eventId = event.id as string;
  const created = await request.post(`/api/events/${eventId}/couple-guests`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { fullName: `Dbg2 ${Date.now()}`, email: `dbg2-${Date.now()}@example.com`, rsvpStatus: 'pending' },
  });
  const guestId = (await created.json()).guest.id as string;
  const linkRes = await request.post(`/api/events/${eventId}/couple-guests/${guestId}/portal-link`, { headers: { authorization: `Bearer ${token}` } });
  const { token: guestToken } = (await linkRes.json()) as { token: string };

  await page.goto(`/#/portal/${eventId}?guest=${guestId}&token=${guestToken}`);
  await page.locator('h1').waitFor({ state: 'visible', timeout: 20000 });
  await page.getByRole('button', { name: 'Open RSVP' }).click();
  const form = page.getByRole('form', { name: 'RSVP form' });
  const clickEl = (loc: import('@playwright/test').Locator) => loc.evaluate((el) => (el as HTMLButtonElement).click());
  for (let i = 0; i < 4; i++) { await clickEl(form.getByRole('button', { name: 'Continue' })); }
  await form.getByText(/i understand who can see my rsvp/i).click();
  await clickEl(form.getByRole('button', { name: 'Submit RSVP' }));
  await expect(page.getByText('RSVP saved').first()).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: /edit response/i }).click();
  await clickEl(form.getByRole('button', { name: 'Continue' }));
  await form.getByRole('button', { name: 'Regretfully decline' }).click();
  await clickEl(form.getByRole('button', { name: 'Continue' }));
  await clickEl(form.getByRole('button', { name: 'Continue' }));
  await clickEl(form.getByRole('button', { name: 'Continue' }));
  await expect(form.getByRole('button', { name: 'Submit RSVP' })).toBeVisible({ timeout: 10000 });

  // Observe what replaces the review section
  const obs = await page.evaluate(() => {
    const out: string[] = [];
    const section = Array.from(document.querySelectorAll('section')).find((s) => s.textContent?.includes('Review before submitting'));
    if (!section) return Promise.resolve(['no section']);
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of Array.from(m.removedNodes)) {
          if (n === section || n.contains(section)) {
            out.push('SECTION REMOVED at ' + Date.now());
          }
        }
        for (const n of Array.from(m.addedNodes)) {
          if (n.nodeType === 1 && (n as HTMLElement).textContent?.includes('Review before submitting')) {
            out.push('NEW SECTION ADDED, parent=' + (n as HTMLElement).parentElement?.className?.toString().slice(0, 60));
          }
        }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return new Promise<string[]>((resolve) => {
      setTimeout(() => { mo.disconnect(); resolve(out); }, 2500);
    });
  });
  console.log('OBS2:', JSON.stringify(obs));
});
