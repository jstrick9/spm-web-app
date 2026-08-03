import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config — accessibility (axe-core) checks + browser e2e specs.
 *
 * The app is served as a single origin in production: the Fastify server
 * serves the built client from client/dist. So the suite points at the
 * running server (default http://localhost:3000), NOT the Vite dev server.
 *
 * The harness that builds + seeds + boots that server lives in
 * scripts/a11y-test.sh; it sets A11Y_BASE_URL and runs `playwright test`.
 * Spec naming: *.a11y.spec.ts (axe scans) and *.e2e.spec.ts (functional).
 */
const BASE_URL = process.env.A11Y_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.(a11y|e2e)\.spec\.ts/,
  // Run serially with a single worker. The suite shares one backend server,
  // and a single worker also avoids a global-`expect` collision between
  // Playwright and Vitest (both live in the dependency tree) that corrupts
  // parallel worker state.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    // Headless shell is what `playwright install chromium` provides in CI.
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
