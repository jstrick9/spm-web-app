/**
 * Apply schema.sql to the database. Idempotent.
 * Run with:  npm run migrate
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from './database.js';
export function applySchema() {
    const sqlPath = resolve(import.meta.dirname, 'schema.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    db.exec(sql);
}
// Only run when invoked directly (not when imported by tests).
const invokedDirectly = process.argv[1]?.endsWith('migrate.ts')
    || process.argv[1]?.endsWith('migrate.js');
if (invokedDirectly) {
    console.log('[migrate] applying schema...');
    applySchema();
    const version = db
        .prepare('SELECT MAX(version) AS v FROM schema_version')
        .get();
    console.log(`[migrate] done. schema_version = ${version.v}`);
}
//# sourceMappingURL=migrate.js.map