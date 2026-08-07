import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const base = 'http://localhost:3000';
const issues = [];
page.on('console', m => { if (m.type() === 'error') issues.push('[console] ' + m.text().slice(0, 200)); });
page.on('response', r => { if (r.status() >= 400) issues.push(`[http ${r.status()}] ${r.url().slice(0,120)}`); });
await page.goto(base + '/login');
await page.getByLabel(/email/i).fill('owner@demo.local');
await page.locator('#pw').fill('wedding123');
await page.getByRole('button', { name: 'Sign in securely' }).click();
await page.waitForTimeout(3500);
for (const path of ['/#/system/venue', '/#/system/catalog', '/#/system/inventory', '/#/system/questions', '/#/system/audit', '/#/system/email-automations', '/#/system/platform', '/#/intelligence']) {
  const before = issues.length;
  await page.goto(base + path);
  await page.waitForTimeout(2200);
  const bodyText = await page.evaluate(() => document.body.innerText);
  const anomalies = [];
  for (const line of bodyText.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('{') || t.startsWith('[') || t.includes('null') || t.includes('undefined') || t.includes('NaN')) anomalies.push(t.slice(0, 80));
  }
  console.log(`=== ${path} | issues: ${issues.length - before} | anomalies: ${JSON.stringify(anomalies.slice(0,4))}`);
}
console.log('TOTAL ISSUES:', JSON.stringify(issues.slice(0, 12), null, 1));
await browser.close();
