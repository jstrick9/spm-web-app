import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    // Only collect TypeScript tests under src/. Vitest 4 widened its default
    // test glob to also match compiled .js files, which would double-run the
    // suite from a stale dist/ build (and the duplicate copies fight over the
    // same in-memory DB transaction). Pinning include/exclude keeps the run
    // deterministic regardless of whether dist/ has been built.
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    // Set TEST_DB BEFORE any test module loads. Vitest passes `env` into
    // each forked worker process. Without this, src/db/database.ts would
    // read process.env.TEST_DB before src/test/setup.ts had a chance to
    // set it, and tests would silently bind to the persistent dev DB.
    env: {
      TEST_DB: ':memory:',
      JWT_SECRET: 'test-secret',
      NODE_ENV: 'test',
      LOG_LEVEL: 'error',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/db/seed.ts', 'src/index.ts'],
      thresholds: {
        lines:      75,
        functions:  75,
        branches:   55,
        statements: 70,
      },
    },
    pool: 'forks',
    isolate: true,
  },
});
