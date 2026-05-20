/**
 * Apply schema.sql to the database. Idempotent: re-running is safe because
 * every CREATE statement uses `IF NOT EXISTS`.
 *
 * Run with:  npm run migrate
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from './database.js';
const sqlPath = resolve(import.meta.dirname, 'schema.sql');
const sql = readFileSync(sqlPath, 'utf8');
console.log(`[migrate] applying schema from ${sqlPath}`);
db.exec(sql);
const version = db
    .prepare('SELECT MAX(version) AS v FROM schema_version')
    .get();
console.log(`[migrate] done. schema_version = ${version.v}`);
//# sourceMappingURL=migrate.js.map