import { defineConfig, devices } from '@playwright/test';

/**
 * Mobile/tablet visual regression config.
 *
 * Separate from playwright.config.ts so the existing axe-core accessibility gate
 * stays small and focused. This suite captures authenticated, day-of-critical
 * owner/operator screens at common Apple/Android viewport sizes.
 */
const BASE_URL = process.env.MOBILE_VISUAL_BASE_URL ?? process.env.A11Y_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.mobile-visual\.spec\.ts/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 75_000,
  expect: {
    toHaveScreenshot: {
      // Keep the gate useful without failing on subpixel/font-antialiasing
      // differences across Linux/macOS/CI browsers.
      maxDiffPixelRatio: 0.015,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Visual runs rebuild assets frequently; blocking service workers prevents
    // stale PWA precaches from serving old chunk URLs between snapshot updates.
    serviceWorkers: 'block',
    launchOptions: {
      // More deterministic rendering in sandboxed CI containers.
      args: ['--font-render-hinting=none'],
    },
  },
  projects: [
    // Use Chromium for all projects so CI only needs one browser binary, while
    // still emulating Apple/Android viewport, DPR, touch, and user-agent traits.
    { name: 'iphone-14-chromium', use: { ...devices['iPhone 14'], browserName: 'chromium' } },
    { name: 'pixel-7-chromium', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'ipad-pro-11-chromium', use: { ...devices['iPad Pro 11'], browserName: 'chromium' } },
  ],
});
