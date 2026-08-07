import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const base = 'http://localhost:3000';
const issues = [];
page.on('console', m => { if (m.type() === 'error') issues.push('[console] ' + m.text().slice(0, 200)); });
page.on('response', r => { if (r.status() >= 400) issues.push(`[http ${r.status()}] ${r.url().slice(0,120)}`); });
// fresh couple
const email = `probe-couple-${Date.now()}@example.com`;
await fetch(base + '/api/auth/register', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email, password:'testpass123', fullName:'Probe Couple', orgName:'Tmp' }) });
const owner = await (await fetch(base + '/api/auth/login', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email:'owner@demo.local', password:'wedding123' }) })).json();
const orgs = await (await fetch(base + '/api/orgs', { headers: { authorization: `Bearer ${owner.token}` } })).json();
const orgId = orgs.organizations[0].id;
const evs = await (await fetch(base + `/api/orgs/${orgId}/events`, { headers: { authorization: `Bearer ${owner.token}` } })).json();
const demo = (evs.events||evs).find(e=>e.title.includes('Smith & Jones'));
await fetch(base + `/api/events/${demo.id}/couple-invitations`, { method:'POST', headers:{ authorization:`Bearer ${owner.token}`, 'content-type':'application/json'}, body: JSON.stringify({ email, roleKey:'couple' }) });
const cl = await (await fetch(base + '/api/auth/login', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email, password:'testpass123' }) })).json();
const cOrgs = await (await fetch(base + '/api/orgs', { headers: { authorization: `Bearer ${cl.token}` } })).json();
await fetch(base + '/api/users/me/preferences', { method:'PUT', headers:{ authorization:`Bearer ${cl.token}`, 'content-type':'application/json'}, body: JSON.stringify({ onboarding: { welcomeTourByOrg: { [cOrgs.organizations[0].id]: { status:'completed', currentSlide:0, completedSlides:[], completedAt:new Date().toISOString() } } } }) });
await page.goto(base + '/login');
await page.getByLabel(/email/i).fill(email);
await page.locator('#pw').fill('testpass123');
await page.getByRole('button', { name: 'Sign in securely' }).click();
await page.waitForTimeout(5000);
// dump body text to look for anomalies (placeholder leaks, raw JSON, etc.)
const bodyText = await page.evaluate(() => document.body.innerText);
const anomalies = [];
for (const line of bodyText.split('\n')) {
  const t = line.trim();
  if (!t) continue;
  if (t.startsWith('{') || t.startsWith('[') || t.includes('null') || t.includes('undefined') || t.includes('NaN')) {
    anomalies.push(t.slice(0, 100));
  }
}
console.log('ANOMALIES:', JSON.stringify(anomalies.slice(0, 10), null, 1));
console.log('ISSUES:', JSON.stringify(issues.slice(0, 10), null, 1));
console.log('BODY LEN:', bodyText.length);
// count headings
const heads = await page.evaluate(() => Array.from(document.querySelectorAll('h1,h2,h3')).map(h => (h.textContent||'').trim().slice(0,70)));
console.log('HEADINGS:', JSON.stringify(heads, null, 1));
await browser.close();
