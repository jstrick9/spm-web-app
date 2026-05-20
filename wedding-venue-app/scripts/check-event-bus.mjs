#!/usr/bin/env node
/**
 * Lint rule: ban raw `spm_*` event strings outside the typed event bus.
 *
 * Why
 * ---
 * The "Open Decor Designer" regression that started this engagement was caused
 * by a stringly-typed `window.addEventListener('spm_open_decor_designer', ...)`
 * disappearing from `App.tsx` while the matching `dispatchEvent` lived on in
 * `Sidebar.tsx`. Because the event name was a string, TypeScript could not
 * catch it.  This lint rule makes that whole class of bug impossible:
 *
 *   - `src/utils/appEvents.ts`     — declares `AppEventMap` and the typed bus
 *   - everything else              — must use `emit(...)` / `on(...)` from the bus
 *
 * Usage:
 *   node scripts/check-event-bus.mjs
 *
 * Exits with status 1 (and prints offending file:line:snippet) on any violation.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(root, 'src');

// Files that are *allowed* to mention raw `spm_*` event names.
// Keep this list tiny on purpose — it should never grow without review.
const ALLOWLIST = new Set([
  'src/utils/appEvents.ts',
  'src/utils/appEvents.test.ts',
  // The versioned-storage layer reads/writes its own backup keys (`spm_backup_*`)
  // and the legacy session key (`spm_session`); those are storage keys, not bus
  // events, so we exempt the file but not the project as a whole.
  'src/utils/storage.ts',
  'src/utils/storage.test.ts',
  // Storage-key constants (`spm_*` localStorage keys) live here by design.
  'src/constants/storageKeys.ts',
  'src/constants/storageKeys.test.ts',
  // Test setup occasionally interacts with raw storage keys.
  'src/test/setup.ts',
]);

// Patterns that indicate a raw event-bus call. We deliberately do NOT match
// localStorage keys (which are also `spm_*` strings) — only `dispatchEvent` /
// `addEventListener` / `removeEventListener` / `new CustomEvent('spm_...')`.
const PATTERNS = [
  /\.dispatchEvent\s*\(\s*new\s+CustomEvent\s*\(\s*['"`]spm_/,
  /\.addEventListener\s*\(\s*['"`]spm_/,
  /\.removeEventListener\s*\(\s*['"`]spm_/,
  /new\s+CustomEvent\s*\(\s*['"`]spm_/,
];

async function* walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip dependency / build / VCS directories.
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === '.git' ||
        entry.name === 'coverage' ||
        entry.name === '.next'
      ) continue;
      yield* walk(p);
    } else if (/\.(tsx?|jsx?|mjs|cjs)$/.test(entry.name)) {
      yield p;
    }
  }
}

const violations = [];
for await (const file of walk(SRC)) {
  const rel = relative(root, file).replaceAll('\\', '/');
  if (ALLOWLIST.has(rel)) continue;
  const text = await readFile(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    for (const pattern of PATTERNS) {
      if (pattern.test(line)) {
        violations.push({ file: rel, line: i + 1, snippet: line.trim() });
        break;
      }
    }
  });
}

if (violations.length === 0) {
  console.log('✓ No raw spm_* event-bus usage found outside the typed bus.');
  process.exit(0);
}

console.error(`✗ Found ${violations.length} raw spm_* event-bus usage(s) outside the typed bus.`);
console.error('  Use `emit()` / `on()` from src/utils/appEvents.ts instead.\n');
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}`);
  console.error(`      ${v.snippet}`);
}
console.error('\nIf this file legitimately needs raw access, add it to ALLOWLIST in scripts/check-event-bus.mjs.');
process.exit(1);
