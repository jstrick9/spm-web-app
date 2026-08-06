import { test, expect } from '@playwright/test';

/**
 * Self-hosted fonts + CSP-clean theme init end-to-end.
 *
 * The server CSP (style-src 'self', script-src 'self') used to block the
 * Google Fonts stylesheet (brand typography silently fell back to system
 * fonts) and the inline theme pre-paint script (dark-mode users got a
 * light->dark flash). This spec locks in the fix:
 *   1. no CSP violation console errors on load,
 *   2. the brand fonts actually load (document.fonts.check resolves them),
 *   3. computed font-family on a display heading uses Fraunces,
 *   4. theme-init.js applies the dark class before the app paints.
 */
test('brand fonts load and theme init runs (CSP-clean)', async ({ page, request }) => {
  const cspErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && /content security policy/i.test(m.text())) cspErrors.push(m.text().slice(0, 160));
  });

  // Dark preference + theme token, so theme-init has something to apply.
  await page.addInitScript(() => {
    localStorage.setItem('wedding.theme', 'dark');
  });

  await page.goto('/#/');
  await expect(page.locator('body')).toBeVisible();

  // 4. Dark class applied pre-paint by theme-init.js.
  await expect(page.locator('html')).toHaveClass(/dark/, { timeout: 10_000 });

  // 2. Brand fonts are declared and loadable — force-load each family
  // (fonts that nothing on the page uses yet stay 'unloaded' by design,
  // so document.fonts.load is the honest assertion: it fetches the woff2
  // and resolves with the loaded faces).
  const fontState = await page.evaluate(async () => {
    await document.fonts.ready;
    const load = async (spec: string) => {
      try {
        const faces = await document.fonts.load(spec, 'Wedding Venue Intelligence');
        return faces.length > 0 && faces.every((f) => f.status === 'loaded');
      } catch {
        return false;
      }
    };
    return {
      fraunces: await load('16px Fraunces'),
      inter: await load('16px Inter'),
      mono: await load('16px "JetBrains Mono"'),
    };
  });
  expect(fontState.fraunces, 'Fraunces must load').toBeTruthy();
  expect(fontState.inter, 'Inter must load').toBeTruthy();
  expect(fontState.mono, 'JetBrains Mono must load').toBeTruthy();

  // 3. The .font-display class resolves to Fraunces in computed style
  // (login headings don't use the display face — probe with a real element).
  const headingFont = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'font-display';
    document.body.appendChild(probe);
    const family = getComputedStyle(probe).fontFamily;
    probe.remove();
    return family;
  });
  expect(headingFont).toContain('Fraunces');

  // 1. No CSP violations.
  expect(cspErrors, `CSP violations: ${cspErrors.join(' | ')}`).toHaveLength(0);

  // The theme-init script itself was fetched (external, same-origin).
  const themeInit = await request.get('/theme-init.js');
  expect(themeInit.status()).toBe(200);
  expect(await themeInit.text()).toContain('wedding.theme');

  const fontsCss = await request.get('/fonts/fonts.css');
  expect(fontsCss.status()).toBe(200);
  expect(await fontsCss.text()).toContain('@font-face');
});

test('venue-custom Google Fonts are NOT blocked by the CSP', async ({ page, request }) => {
  // ── 0. Owner session; set a venue-custom heading font via org config ─
  const login = await request.post('/api/auth/login', { data: { email: 'owner@demo.local', password: 'wedding123' } });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const orgs = await (await request.get('/api/orgs', { headers: { authorization: `Bearer ${token}` } })).json();
  const orgId = orgs.organizations[0].id as string;

  const before = (await (await request.get(`/api/orgs/${orgId}/config`, { headers: { authorization: `Bearer ${token}` } })).json()) as { config: any };
  const config = { ...(before.config ?? {}), branding: { ...(before.config?.branding ?? {}), headingFont: 'Playfair Display' } };
  await request.put(`/api/orgs/${orgId}/config`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: config,
  });
  await request.put('/api/users/me/preferences', {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: { onboarding: { welcomeTourByOrg: { [orgId]: { status: 'completed', currentSlide: 0, completedSlides: [], completedAt: new Date().toISOString() } } } },
  });

  // ── 1. Load the app with the custom font configured ─────────────────
  const cspErrors: string[] = [];
  const fontLoads: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && /content security policy/i.test(m.text())) cspErrors.push(m.text().slice(0, 160)); });
  page.on('response', (r) => { if (r.url().includes('fonts.googleapis.com') || r.url().includes('fonts.gstatic.com')) fontLoads.push(`${r.status()} ${r.url().slice(0, 90)}`); });

  await page.goto('/#/');
  await page.getByLabel(/email address/i).fill('owner@demo.local');
  await page.getByLabel(/^password$/i).fill('wedding123');
  await page.getByRole('button', { name: /sign in securely/i }).click();
  await expect(page.locator('body')).toContainText(/good (morning|afternoon|evening)/i, { timeout: 20_000 });

  // ThemeProvider injects a Google Fonts stylesheet for the custom font —
  // it must load (200), not be CSP-blocked.
  await expect.poll(() => fontLoads.length, { timeout: 15_000 }).toBeGreaterThan(0);
  expect(fontLoads.every((l) => l.startsWith('200')), `font loads: ${fontLoads.join(' | ')}`).toBeTruthy();
  expect(cspErrors, `CSP violations: ${cspErrors.join(' | ')}`).toHaveLength(0);

  // The custom font is actually used for display text.
  const family = await page.evaluate(() => {
    const probe = document.createElement('div');
    probe.className = 'font-display';
    document.body.appendChild(probe);
    const fam = getComputedStyle(probe).fontFamily;
    probe.remove();
    return fam;
  });
  expect(family).toContain('Playfair Display');

  // ── 2. Restore the original config ───────────────────────────────────
  await request.put(`/api/orgs/${orgId}/config`, {
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    data: before.config ?? {},
  });
});
