/**
 * MSW server for tests. Provides a small in-memory backend that mirrors
 * the real Phase 1 API shape for the SDK-level tests.
 *
 * Why in-memory mock instead of running the real Fastify server?
 *   - Tests stay fast (~30 ms per test vs ~300 ms to spawn the server)
 *   - Tests can simulate edge cases (revision-conflict, 500 errors,
 *     network outages) by overriding handlers
 *   - Tests aren't coupled to Node-only DB drivers
 *
 * For the real backend smoke test, see server/src/routes/*.integration.test.ts.
 */
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { defaultHandlers } from './handlers.js';

export const server = setupServer(...defaultHandlers);

// Re-export so tests can write `server.use(http.get(...))` without
// importing msw directly.
export { http, HttpResponse };
