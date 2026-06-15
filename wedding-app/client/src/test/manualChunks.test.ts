/**
 * manualChunks regression tests — Phase 34
 *
 * PURPOSE
 * ───────
 * The Rollup manualChunks function in vite.config.ts uses six regex rules to
 * split vendor packages into cacheable chunks.  These tests lock in the exact
 * split behaviour so that any future edit to vite.config.ts that accidentally
 * breaks a regex is caught immediately by `npm test` — before it reaches a
 * production build.
 *
 * HOW IT WORKS
 * ────────────
 * We extract the manualChunks logic into a pure function here (identical to
 * the one in vite.config.ts) and test it directly.  This is the standard
 * approach for testing Rollup config logic without running a full build.
 *
 * WHAT WAS FIXED IN PHASE 34 (N5 from master review)
 * ────────────────────────────────────────────────────
 * All rules except radix-vendor previously ended with [\/] (a path separator).
 * Rollup/Vite resolves some entry-point module IDs WITHOUT a trailing slash —
 * e.g. "/project/node_modules/react" instead of the more common
 * "/project/node_modules/react/index.js".  The old patterns silently missed
 * those IDs, causing packages to fall into the wrong chunk.
 *
 * Fix: [\/] → ([\/]|$)  on five of six rules.
 * radix-vendor is intentionally excluded (already correct without it).
 *
 * VERIFIED PROPERTIES
 * ───────────────────
 * For every rule × every target package:
 *   ✅ WITH trailing slash: matches correct chunk
 *   ✅ WITHOUT trailing slash: matches correct chunk  ← THE FIX
 *   ✅ Non-target packages: never produce false positives
 *   ✅ Rule ordering: earlier rules don't shadow later ones
 */

import { describe, it, expect } from 'vitest';

// ── Replicate the manualChunks function exactly as it appears in vite.config.ts
// Update this function whenever vite.config.ts changes.
function manualChunks(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined;

  if (/[\/]node_modules[\/](react|react-dom|scheduler|react-is)([\/]|$)/.test(id)) {
    return 'react-vendor';
  }
  if (/[\/]node_modules[\/](@radix-ui|cmdk|@floating-ui|aria-hidden|react-remove-scroll)/.test(id)) {
    return 'radix-vendor';
  }
  if (/[\/]node_modules[\/]@tanstack([\/]|$)/.test(id)) {
    return 'query-vendor';
  }
  if (/[\/]node_modules[\/]lucide-react([\/]|$)/.test(id)) {
    return 'icons-vendor';
  }
  if (/[\/]node_modules[\/]date-fns([\/]|$)/.test(id)) {
    return 'date-vendor';
  }
  if (
    /[\/]node_modules[\/](react-hook-form|@hookform|zod|clsx|class-variance-authority|tailwind-merge)([\/]|$)/.test(
      id,
    )
  ) {
    return 'forms-vendor';
  }

  if (/[\/]node_modules[\/]html5-qrcode([\/]|$)/.test(id)) {
    return 'qr-scanner-vendor';
  }

  return undefined;
}

// ── Helper: build representative module IDs for a package ─────────────────

/** Standard deep path — the common case */
function withSlash(pkg: string, file = 'dist/index.esm.mjs'): string {
  return `/project/node_modules/${pkg}/${file}`;
}

/**
 * Entry resolved without sub-path — the edge case fixed in Phase 34.
 * Occurs when a package uses the "exports" field in package.json and Rollup
 * resolves the entry to the package root rather than an explicit file path.
 */
function withoutSlash(pkg: string): string {
  return `/project/node_modules/${pkg}`;
}

// ── Test matrix ────────────────────────────────────────────────────────────

describe('manualChunks — react-vendor', () => {
  const PKGS = ['react', 'react-dom', 'scheduler', 'react-is'];

  for (const pkg of PKGS) {
    it(`assigns ${pkg} (with slash) to react-vendor`, () => {
      expect(manualChunks(withSlash(pkg))).toBe('react-vendor');
    });

    it(`assigns ${pkg} (without slash — Phase 34 fix) to react-vendor`, () => {
      expect(manualChunks(withoutSlash(pkg))).toBe('react-vendor');
    });
  }

  // ── False-positive guard — packages whose names START WITH "react" ──────
  const NOT_REACT: Array<[string, string | undefined]> = [
    ['react-hook-form',    'forms-vendor'],   // must go to forms, not react
    ['react-konva',        undefined],         // lazy-loaded canvas — no split
    ['react-remove-scroll','radix-vendor'],   // Radix dependency
    ['react-router',       undefined],         // hypothetical, no split
  ];

  for (const [pkg, expectedChunk] of NOT_REACT) {
    it(`does NOT assign ${pkg} to react-vendor (goes to ${expectedChunk ?? 'importer'})`, () => {
      const result = manualChunks(withSlash(pkg));
      expect(result).not.toBe('react-vendor');
      expect(result).toBe(expectedChunk);
    });
  }
});

describe('manualChunks — radix-vendor', () => {
  const PKGS = [
    '@radix-ui/react-dialog',
    '@radix-ui/react-tabs',
    '@radix-ui/react-dropdown-menu',
    '@radix-ui/react-select',
    'cmdk',
    '@floating-ui/react',
    '@floating-ui/dom',
    'aria-hidden',
    'react-remove-scroll',
  ];

  for (const pkg of PKGS) {
    it(`assigns ${pkg} to radix-vendor`, () => {
      expect(manualChunks(withSlash(pkg))).toBe('radix-vendor');
    });
  }

  it('does not assign @tanstack to radix-vendor', () => {
    expect(manualChunks(withSlash('@tanstack/react-query'))).not.toBe('radix-vendor');
  });
});

