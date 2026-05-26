/**
 * Feature flags: per-domain toggles controlling whether reads/writes hit
 * localStorage, the server, or both.
 *
 * Modes:
 *   - 'local'  → original behavior: localStorage only (no server calls)
 *   - 'server' → new behavior: server only (no localStorage)
 *   - 'dual'   → transition: write to BOTH, read from local-first SWR,
 *                reconcile in the background
 *
 * Flags can be set via:
 *   1. Vite env vars (`VITE_BACKEND_GUESTS=server`) at build time
 *   2. localStorage `wedding.featureFlags` (runtime, dev-only)
 *   3. The admin control panel (Day 3)
 *
 * Default for every domain is 'local' until the corresponding Phase
 * (3-7) flips it to 'dual' then 'server'.
 */

export type DomainMode = 'local' | 'server' | 'dual';

export type Domain =
  | 'auth' | 'orgs' | 'roles' | 'events' | 'venues' | 'catalog'
  | 'layouts' | 'guests' | 'vendors' | 'timeline' | 'staff'
  | 'questions' | 'decor' | 'messages' | 'audit';

export const ALL_DOMAINS: ReadonlyArray<Domain> = [
  'auth','orgs','roles','events','venues','catalog','layouts',
  'guests','vendors','timeline','staff','questions','decor','messages','audit',
];

export type FeatureFlags = Record<Domain, DomainMode>;

const STORAGE_KEY = 'wedding.featureFlags';

// ─── Defaults ──────────────────────────────────────
// Phase 2 ships with everything on 'local' — the SDK + dual-write
// machinery is in place but not yet wired into UI hooks.
// Phase 3+ flips each domain in turn.
function defaults(): FeatureFlags {
  const out = {} as FeatureFlags;
  for (const d of ALL_DOMAINS) out[d] = 'local';
  return out;
}

// ─── Vite env overrides ────────────────────────────
function envOverrides(): Partial<FeatureFlags> {
  const out: Partial<FeatureFlags> = {};
  if (typeof import.meta === 'undefined') return out;
  // Vite exposes env vars as `import.meta.env.VITE_*`
  const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env ?? {};
  for (const d of ALL_DOMAINS) {
    const v = env[`VITE_BACKEND_${d.toUpperCase()}`];
    if (v === 'local' || v === 'server' || v === 'dual') out[d] = v;
  }
  return out;
}

// ─── localStorage overrides ────────────────────────
function localOverrides(): Partial<FeatureFlags> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<FeatureFlags>;
    const out: Partial<FeatureFlags> = {};
    for (const d of ALL_DOMAINS) {
      const v = parsed[d];
      if (v === 'local' || v === 'server' || v === 'dual') out[d] = v;
    }
    return out;
  } catch { return {}; }
}

// ─── Public API ────────────────────────────────────
export function loadFlags(): FeatureFlags {
  return { ...defaults(), ...envOverrides(), ...localOverrides() };
}

export function saveFlags(flags: FeatureFlags): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(flags)); }
  catch { /* private mode etc. */ }
}

export function setFlag(domain: Domain, mode: DomainMode): FeatureFlags {
  const next = { ...loadFlags(), [domain]: mode };
  saveFlags(next);
  return next;
}

export function resetFlags(): void {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* */ }
}
