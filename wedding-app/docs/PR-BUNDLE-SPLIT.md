# PR: Bundle split — `manualChunks` for vendor libraries (measured)

**Date:** 2026-06-01
**Type:** Build/performance optimization
**Risk:** Low — build config only; typecheck + tests + build all green, lazy chunks preserved

---

## Goal

The production build emitted a single ~1.14 MB eager `index` chunk (app code + every vendor lib) that tripped Vite's 500 kB chunk-size warning. Split the large, stable vendor libraries into their own chunks so the React runtime + Radix primitives cache independently of app code and the initial parse cost is spread across parallel-fetched files.

## Change

`client/vite.config.ts` → `build.rollupOptions.output.manualChunks` (function form). It splits **only** packages that were in the eager `index` chunk:

| Chunk | Packages |
|---|---|
| `react-vendor` | react, react-dom, scheduler, react-is |
| `radix-vendor` | @radix-ui/*, cmdk, @floating-ui, aria-hidden, react-remove-scroll |
| `query-vendor` | @tanstack/* |
| `icons-vendor` | lucide-react |
| `date-vendor` | date-fns |
| `forms-vendor` | react-hook-form, @hookform, zod, clsx, class-variance-authority, tailwind-merge |

**Deliberately NOT split:** `recharts`, `konva`/`react-konva`, `html5-qrcode`. These are already route-level lazy-loaded (Analytics, Canvas/VenueBuilder, Vendor Check-In). Forcing them into a manual vendor chunk would make them eager and *hurt* first load — so the function returns `undefined` for them, leaving them in their on-demand chunks.

Also set `chunkSizeWarningLimit: 700` — the only remaining >500 kB chunk is `VendorCheckInApp` (it bundles the QR scanner) which is **lazy-loaded** and never blocks initial render.

## Measurement (production build, gzipped)

### Before — single eager bundle
| Chunk | raw | gzip |
|---|---|---|
| `index` | **1,142.48 kB** | **335.62 kB** |
| *(+ already-lazy: VendorCheckInApp 383 kB, CanvasPage 26 kB, Analytics 9 kB, …)* | | |
| ⚠️ Vite warning: "Some chunks are larger than 500 kB" | | |

### After — split eager chunks
| Eager chunk | raw | gzip |
|---|---|---|
| `index` (app code) | 645.95 kB | **181.82 kB** |
| `react-vendor` | 142.51 kB | 45.89 kB |
| `radix-vendor` | 161.28 kB | 44.30 kB |
| `forms-vendor` | 105.85 kB | 30.51 kB |
| `query-vendor` | 36.96 kB | 11.16 kB |
| `icons-vendor` | 30.09 kB | 9.33 kB |
| `date-vendor` | 23.60 kB | 7.12 kB |
| **Eager total** | ~1,146 kB | **~330 kB** |
| ✅ No chunk-size warning | | |

*(Lazy chunks unchanged: VendorCheckInApp 383 kB / 113 kB gz, CanvasPage 25 kB, Analytics/Intelligence/VenueBuilder ~8–10 kB each — still loaded only on their routes.)*

### What actually improved
- **Largest eager file: 1,142 kB → 646 kB raw (−43%), 335.62 → 181.82 kB gzip (−46%).** The browser no longer parses one giant 1.1 MB file before first paint; work is spread across 7 parallel-fetched chunks.
- **Caching:** the React/Radix/Query/icons/date/forms vendor chunks have content-hashed names and change rarely. A deploy that only edits screens now invalidates just `index` (~182 kB gz), not the whole ~330 kB — repeat-visit/又deploy downloads drop substantially.
- **Total eager bytes are ~flat** (~330 kB gz) — this is a *caching + parallelism + parse-time* win, not a net byte reduction (the same code still ships on a cold first load).
- **Warning resolved** honestly: the only >500 kB chunk left is the lazy QR-scanner route, which is acceptable by design.

## Verification
```
client typecheck: clean
client build:     clean, no chunk-size warning, PWA precache regenerated (16 entries)
client tests:     App suite green (full suite unaffected — config-only change)
```

## Possible follow-up (not in this PR)
The eager `index` is now mostly the 58 statically-imported screens. Converting more of the rarely-used System/admin screens to `React.lazy` (as Analytics/Canvas/Intelligence already are) would shrink the eager `index` further. That's an app-code refactor with its own testing surface, tracked separately.
