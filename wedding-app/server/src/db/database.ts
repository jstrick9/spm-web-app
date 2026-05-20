/**
 * SQLite connection singleton.
 *
 * Path resolution:
 *   - $WEDDING_DB_PATH                   → used as-is (absolute or rel to CWD)
 *   - $TEST_DB=:memory:                  → in-memory DB for vitest
 *   - otherwise                          → <server_pkg_root>/data/wedding.db
 *
 * Tests use `:memory:` so they run in parallel without file collisions.
 */
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_PKG_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

function resolveDbPath(): string {
  if (process.env.TEST_DB === ':memory:') return ':memory:';
  if (process.env.WEDDING_DB_PATH) return resolve(process.env.WEDDING_DB_PATH);
  return resolve(SERVER_PKG_ROOT, 'data', 'wedding.db');
}

const DB_PATH = resolveDbPath();

if (DB_PATH !== ':memory:') {
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

export function closeDb(): void {
  db.close();
}

process.on('SIGINT',  () => { closeDb(); process.exit(0); });
process.on('SIGTERM', () => { closeDb(); process.exit(0); });
