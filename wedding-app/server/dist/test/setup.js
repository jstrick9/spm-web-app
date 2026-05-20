/**
 * Test setup: runs before every test file. Creates a fresh in-memory DB
 * (via TEST_DB=:memory:) and applies the schema. Each test file runs in
 * its own isolated process (vitest pool: 'forks', isolate: true).
 */
import { beforeAll, afterAll } from 'vitest';
import { applySchema } from '../db/migrate.js';
// Ensure TEST_DB is set before any module that imports database.ts loads.
process.env.TEST_DB = ':memory:';
process.env.JWT_SECRET = 'test-secret';
beforeAll(() => {
    applySchema();
});
afterAll(async () => {
    // Best-effort close; ignore errors when DB is already closed.
    try {
        const { closeDb } = await import('../db/database.js');
        closeDb();
    }
    catch { /* ignore */ }
});
//# sourceMappingURL=setup.js.map