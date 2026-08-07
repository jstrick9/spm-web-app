import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const base = 'http://localhost:3000';
// owner token
const owner = await (await fetch(base + '/api/auth/login', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email:'owner@demo.local', password:'wedding123' }) })).json();
const token = owner.token;
const orgs = await (await fetch(base + '/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json();
const orgId = orgs.organizations[0].id;
const evs = await (await fetch(base + `/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json();
const demo = (evs.events||evs).find(e=>e.title.includes('Smith & Jones'));
// create guest + link
const stamp = Date.now();
const g = await (await fetch(base + `/api/events/${demo.id}/couple-guests`, { method:'POST', headers:{ authorization:`Bearer ${token}`, 'content-type':'application/json'}, body: JSON.stringify({ fullName: `Visual Guest ${stamp}`, email:`vis-${stamp}@example.com`, rsvpStatus:'pending' }) })).json();
const guestId = g.guest.id;
const link = await (await fetch(base + `/api/events/${demo.id}/couple-guests/${guestId}/portal-link`, { method:'POST', headers:{ authorization:`Bearer ${token}` } })).json();
// portal home
await page.goto(`${base}/#/portal/${demo.id}?guest=${guestId}&token=${link.token}`);
await page.waitForTimeout(3000);
await page.screenshot({ path: '/home/user/shots/portal-home.png', fullPage: true });
// RSVP wizard step 1
await page.getByRole('button', { name: 'Open RSVP' }).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: '/home/user/shots/rsvp-identify.png', fullPage: false });
await browser.close();
console.log('done');
