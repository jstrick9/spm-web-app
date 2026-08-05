/**
 * Post-build asset copy for the server.
 *
 * `tsc` only emits .js/.d.ts — runtime assets (SQL migrations, etc.) must be
 * copied into dist explicitly. Without this, `node dist/index.js` fails at
 * boot: buildApp() runs applyAllMigrations() which reads dist/db/migrations.
 */
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'src');
const DIST = resolve(ROOT, 'dist');

const copyDir = (rel) => {
  const from = resolve(SRC, rel);
  const to = resolve(DIST, rel);
  if (!existsSync(from)) return;
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`[build] copied ${rel} -> dist/${rel}`);
};

// SQL migrations are read at boot (applyAllMigrations) and by `npm run migrate`.
copyDir('db/migrations');
console.log('[build] dist assets copied');
