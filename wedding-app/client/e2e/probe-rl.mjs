import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const base = 'http://localhost:3000';
const issues = [];
page.on('console', m => { if (m.type() === 'error') issues.push('[console] ' + m.text().slice(0, 200)); });
// demo event portal (generic, no token)
await page.goto(`${base}/#/portal/685f1b91-6f67-4cdb-b71c-c5dee0dbc918`);
await page.waitForTimeout(3000);
// Request secure link 6 times
for (let i = 0; i < 6; i++) {
  await page.getByRole('button', { name: 'Request secure link' }).click();
  await page.waitForTimeout(400);
  const dialog = page.getByRole('dialog', { name: /request your secure rsvp link/i });
  if (await dialog.count()) {
    await dialog.getByLabel('Email address').fill(`rl-${i}@example.com`);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(700);
  }
  // capture any toast/message on screen
  const msgs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="status"], [role="alert"]')).map(el => (el.textContent||'').trim().slice(0, 120));
  });
  console.log(`iter ${i}:`, JSON.stringify(msgs.slice(0, 3)));
}
console.log('ISSUES:', JSON.stringify(issues, null, 1));
await browser.close();
