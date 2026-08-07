import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const base = 'http://localhost:3000';
const owner = await (await fetch(base + '/api/auth/login', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email:'owner@demo.local', password:'wedding123' }) })).json();
const token = owner.token;
const orgs = await (await fetch(base + '/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json();
const orgId = orgs.organizations[0].id;
const evs = await (await fetch(base + `/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${token}` } })).json();
const demo = (evs.events||evs).find(e=>e.title.includes('Smith & Jones'));
const stamp = Date.now();
const g = await (await fetch(base + `/api/events/${demo.id}/couple-guests`, { method:'POST', headers:{ authorization:`Bearer ${token}`, 'content-type':'application/json'}, body: JSON.stringify({ fullName: `Dom Guest ${stamp}`, email:`dom-${stamp}@example.com`, rsvpStatus:'pending' }) })).json();
const guestId = g.guest.id;
const link = await (await fetch(base + `/api/events/${demo.id}/couple-guests/${guestId}/portal-link`, { method:'POST', headers:{ authorization:`Bearer ${token}` } })).json();
await page.goto(`${base}/#/portal/${demo.id}?guest=${guestId}&token=${link.token}`);
await page.waitForTimeout(3000);
// 1. check horizontal overflow (mobile-style bug indicator)
const overflow = await page.evaluate(() => {
  const doc = document.documentElement;
  return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, overflowX: doc.scrollWidth > doc.clientWidth };
});
console.log('OVERFLOW:', JSON.stringify(overflow));
// 2. find any elements that stick out beyond viewport
const stuck = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('*').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > window.innerWidth + 2 || r.left < -2)) {
      const cls = (el.className && el.className.toString ? el.className.toString() : '').slice(0, 60);
      if (out.length < 12) out.push({ tag: el.tagName, cls, left: Math.round(r.left), right: Math.round(r.right), w: Math.round(r.width), text: (el.textContent||'').slice(0,40) });
    }
  });
  return out;
});
console.log('STUCK ELEMENTS:', JSON.stringify(stuck, null, 1));
// 3. dump headings structure
const heads = await page.evaluate(() => Array.from(document.querySelectorAll('h1,h2,h3')).map(h => ({ lvl: h.tagName, txt: (h.textContent||'').trim().slice(0,60) })));
console.log('HEADINGS:', JSON.stringify(heads, null, 1));
// 4. dump all buttons
const btns = await page.evaluate(() => Array.from(document.querySelectorAll('button')).map(b => ({ txt: (b.textContent||'').trim().slice(0,40), aria: b.getAttribute('aria-label') || '' })).slice(0, 30));
console.log('BUTTONS:', JSON.stringify(btns, null, 1));
await browser.close();
