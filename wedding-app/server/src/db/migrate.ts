/**
 * Migration runner with versioning.
 *
 * Migrations live in src/db/migrations/NNNN_name.sql, where NNNN is a
 * zero-padded 4-digit version number. Each file is applied in order; we
 * record what's been applied in the `schema_version` table.
 *
 * Conventions:
 *   - Migrations are FORWARD-ONLY (no down migrations stored on disk).
 *     For rollback, restore the previous snapshot from the backup script.
 *   - Each migration runs in a transaction. If any statement fails the
 *     migration is rolled back and the runner exits non-zero.
 *   - Idempotency: every CREATE/INSERT in migrations must be guarded with
 *     IF NOT EXISTS / OR IGNORE so re-running a partial migration is safe.
 *
 * Run with:  npm run migrate
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from './database.js';

const MIGRATIONS_DIR = resolve(import.meta.dirname, 'migrations');

interface MigrationFile {
  version: number;
  name: string;
  path: string;
}

function listMigrations(): MigrationFile[] {
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  const parsed: MigrationFile[] = [];
  for (const file of files) {
    const m = /^(\d{4})_(.+)\.sql$/.exec(file);
    if (!m) {
      console.warn(`[migrate] ignoring non-conforming file: ${file}`);
      continue;
    }
    parsed.push({
      version: Number(m[1]),
      name:    m[2],
      path:    resolve(MIGRATIONS_DIR, file),
    });
  }
  parsed.sort((a, b) => a.version - b.version);
  return parsed;
}

/** Apply all pending migrations. Used by tests via the convenience export below. */
export function applyAllMigrations(opts: { quiet?: boolean } = {}): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`);

  const applied = new Set(
    (db.prepare('SELECT version FROM schema_version').all() as Array<{ version: number }>)
      .map((r) => r.version),
  );

  const all = listMigrations();
  const pending = all.filter((m) => !applied.has(m.version));

  if (pending.length === 0) {
    if (!opts.quiet) {
      const latest = all[all.length - 1];
      console.log(`[migrate] up to date (latest: ${latest?.version ?? 'none'})`);
    }
    return;
  }

  for (const mig of pending) {
    if (!opts.quiet) console.log(`[migrate] applying ${mig.version} ${mig.name}...`);
    const sql = readFileSync(mig.path, 'utf8');
    // SQLite cannot change foreign_keys inside a transaction. A table-rebuild
    // migration explicitly opts in with this pragma; pause enforcement before
    // its statements so populated production databases can rebuild safely.
    const pausesForeignKeys = /PRAGMA\s+foreign_keys\s*=\s*OFF/i.test(sql);
    try {
      if (pausesForeignKeys) {
        db.pragma('foreign_keys = OFF');
        db.exec(sql);
        db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(mig.version);
      } else {
        const tx = db.transaction(() => {
          db.exec(sql);
          db.prepare('INSERT OR IGNORE INTO schema_version (version) VALUES (?)').run(mig.version);
        });
        tx();
      }
    } catch (err) {
      console.error(`[migrate] FAILED at migration ${mig.version}:`, err);
      throw err;
    } finally {
      if (pausesForeignKeys) db.pragma('foreign_keys = ON');
    }
  }
  if (!opts.quiet) console.log(`[migrate] applied ${pending.length} migration(s).`);
}

/** Back-compat alias: tests import applySchema. */
export function applySchema(): void {
  applyAllMigrations({ quiet: true });
}

// CLI entry
const invokedDirectly = process.argv[1]?.endsWith('migrate.ts')
                     || process.argv[1]?.endsWith('migrate.js');

if (invokedDirectly) {
  applyAllMigrations();
}
