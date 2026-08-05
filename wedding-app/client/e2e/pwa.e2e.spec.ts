import { test, expect } from '@playwright/test';

/**
 * PWA / offline e2e — runs against the built, seeded server (same harness
 * as happy-path.e2e.spec.ts).
 *
 * Guards what unit tests cannot:
 *   1. manifest.webmanifest is served and EVERY declared icon resolves
 *      (there was a period where the icons didn't exist and install-to-
 *      home-screen showed a blank tile).
 *   2. the service worker registers, activates, and takes control.
 *   3. the app shell is precached: with the browser set OFFLINE, a reload
 *      still serves the shell (root div + booted React app) — no dead
 *      "no internet" browser page.
 */
test.use({ viewport: { width: 1280, height: 900 } });

test('manifest + icons resolve, SW controls the page, and the shell survives offline reload', async ({ page, context }) => {
  // ── 1. Load the app online ─────────────────────────────
  await page.goto('/#/');
  await expect(page.locator('#root')).toBeVisible({ timeout: 20_000 });

  // ── 2. Manifest + icons ────────────────────────────────
  const manifestRes = await page.request.get('/manifest.webmanifest');
  expect(manifestRes.ok()).toBeTruthy();
  const manifest = await manifestRes.json();
  expect(manifest.name).toBeTruthy();
  expect(manifest.display).toBe('standalone');
  const iconSrcs: string[] = (manifest.icons ?? []).map((i: any) => i.src);
  expect(iconSrcs.length).toBeGreaterThanOrEqual(2);
  for (const src of iconSrcs) {
    const res = await page.request.get(src);
    expect(res.ok(), `manifest icon ${src} must resolve`).toBeTruthy();
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toContain('image/');
  }
  // HTML-declared icons resolve too.
  for (const src of ['/pwa-192x192.png', '/pwa-512x512.png', '/apple-touch-icon.png', '/favicon.svg', '/mask-icon.svg']) {
    const res = await page.request.get(src);
    expect(res.ok(), `icon ${src} must resolve`).toBeTruthy();
  }

  // ── 3. Service worker registers + activates + controls ─
  await page.waitForFunction(() => navigator.serviceWorker?.ready, null, { timeout: 20_000 });
  await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 20_000 });
  const swState = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return { active: !!reg?.active, scope: reg?.scope ?? '' };
  });
  expect(swState.active).toBeTruthy();
  expect(swState.scope).toContain('http');

  // ── 4. Offline reload serves the precached shell ───────
  await context.setOffline(true);
  try {
    await page.reload({ timeout: 20_000 });
    // The shell must render even though every API call fails offline.
    await expect(page.locator('#root')).toBeVisible({ timeout: 20_000 });
    const shellText = await page.locator('#root').innerText().catch(() => '');
    // The app boots far enough to render SOMETHING meaningful (login screen,
    // loading state, or an offline notice) — never a blank browser error.
    expect(shellText.length).toBeGreaterThan(0);
  } finally {
    await context.setOffline(false);
  }
});