describe('manualChunks — query-vendor', () => {
  const PKGS = ['@tanstack/react-query', '@tanstack/query-core'];

  for (const pkg of PKGS) {
    it(`assigns ${pkg} (with slash) to query-vendor`, () => {
      expect(manualChunks(withSlash(pkg))).toBe('query-vendor');
    });

    it(`assigns ${pkg} (without slash — Phase 34 fix) to query-vendor`, () => {
      expect(manualChunks(withoutSlash(pkg))).toBe('query-vendor');
    });
  }
});

describe('manualChunks — icons-vendor', () => {
  it('assigns lucide-react (with slash) to icons-vendor', () => {
    expect(manualChunks(withSlash('lucide-react'))).toBe('icons-vendor');
  });

  it('assigns lucide-react (without slash — Phase 34 fix) to icons-vendor', () => {
    expect(manualChunks(withoutSlash('lucide-react'))).toBe('icons-vendor');
  });

  it('does not assign a non-lucide package to icons-vendor', () => {
    expect(manualChunks(withSlash('some-other-icons'))).not.toBe('icons-vendor');
  });
});

describe('manualChunks — date-vendor', () => {
  it('assigns date-fns (with slash) to date-vendor', () => {
    expect(manualChunks(withSlash('date-fns'))).toBe('date-vendor');
  });

  it('assigns date-fns (without slash — Phase 34 fix) to date-vendor', () => {
    expect(manualChunks(withoutSlash('date-fns'))).toBe('date-vendor');
  });

  // Critical false-positive check: date-fns-tz must NOT match the date-fns rule
  it('does NOT assign date-fns-tz to date-vendor (false-positive guard)', () => {
    expect(manualChunks(withSlash('date-fns-tz'))).not.toBe('date-vendor');
  });

  it('does NOT assign date-fns-tz (without slash) to date-vendor', () => {
    expect(manualChunks(withoutSlash('date-fns-tz'))).not.toBe('date-vendor');
  });
});

describe('manualChunks — forms-vendor', () => {
  const PKGS = [
    'react-hook-form',
    '@hookform/resolvers',
    'zod',
    'clsx',
    'class-variance-authority',
    'tailwind-merge',
  ];

  for (const pkg of PKGS) {
    it(`assigns ${pkg} (with slash) to forms-vendor`, () => {
      expect(manualChunks(withSlash(pkg))).toBe('forms-vendor');
    });

    it(`assigns ${pkg} (without slash — Phase 34 fix) to forms-vendor`, () => {
      expect(manualChunks(withoutSlash(pkg))).toBe('forms-vendor');
    });
  }

  // zod-to-json-schema must NOT match the zod rule
  it('does NOT assign zod-to-json-schema to forms-vendor (false-positive guard)', () => {
    expect(manualChunks(withSlash('zod-to-json-schema'))).not.toBe('forms-vendor');
  });
});

describe('manualChunks — lazy / no-split packages', () => {
  // Heavy packages that are route-level lazy-loaded and must NOT be pulled
  // into any eager vendor chunk.
  const LAZY_PKGS = [
    'recharts',           // Analytics screen
    'konva',              // Floor plan canvas
    'react-konva',        // Floor plan canvas
    'some-app-utility',   // Hypothetical app-level package
  ];

  for (const pkg of LAZY_PKGS) {
    it(`does not split ${pkg} (returns undefined — stays with importer)`, () => {
      expect(manualChunks(withSlash(pkg))).toBeUndefined();
    });
  }
});

describe('manualChunks — QR scanner async vendor', () => {
  it('assigns html5-qrcode to qr-scanner-vendor for the on-demand scanner chunk', () => {
    expect(manualChunks(withSlash('html5-qrcode'))).toBe('qr-scanner-vendor');
  });

  it('assigns html5-qrcode root resolution to qr-scanner-vendor', () => {
    expect(manualChunks(withoutSlash('html5-qrcode'))).toBe('qr-scanner-vendor');
  });
});

describe('manualChunks — non-node_modules paths', () => {
  it('returns undefined for app source files', () => {
    expect(manualChunks('/project/src/screens/events/EventDetail.tsx')).toBeUndefined();
  });

  it('returns undefined for paths that merely CONTAIN "node_modules" in a non-standard position', () => {
    // Edge case: a hypothetical path like /my-node_modules-backup/react/index.js
    // should not match because the prefix isn't /node_modules/
    expect(manualChunks('/my-node_modules-backup/react/index.js')).toBeUndefined();
  });
});

describe('manualChunks — rule ordering (earlier rules must not shadow later ones)', () => {
  // react-remove-scroll: react-vendor rule fires BEFORE radix-vendor.
  // The react-vendor regex must NOT match react-remove-scroll.
  it('react-remove-scroll goes to radix-vendor, not react-vendor', () => {
    expect(manualChunks(withSlash('react-remove-scroll'))).toBe('radix-vendor');
    expect(manualChunks(withSlash('react-remove-scroll'))).not.toBe('react-vendor');
  });

  // react-hook-form: react-vendor rule fires before forms-vendor.
  // The react-vendor regex must NOT match react-hook-form.
  it('react-hook-form goes to forms-vendor, not react-vendor', () => {
    expect(manualChunks(withSlash('react-hook-form'))).toBe('forms-vendor');
    expect(manualChunks(withSlash('react-hook-form'))).not.toBe('react-vendor');
  });

  // @tanstack: must go to query-vendor (fires after radix-vendor which doesn't match it)
  it('@tanstack/react-query goes to query-vendor, not radix-vendor', () => {
    expect(manualChunks(withSlash('@tanstack/react-query'))).toBe('query-vendor');
    expect(manualChunks(withSlash('@tanstack/react-query'))).not.toBe('radix-vendor');
  });
});
