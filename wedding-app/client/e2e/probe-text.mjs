import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const base = 'http://localhost:3000';
// collect console errors + weird text
const issues = [];
page.on('console', m => { if (m.type() === 'error') issues.push('[console] ' + m.text().slice(0, 200)); });
await page.goto(base + '/login');
await page.getByLabel(/email/i).fill('owner@demo.local');
await page.locator('#pw').fill('wedding123');
await page.getByRole('button', { name: 'Sign in securely' }).click();
await page.waitForTimeout(3500);
// regex for double spaces, odd grammar artifacts, placeholder text leaks
const weird = await page.evaluate(() => {
  const found = [];
  const re = /[a-z] {2,}[a-z]/g;
  const walk = (el) => {
    if (el.nodeType === 3) {
      const t = el.textContent || '';
      if (t.trim().length > 3 && re.test(t)) found.push(t.trim().slice(0, 80));
      return;
    }
    if (el.nodeType === 1 && !['SCRIPT','STYLE','NOSCRIPT'].includes(el.tagName)) {
      for (const c of el.childNodes) walk(c);
    }
  };
  walk(document.body);
  return [...new Set(found)].slice(0, 15);
});
console.log('DOUBLE-SPACE TEXT:', JSON.stringify(weird, null, 1));
console.log('CONSOLE ERRORS:', JSON.stringify(issues, null, 1));
await browser.close();
