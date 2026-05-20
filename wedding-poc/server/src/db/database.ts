/**
 * SQLite connection singleton.
 *
 * One file on disk = entire database. `better-sqlite3` is synchronous (no
 * callbacks, no promises) — that's actually a feature here: it's faster than
 * any async driver for SQLite because we don't pay the event-loop cost, and
 * Fastify can handle hundreds of concurrent requests anyway because most of
 * its work is I/O and our DB queries are sub-millisecond.
 *
 * Path resolution:
 *   - $WEDDING_DB_PATH                   → used as-is (absolute or relative to CWD)
 *   - otherwise                          → <server_pkg_root>/data/wedding.db
 *
 * The second case anchors the DB to the server package directory rather than
 * the shell's CWD, so `npm --prefix server …` and `npm run dev` and `tsx
 * server/src/index.ts` from the repo root all read/write the SAME file.
 */
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// This file lives at: <server>/src/db/database.ts
// → server package root is two levels up.
const SERVER_PKG_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

const DB_PATH = process.env.WEDDING_DB_PATH
  ? resolve(process.env.WEDDING_DB_PATH)
  : resolve(SERVER_PKG_ROOT, 'data', 'wedding.db');

// Ensure the parent directory exists (first-run friendliness).
const dir = dirname(DB_PATH);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

export const db = new Database(DB_PATH);

// These pragmas matter for production-grade behavior; setting them here
// (rather than only in schema.sql) means they apply to every fresh connection.
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');   // wait up to 5s on a locked db

export function closeDb(): void {
  db.close();
}

process.on('SIGINT',  () => { closeDb(); process.exit(0); });
process.on('SIGTERM', () => { closeDb(); process.exit(0); });
