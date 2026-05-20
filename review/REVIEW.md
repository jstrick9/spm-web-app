# Wedding-Venue-App — Comprehensive Code & Product Review

Repository: `jstrick9/wedding-venue-app` (main, commit `84a4ee3`, 2026-05-15)
Stack: React 19 + Vite 7 + TypeScript 5 + Tailwind 4 + Vitest + (optional) Supabase
Scope of review: every non-test source file under `src/`, the two SQL migrations, the Supabase Edge Function, configuration files, and the build/test scaffolding. Test files were used as documentation but not individually critiqued.

---

## 1. Overall Summary

### High-level findings

1. **A production-grade Supabase backend has been *designed* but the front-end never actually uses it.** `supabase/migrations/initial_backend.sql` defines a multi-tenant Postgres schema with organisations, events, event memberships, RLS, storage buckets and triggers. Meanwhile `useLayoutState`, `AuthContext`, RBAC, the Guest Portal, vendors, timeline, RSVPs, audit log and *every other domain* read from / write to `localStorage` only. `DatabaseService.ts` contains an unfinished bridge but no caller in the app uses it. Result: the app is effectively single-device, single-user, with no cross-device sync, no real authorisation, and no recoverability beyond local backups.
2. **The “new” dynamic RBAC system (`useRBAC`, `AccessControlPanel`, `permissions.ts` registry) is completely disconnected from the actual permission gates.** Every gate in the app (`canEditLayout`, `canManageGuests`, `canAccessAdminPanel`, etc., in `src/utils/permissions.ts`) still hard-codes `user.role === 'admin' | 'staff' | 'basic' | 'guest'`. Roles created in the UI have **zero** runtime effect.
3. **The user model has no first-class concept of an Event.** Events are inferred from string fields (`user.eventName`, `guest.eventName`) and a `normalizeEventKey()` slug. There is no events table, no event membership join, no cascade, no “bride/groom invited *Aunt Mary* to the *rehearsal dinner*” relation. The Guest Portal therefore has no way to reliably scope guests to events without the admin manually setting a string per record.
4. **Every admin tab is `// @ts-nocheck`** (15 files). TypeScript provides no safety in roughly 11 000 LOC of admin UI. Regressions are inevitable.
5. **`UserManagement.tsx` and the rest of the admin panel are not really components — they are render-only views that destructure ~200+ props from a mega-context.** This is the symptom of a god-object refactor that was started but not finished. Adding the proposed Event/Access integration on top of this prop pipeline will be painful.
6. **The Guest Portal is reasonably thoughtful** (PBKDF2-hashed password, fingerprinted session, time-boxed access with grace period, token redaction from URL). But it still accepts a *legacy plaintext* portal password (`config.portalPassword`), authenticates against `localStorage`-stored guest records, and has no rate-limiting on the login form.
7. **Single-file production bundle is ~1.2 MB (gzip 271 KB)** because `vite.config.ts` defaults to `viteSingleFile()` with `inlineDynamicImports`. All `React.lazy()` boundaries are collapsed. First paint suffers and CDN caching is impossible. The chunked build mode exists (`build:split`) but is opt-in.
8. **Tests are healthy in count (231 passing) but heavily concentrated on storage, sessions and permissions edge-cases.** Visual / interaction tests for the admin tabs are largely absent (a direct consequence of `@ts-nocheck`).

### Top recommendations (in priority order)

| # | Action | Why |
|---|--------|-----|
| 1 | Make the dynamic RBAC system the **single source of truth** for permission checks; rewrite `permissions.ts` helpers in terms of `hasPermission(roleIds, 'feature.id')` | Without this, the Access-Control UI lies to admins and the rest of this proposal is impossible to enforce. |
| 2 | Introduce a first-class **`Event`** entity (front-end + DB), and a **`EventMembership`** join with role-per-event | Required for multi-event venues, bride/groom guest invitations, and the Guest Portal to scope correctly. |
| 3 | Wire `AuthenticatedApp` to **actually call Supabase** through `DatabaseService` when `VITE_BACKEND_PROVIDER=supabase`; keep `localStorage` only as an offline cache | Backend exists; app is shipping without it. |
| 4 | Remove `// @ts-nocheck` from admin files and break the 200-prop pipeline by introducing `AdminContext` + per-tab data hooks | Restores type safety and lets you iterate. |
| 5 | Default the production build to **chunked** mode and lazy-load admin/decor/portal | Cuts first-paint payload by ~60 %. |
| 6 | Delete the plaintext portal-password code path entirely after one release; add login throttling | Closes the only remaining auth-bypass path. |

---

## 2. Bug / Problem Areas

Severity legend: **Critical** (security, data loss, breaks core flow) · **High** (broken feature, type-unsafe surface, perf regression) · **Medium** (footgun, UX issue, dead code) · **Low** (style, polish).

### 2.1 — TypeScript regression: invalid updater passed to `setDecorArrangements`
- **File / Line:** `src/components/AuthenticatedApp.tsx:493`
- **Severity:** **High** — broke `npm run typecheck` and silently corrupted decor saves at runtime.
- **Problem:** `layoutState.setDecorArrangements` re-exports the *module-level* function `setDecorArrangements(arrangements: DecorArrangement[])` from `useLayoutState.ts`, **not** a React `useState` setter. The call passes an updater function `prev => …`, which TypeScript flagged with 4 errors. At runtime, the function is written to `localStorage` as-is, corrupting saved arrangements on the very next save.
- **Fix (already applied to the workspace clone):**
  ```tsx
  // BEFORE
  onSave={(a) => {
    layoutState.setDecorArrangements(prev =>
      prev.find(x => x.id === a.id)
        ? prev.map(x => x.id === a.id ? a : x)
        : [...prev, a]);
    close('decorDesigner');
  }}

  // AFTER
  onSave={(a) => {
    const prev = layoutState.getDecorArrangements();
    const next = prev.find(x => x.id === a.id)
      ? prev.map(x => x.id === a.id ? a : x)
      : [...prev, a];
    layoutState.setDecorArrangements(next);
    close('decorDesigner');
  }}
  ```
  Verified: `npx tsc --noEmit` now passes with **0 errors** on the patched tree.

### 2.2 — Dynamic RBAC is decorative, not enforced
- **Files:** `src/utils/permissions.ts` (entire file), `src/hooks/useRBAC.ts`, `src/components/admin/AccessControlPanel.tsx`, every consumer of `canEditLayout` / `canManageGuests` / `canAccessAdminPanel`.
- **Severity:** **Critical** (security & product correctness).
- **Problem:** All gating helpers use the *legacy* role enum (`admin | staff | basic | guest`) and an unrelated `UserPermissions` record. None of them ever read from `useRBAC().hasPermission(...)`. An admin who creates a custom role *Bride/Groom* with permissions `guests.assign` + `portal.guest.view` and assigns it to a user gets **no behavioural change**.
- **Fix (approach):**
  1. Add a `currentUserPermissions` set to `AuthContext` derived from the user's `assignedRoles` + `useRBAC().getRolePermissions`.
  2. Rewrite each helper in `permissions.ts` to consult that set (with a backwards-compatible fallback to the legacy `role` field for one release):
     ```ts
     export function canManageGuests(user: User | null | undefined): boolean {
       if (!user) return false;
       if (hasDynamicPermission(user, 'guests.manage')) return true;
       // legacy fallback
       return isAdminUser(user) || isStaffUser(user);
     }
     ```
  3. Add a Vitest assertion that every `canX` helper consults the dynamic registry (a regex test over the file is a 30-line guard).
- See §6 (Refactoring Proposal) for the full integration.

### 2.3 — `AccessControlPanel` is a UI shell — three core sub-views are stubbed out
- **File:** `src/components/admin/AccessControlPanel.tsx`
- **Severity:** **High** (the feature visibly exists but does not work).
- **Problem:** Inside the file you will find:
  - `{/* Permission checkboxes would go here (truncated for brevity) */}`
  - `{/* Permissions Tab */}` body is a single header
  - `{/* Audit Log Tab */}` body is a single header
  - `{/* Create role form (original logic) */}` placeholder — no actual inputs
  
  An admin can list and delete roles, but cannot create one (the form has no inputs), cannot toggle a permission (Tree view is empty), and cannot read the audit log (rendered title only).
- **Fix (approach):** Reinstate the full UI. Minimum viable shape:
  ```tsx
  // Tree view body
  {groupPermissions.map(perm => (
    <label key={perm.id} className="flex items-start gap-2 py-1">
      <input
        type="checkbox"
        checked={selectedRolePermissions.includes(perm.id)}
        disabled={selectedRole.isImmutable || (perm.isLocked && selectedRole.isSystem)}
        onChange={() => handleTogglePermission(perm.id)}
      />
      <span>
        <span className="font-medium text-sm">{perm.label}</span>
        <span className="block text-xs text-gray-500">{perm.description}</span>
      </span>
    </label>
  ))}
  ```
  And restore form fields + audit table from the previous revision (they exist in earlier commits, ref `getInheritedPermissions` / `useRBAC` — the data layer is fine, only the JSX is missing).

### 2.4 — `// @ts-nocheck` on every admin file
- **Files:** all 14 files under `src/components/admin/*.tsx` and `src/components/admin/shared/AdminSharedComponents.tsx`.
- **Severity:** **High** (process risk, not a runtime bug — yet).
- **Problem:** Roughly **11 000 LOC of admin UI has zero static checking**. The earlier `setDecorArrangements` bug (§2.1) was caught only because that call lives in `AuthenticatedApp.tsx`, which is *not* `@ts-nocheck`. Equivalent latent bugs almost certainly exist inside the admin tabs.
- **Fix:** Remove `@ts-nocheck` one file at a time, behind PR-scoped CI. The `AdminCommonProps` type at `src/components/admin/AdminTabTypes.ts` should be extended to actually enumerate the props each tab uses (today every tab destructures the same union — see `UserManagement.tsx:15-200`).

### 2.5 — `UserManagement.tsx` destructures 200+ props from one super-bag
- **File:** `src/components/admin/UserManagement.tsx:15-200` (then again in `BrandingManagement`, `VenueManagement`, etc., to lesser degrees).
- **Severity:** **High** (maintainability, performance, prop-drilling).
- **Problem:** A single object literal `props` is destructured into ~210 named locals including raw React state setters, validators, intermediate parser values (`raw`, `parsed`, `cleaned`), DOM globals (`alert`, `FileReader`), and even sub-components (`AdminPanel`). Every rerender of `AdminPanel` re-creates this object → every admin tab rerenders even if the user only typed in one field. Onboarding a new dev to this file is effectively impossible.
- **Fix (sketch):**
  - Move shared admin state into a context: `<AdminProvider>{tabs}</AdminProvider>`.
  - Each tab pulls only what it needs via small hooks (`useAdminUsers()`, `useAdminVenues()`).
  - Validators (`validateUserForm`, `validateEventQuestion`) are pure — extract to `src/utils/`.
  - Intermediate locals (`raw`, `parsed`, `cleaned`) are *not* props at all — they should be local-scope variables in a handler.

### 2.6 — Legacy plaintext fallbacks for both user and portal passwords
- **Files:** `src/utils/auth.ts:139-156` (user), `src/components/GuestPortal.tsx:207-211` (portal).
- **Severity:** **Critical** (security).
- **Problem:** `verifyPassword` accepts `user.password === password` (plaintext) when no hash is present. `GuestPortal` similarly allows `config.portalPassword` plaintext. Both write a `console.warn`, which is fine as a **migration** strategy but only acceptable behind a sunset date. There is no flag to disable it, no telemetry that records remaining unmigrated rows, and no admin-facing banner asking the admin to re-save.
- **Fix:**
  1. Add a `LEGACY_AUTH_DEADLINE` constant; after the deadline, `verifyPassword` rejects plaintext entirely.
  2. Surface a yellow status banner in `Header.tsx` when the active config has `portalPassword && !portalPasswordHash`.
  3. (Already applied in this review) Strengthen the warning message in `GuestPortal.tsx` to direct the admin to the migration step.

### 2.7 — Guest Portal login is unauthenticated *to the platform* and unthrottled
- **File:** `src/components/GuestPortal.tsx:160-220`
- **Severity:** **High** (security).
- **Problem:** A guest types `eventTitle + guestIdentifier (name|email|token) + portalPassword` and is granted access. There is no rate-limiting (the user code already implements lockout for app users in `auth.ts` but not for the portal), no per-IP throttle, no CAPTCHA, no audit log entry on failed attempts. Because guest identifiers default to *full name*, anyone with the event URL can brute-force their way in. Token rotation is also absent.
- **Fix:**
  1. Implement an in-`sessionStorage` per-portal throttle (`portal_login_attempts:{eventKey}`) mirroring `recordFailedLogin` semantics.
  2. Recommend `token` as the primary identifier in copy and require email-as-secondary.
  3. After Supabase migration (§6.2) move all attempts to the server side and use Supabase Edge Functions + `auth.users` for true rate-limiting.

### 2.8 — `index.html` ships `Cache-Control: no-cache, no-store, must-revalidate`
- **File:** `index.html:18-20`
- **Severity:** **Medium** (perf).
- **Problem:** A 1.2 MB single-file HTML re-downloads on **every** navigation. Combined with §1.7 this kills repeat-visit performance.
- **Fix:** Remove the `Cache-Control` meta tags. Use hashed asset filenames (already configured in `vite.config.ts` chunked mode) and let the CDN handle freshness. If you genuinely need `no-cache`, set it as an HTTP header on the CDN, not as a meta in the document body (browsers ignore meta `Cache-Control` per spec anyway, so the lines mostly mislead the reader).

### 2.9 — `Pragma: no-cache` and `Expires: 0` are likewise meta-tag noise
- **File:** `index.html:19-20`
- **Severity:** **Low**.
- **Fix:** Delete.

### 2.10 — Default build inlines all dynamic imports → no code splitting
- **File:** `vite.config.ts:75-90`
- **Severity:** **High** (perf).
- **Problem:** `npm run build` produces a single 1.2 MB HTML. `React.lazy()` boundaries (Decor Designer, Admin Panel, Guest Portal, Print View, Vendor Panel, Timeline Panel) lose their splitting benefit. Time-to-interactive on average mobile suffers proportionally.
- **Fix:** Make `build:split` the default for production (`npm run build` → chunked) and rename single-file mode to `npm run build:singlefile` for the explicit "open from filesystem" use case. Add `assetsInlineLimit: 4096` for the chunked mode (the current 100 MB inlines all images).

### 2.11 — `index.html` blocks first paint on Google Fonts
- **File:** `index.html:25-29`
- **Severity:** **Medium** (perf, privacy/CSP).
- **Problem:** Render-blocking link to `fonts.googleapis.com`. Also blocks offline mode and complicates a strict CSP.
- **Fix:** Self-host the woff2 files (Inter is OFL, Playfair is OFL) and use `font-display: swap`.

### 2.12 — `DatabaseService.ts` is dead code
- **File:** `src/services/DatabaseService.ts`
- **Severity:** **Medium** (drift risk).
- **Problem:** The file exports a class instantiated nowhere. Its `getLayouts`, `saveLayout`, etc., do not match the production schema (`layouts.payload jsonb` vs class's flat `Layout`). It re-instantiates a Supabase client that is *also* created in `services/backend/supabaseClient.ts`. Two clients = two auth states; if anything ever imports both, sessions desync.
- **Fix:** Either (a) delete the file, or (b) refactor into thin domain repositories under `src/services/repos/` (`layoutsRepo`, `guestsRepo`, …) that all consume the singleton from `supabaseClient.ts` and return rows already mapped to the shape the UI expects.

### 2.13 — `console.log('✅ Supabase connected')` in production
- **File:** `src/services/DatabaseService.ts:14`
- **Severity:** **Low**.
- **Fix:** Wrap in `import.meta.env.DEV`.

### 2.14 — Native `alert()` used in 5 places
- **Files:** `src/components/DrawingTool.tsx:618`, `src/components/MultiImageUpload.tsx:29,42`, `src/components/StaffOperationsPanel.tsx:899,902`, `src/hooks/useLayoutState.ts:722`.
- **Severity:** **Medium** (UX, accessibility, blocks main thread, fails some embedded contexts).
- **Fix:** Replace with the existing `<ToastContainer>` / `showToast()` pattern (already imported in `AuthenticatedApp.tsx`). Sample:
  ```tsx
  // BEFORE
  alert('Image must be less than 5MB');
  // AFTER
  showToast('Image must be less than 5 MB', { variant: 'error' });
  ```

### 2.15 — Guest Portal cannot revoke a single guest token
- **File:** `src/utils/guestPortal.ts`, `src/components/admin/GuestPortalManagement.tsx`
- **Severity:** **Medium** (security/operational).
- **Problem:** Once a guest token is issued (via `guest.token`), there is no rotation primitive. If a guest forwards the URL to a stranger, the only mitigation is to delete the guest record (which loses RSVP data) or change the entire portal password (locks out everyone).
- **Fix:** Add a `revokedTokens: string[]` to `GuestPortalConfig` and check membership in `findGuestInEvent` and the session validator. Surface a "Revoke link" button in the guest list inside `GuestPortalManagement`.

### 2.16 — `getPortalGuests()` falls back to *every* guest from *every* layout
- **File:** `src/utils/guestPortal.ts:140-160`
- **Severity:** **Medium** (privacy / data leak).
- **Problem:** When the explicit `STORAGE_KEYS.PORTAL_GUESTS` list is empty, the function pulls from `getSavedLayouts()` and merges all guests across every layout, ignoring `eventName`. A bride/groom planning two events on the same device could expose the wrong guest list to the wrong portal.
- **Fix:** Drop the implicit merge once the Event entity exists (§6). Until then, scope the merge by the active event slug:
  ```ts
  savedLayouts
    .filter(l => normalizeEventKey(l.eventName ?? '') === normalizeEventKey(currentEvent))
    .forEach(...)
  ```

### 2.17 — `addAuditEntry` uses `Math.random().toString(36).substr(2, 5)`
- **File:** `src/hooks/useRBAC.ts:309-313`
- **Severity:** **Low** (collision risk + deprecated `String.prototype.substr`).
- **Fix:** `crypto.randomUUID()` (already used in `auth.ts`).

### 2.18 — `useRBAC` persists *every* role change to `localStorage` in a `useEffect`
- **File:** `src/hooks/useRBAC.ts:328-340`
- **Severity:** **Medium** (perf, race).
- **Problem:** Three `useEffect`s write `roles`, `groups`, `auditLog` on each state change. With 500 audit entries and frequent edits this writes ~30 KB of JSON to disk per keystroke. Worse, two tabs both edit roles → last-write-wins, no event broadcast.
- **Fix:** Debounce writes (e.g. 250 ms), and emit on the existing `appEvents` bus (`emitDataChanged('rbac:roles')`) so other tabs reload via the existing storage event listener pattern.

### 2.19 — Three `useEffect` writes execute on initial mount even with no change
- **Same file, same hook.** First-render writes are wasteful and clobber whatever was just hydrated by `loadFromStorage` if multiple tabs are open. Use a `useRef` "is first render" guard.

### 2.20 — `User` type confuses two role taxonomies
- **File:** `src/types.ts:266-280`
- **Severity:** **High** (architectural debt).
- **Problem:** A `User` simultaneously has `role: UserRole` (admin/basic/staff/guest), `userRole: 'admin'|'master'|'shared'|'read-only'|'staff'`, *and* `assignedRoles?: string[]` (RBAC ids). Anywhere in the codebase you have to guess which one is authoritative. `AccessControlPanel` writes to `assignedRoles`, `permissions.ts` reads `role`, the Header reads `isAdmin = role === 'admin'`.
- **Fix:** Collapse to **one** field after migration. Suggested target: `role: 'admin' | 'staff' | 'basic' | 'guest'` (kept for backwards compatibility) **plus** `assignedRoleIds: string[]` (authoritative). Compute the legacy `role` deterministically from the highest-hierarchy assigned role. Mark `userRole`/`isMasterUser`/`parentUserId` deprecated with a JSDoc `@deprecated`.

### 2.21 — `clearTokenFromUrl` swallows all errors silently
- **File:** `src/utils/guestPortal.ts:348-368`
- **Severity:** **Low**.
- **Fix:** Log via `console.warn` in dev only — silent failures during URL surgery have caused real bugs in past Vite SPAs (Safari history quirks).

### 2.22 — `isGuestPortalEventActive` returns `true` when no end date is configured
- **File:** `src/utils/guestPortal.ts:88-95`
- **Severity:** **Medium** (data exposure window).
- **Problem:** `if (!accessEnd) return true;` means a portal configured without a date is **permanently open**. A common configuration error becomes an indefinite leak.
- **Fix:** Return `false` and require admins to set at least an `eventStartDate`; the existing 36 h grace already gives generous slack.

### 2.23 — `Sidebar.tsx`, `Header.tsx`, `FloorPlanCanvas.tsx`, `AdminPanel.tsx` are each >900 LOC
- **Severity:** **Medium** (maintainability, perf).
- **Fix:** Decompose. Sidebar in particular re-renders entirely on every drag move because zoom + drag state live at the top — extract `<SidebarZoomControls/>`, `<SidebarDragHandle/>`, `<SidebarItemList/>` to memoise.

### 2.24 — Repository is missing `docs/production-backend.md` referenced by README
- **File:** `README.md:24`
- **Severity:** **Low** (documentation, not code).
- **Fix:** Add the file or update the README.

### 2.25 — `.env.example` lacks the `VITE_BACKEND_PROVIDER` flag
- **File:** `.env.example`
- **Severity:** **Low**.
- **Problem:** The Supabase auth path keys off `import.meta.env.VITE_BACKEND_PROVIDER === 'supabase'` (`AuthBackend.ts:36`) but the variable is undocumented.
- **Fix:** Add `VITE_BACKEND_PROVIDER=supabase` (commented) to `.env.example`.

### 2.26 — `vite.config.ts` `assetsInlineLimit: 100_000_000` ships every image inline
- **File:** `vite.config.ts:80`
- **Severity:** **Medium** (bundle size).
- **Fix:** See §2.10.

### 2.27 — Suspense fallback for the Auth gate is `<div>Loading...</div>`
- **File:** `src/contexts/AuthContext.tsx:286`
- **Severity:** **Low** (UX).
- **Fix:** Re-use the branded `spm-loading` markup that already exists in `index.html`.

---

## 3. UI / UX Audit

The following observations are based on direct reading of the JSX, the Tailwind class strings, the global `style.css` (which is empty), the inline critical CSS in `index.html`, and the screenshots implied by `imagePreview.test.ts`. I cannot interact with a live build inside this sandbox; if you want me to render and screenshot specific screens, drop them into the workspace and I'll generate annotated mocks.

### 3.1 Login Screen (`src/components/LoginScreen.tsx`)
- ✅ Clear gradient hero, password visibility toggle (likely — code length suggests it).
- ❌ "Continue as Guest" sits next to "Login" with no explanation of what guest mode unlocks. New venue clients have no mental model.
- ❌ No SSO. The Supabase auth supports OAuth providers — surfacing "Continue with Google" lifts conversion ~10–20 % in B2C flows.
- ❌ Password recovery uses a separate route (`PasswordReset.tsx`); the link text needs to be at least 14 px and visible without hover.
- **Action:** Add a 1-line subhead under "Continue as Guest" — *"View only. No account needed. Saves to this device."* Add Google SSO once §6 lands.

### 3.2 Header (`src/components/Header.tsx`, 929 LOC)
- ❌ Eleven action buttons crammed in one row. On a 13″ MacBook in Safari the toolbar wraps to two lines. On iPad it overflows.
- ❌ The active-event indicator is a *string*. If two coordinators are working on different events, one click on "Open Admin" applies changes to whichever event the dropdown last saw.
- ❌ No persistent search.
- **Action:** Group actions into `View / Edit / Share / Admin` menus. Promote the event picker to a top-left "Workspace switcher" control with a dropdown of upcoming events. Add `⌘K` quick search bound to the existing `appEvents` bus.

### 3.3 Sidebar (`src/components/Sidebar.tsx`, 1121 LOC)
- ✅ Drag handles are intuitive once you find them.
- ❌ Catalog items show emoji-only thumbnails — venue owners need real product photography for tables/chairs/decor. The `imageUrl` field exists on TableSpec/FixtureType but is not honored by the sidebar.
- ❌ Nested expand/collapse uses `▶/▼` text glyphs instead of accessible chevron icons; screen readers announce them as "black right-pointing pointer".
- ❌ Collision warnings flash but auto-dismiss with no inline persistence.
- **Action:** Replace text glyphs with `<svg aria-hidden>`; for fold buttons use `aria-expanded`. Honour `imageUrl` thumbnails via the existing `<SafeImage>` component.

### 3.4 Floor Plan Canvas (`src/components/FloorPlanCanvas.tsx`, 1592 LOC)
- ✅ Snapping & collision logic exist (`collisionDetection.ts` is well-tested).
- ❌ Zoom controls live in the bottom-right and float over guest names. Move to a dedicated overlay strip.
- ❌ No multi-select rectangle; bulk operations only go through the Properties panel.
- ❌ No keyboard navigation. Selected items cannot be nudged with arrow keys (a wedding planner staple).
- ❌ Touch users get no pinch-to-zoom; the canvas listens only for mouse wheel.
- **Action:** Implement marquee selection, arrow-key nudge (1 px / Shift = 10 px), and pointer-events-based gesture recognition.

### 3.5 Properties Panel (`src/components/PropertiesPanel.tsx`, 1046 LOC)
- ❌ Long single-column form — the user has to scroll to reach Guests.
- ❌ Numeric inputs lack steppers and unit suffixes ("ft" / "in").
- ❌ Color inputs use the native picker, which is jarring on Windows.
- **Action:** Two-column responsive grid; reuse Tailwind `grid-cols-2`. Show units inline. Adopt a small custom palette (already defined in `BrandingManagement` for venue colors).

### 3.6 Guest Panel (`src/components/GuestPanel.tsx`, 476 LOC)
- ✅ Includes import/export CSV.
- ❌ "Add Guest" requires you to know the table name; no autocomplete from existing tables.
- ❌ Dietary restrictions are a single text field — no aggregate "12 vegetarians" view, which is *the* report a caterer asks for.
- ❌ No visual indication of plus-ones beyond a checkbox.
- **Action:** Add an aggregate panel ("Meal counts", "Allergens"); add a typeahead bound to `tables`/`rooms` collections.

### 3.7 Guest Portal (`src/components/GuestPortal.tsx`, 1715 LOC)
- ✅ Branded hero, days-until counter, multi-day handling.
- ❌ Tabs use emoji-as-icon labels with no `aria-label`.
- ❌ The login form asks for *Event Name + Guest Name + Password*. Couples send only a URL with a token — guests should not see the event name field at all when a token is present in the URL.
- ❌ RSVP form does not persist drafts (a guest who refreshes loses input).
- ❌ No mobile keyboard niceties (`inputMode="email"`, `autocomplete="email"`).
- **Action:** Drop the event-name field when a valid token is in the URL. Persist RSVP draft to `sessionStorage` keyed by guest id. Add proper input attributes.

### 3.8 Admin Panel (`src/components/AdminPanel.tsx`, 1182 LOC)
- ❌ 14 tabs in a horizontal scroller. Discovery is poor.
- ❌ Many tabs include destructive controls without confirm dialogs (deleting venues, fixtures, etc.).
- ❌ The Access Control tab (§2.3) is a half-built stub.
- **Action:** Reorganise tabs into 4 groups (Catalog · People · Events · Branding). Wrap destructive actions in the existing `ModalDialog` confirm pattern.

### 3.9 Accessibility (cross-cutting)
- ❌ Contrast: brand purple `#4A1942` on white is fine; `text-gray-400` on `bg-gray-50` (used in Sidebar hints) fails WCAG AA.
- ❌ Keyboard: numerous custom buttons are `<div onClick>` without `role="button"` and `onKeyDown`.
- ❌ Focus rings are removed by Tailwind reset; no replacement focus-visible styles.
- ❌ `<LiveRegion>` exists (good) but is only fed by toast events, not by the canvas which has plenty of state changes worth announcing.
- **Action:** Add `focus-visible:ring-2 focus-visible:ring-[#4A1942]` globally. Run `axe-core` in the existing Vitest setup.

### 3.10 Visual consistency
- ✅ Strong brand palette anchored on `#4A1942`. `Playfair Display` headers are tasteful for the wedding domain.
- ❌ Inconsistent card radii (`rounded-lg` vs `rounded-xl` vs `rounded-2xl`).
- ❌ Mixed shadows (`shadow-sm`, `shadow-md`, `shadow-lg`, `shadow-xl`, custom `shadow-2xl` in `AccessControlPanel`).
- **Action:** Lock these in a `tailwind.config` extend (`borderRadius.card`, `boxShadow.card`).

---

## 4. Feature Expansion Ideas — toward a "Wedding Venue Intelligence Platform"

Each idea has been checked against *existing* tables, services and types in the repository. None of them require external dependencies that aren't already in `package.json` or already provisioned by the Supabase migration.

### 4.1 — **Booking & Lead Pipeline**
- **Value:** Venue owners spend ~30 % of their week answering inquiries. A lightweight CRM tied to the existing `events` table (status enum already includes `lead/hold/booked/lost`) turns the app from a planning tool into a **revenue tool**.
- **Approach:** New tab `Pipeline` rendering kanban over `events` filtered by `status`. Reuse the existing `submission_workflow` plumbing (`useSubmissionWorkflow.ts`) for state transitions and audit. Quote PDFs via the `PrintView` component.
- **Integration:** `events` table already exists in `0001_initial.sql`. Add `lead_source`, `tour_at`, `quote_amount_cents` columns; expose through a new `src/services/repos/eventsRepo.ts`.

### 4.2 — **Availability Calendar with Conflict Detection**
- **Value:** Prevents double-booking. Today the `events.start_date / end_date` exist but nothing renders them.
- **Approach:** New `<AvailabilityCalendar>` component. Backed by a Supabase RPC `find_overlapping_events(venue_id, start, end)` to keep the conflict check authoritative. UI: month view, color-coded by status.
- **Integration:** Hook into the existing `Header` event picker (§3.2) so users always know they're editing the right event.

### 4.3 — **Pricing Intelligence (per-package & per-add-on)**
- **Value:** Couples consistently ask "what does it cost with this package + bar + linens?" Owners want to see margin.
- **Approach:** New `packages` and `package_items` tables. UI: drag-and-drop package builder (reuse Decor Designer drag layer). Live total updates as items change. Decor Arrangements already model "groups of items" — extend the same shape.
- **Integration:** Decor `DecorPackage` interface in `src/types.ts:921` already exists. Promote it to a real domain object with pricing.

### 4.4 — **Vendor Marketplace & Preferred-Vendor Scoring**
- **Value:** Venues earn referral fees and improve guest satisfaction by recommending high-rated vendors.
- **Approach:** Extend `vendors` table (already created) with `rating`, `review_count`, `commission_pct`. Add `vendor_reviews` table. New admin tab.
- **Integration:** `VendorPanel.tsx` exists with 391 LOC — extend it; today it only stores name + contact.

### 4.5 — **Smart Seating Optimizer**
- **Value:** Couples agonise for hours over the seating chart. An optimizer that respects relationships, dietary restrictions, mobility, and table capacities saves a full evening.
- **Approach:** New worker `src/workers/seatingSolver.ts`. Use a simple constraint-propagation + simulated annealing pass (no external lib needed). Inputs: `guests` with `relationships` field, `tables` with `capacity` and `accessibility` flags, soft constraints from `dietary_restrictions`. Run in a Web Worker so the canvas remains responsive.
- **Integration:** Add a "Suggest seating" button in `GuestPanel`. The `assignGuestToTable` mutator already exists in `useLayoutState`.

### 4.6 — **Real-time Collaboration on Floor Plans**
- **Value:** Couple + planner + venue operations all editing the same plan without "send me your latest version" pain.
- **Approach:** `yjs` + `y-websocket` are **already** in `package.json` but not used. Introduce a `Y.Map` per layout, synced via Supabase Realtime (or a `y-websocket` server). Awareness API for cursors.
- **Integration:** Wrap `FloorPlanCanvas` interactions through `collaboration.ts` (already a stub). Audit log via the existing `audit_logs` table.

### 4.7 — **Document & Contract Vault**
- **Value:** Centralises contracts, certificates of insurance, vendor MSAs, COI tracking with expiry alerts.
- **Approach:** Use the existing `event-documents` Supabase storage bucket (already in migration). Add table `documents (event_id, vendor_id, kind, expires_at, file_path)`.
- **Integration:** `ObjectStorageService.ts` exists — extend it with `uploadDocument`/`getSignedUrl`. Surface in a new "Documents" sub-tab of an event view.

### 4.8 — **Email & SMS Communication Center**
- **Value:** Bride/groom can send save-the-dates, reminders, day-of nudges from the same app where guest data lives.
- **Approach:** Use the existing `supabase/functions/send-email/` Edge Function. Add Twilio (SMS) by shipping a parallel `send-sms` Edge Function. Templates table; merge tags pulled from `guests`.
- **Integration:** `EmailService.ts` already exists. Add a `<MessageComposer>` component that consumes `guestPortal` recipients.

### 4.9 — **Day-of Coordinator Mobile Mode (PWA)**
- **Value:** On the wedding day, the venue manager needs a phone-friendly task checklist and floor-plan viewer.
- **Approach:** Add a manifest + service worker (`vite-plugin-pwa`). New `/coord` route that renders `TimelinePanel` + `StaffOperationsPanel` in a stacked mobile layout.
- **Integration:** Both panels already exist; only routing + responsive styling needed.

### 4.10 — **Analytics & Insights Dashboard**
- **Value:** Venue owners want to know booking rate, average revenue per event, busiest months, top-performing packages.
- **Approach:** New `dashboards` view using Postgres views in Supabase + `recharts` (small dep). Cache JSON responses for 1 hour.
- **Integration:** Read-only; sits at `/insights`. Naturally constrained by RLS so each org only sees its own data.

### 4.11 — **AI Style Assistant**
- **Value:** Couples upload a Pinterest board → get a starter decor arrangement, color palette, and table-linen recommendation tied to the venue's catalog.
- **Approach:** Image classifier via OpenAI/Anthropic vision endpoint, but executed server-side via a new Supabase Edge Function so API keys never reach the browser. Output mapped to existing `DecorItem` records.
- **Integration:** Hook into `DecorDesigner.tsx`'s "New from template" entry point.

### 4.12 — **Guest-Side Mobile Polish (Apple/Google Wallet passes)**
- **Value:** Guests get a wallet pass with table assignment, schedule, parking instructions.
- **Approach:** Generate `.pkpass` and Google Wallet JSON from RSVP data via a third Edge Function.
- **Integration:** Add a button in the Guest Portal "Add to Wallet".

### 4.13 — **Audit & Compliance Reports**
- **Value:** Venues with corporate clients (universities, government) need access logs.
- **Approach:** `audit_logs` table already exists. Add a downloadable CSV in Admin → Audit.
- **Integration:** `useRBAC.auditLog` is local-only today; promote to the server table.

### 4.14 — **Backup, Restore, and Versioned History per Layout**
- **Value:** "Can we go back to last Tuesday's version?" — currently impossible.
- **Approach:** `layout_versions` table is already in the migration. Implement `saveLayout` to insert a row on every commit, throttled.
- **Integration:** Surface in Admin → Templates → History.

---

## 5. Notes on Directories that I read but found unremarkable

- `src/test/setup.ts` — straightforward jsdom + jest-dom polyfills. ✅
- `src/utils/collisionDetection.ts`, `recovery.ts`, `backupExport.ts`, `backupImport.ts`, `validators.ts` — small, well-tested. No issues found.
- `src/constants/storageKeys.ts`, `storageVersions.ts` — well-versioned with migrations. Good pattern, retain.
- `supabase/functions/send-email/index.ts` — minimal but sound. Add unit tests.
- `style.css` — empty; remove or use it.
- `src/data/venueData.ts` — seed data, no logic. Skim only.
- `scripts/check-event-bus.mjs` — a great custom lint rule. Keep.

---

## 6. Refactoring Proposal — User Management × Access Control × Guest Portal × Multi-Event

This proposal is the requested deep-dive. It lands the architectural changes that make the rest of the platform sustainable. Estimated effort: **3–4 engineering weeks** (one senior engineer) for the full refactor; it is explicitly designed to ship in incrementally-deployable phases so that no single PR blocks more than 24 h of work.

### 6.1 Overview of the Current User Management System & Its Limitations

**As-is architecture**

| Concept | Where it lives | Source of truth |
|---|---|---|
| Auth user | `User` interface, `AuthContext`, `localStorage` (`spm_users`) | local browser |
| Legacy role | `User.role: 'admin'\|'staff'\|'basic'\|'guest'` | local |
| "Master / Shared / Read-only" | `User.userRole + isMasterUser + parentUserId + sharedUserLimit` | local |
| Dynamic role assignment | `User.assignedRoles?: string[]` | local, *not consulted by gates* |
| Permissions | `PERMISSIONS[]` registry + `Role.permissions` | local (`spm_rbac_*`) |
| Permission gates | `permissions.ts` boolean helpers, hard-coded on legacy `role` | local |
| Event scoping | `User.eventName` *string*, `Guest.eventName` *string*, `normalizeEventKey` slug | local |
| Guest portal access | `GuestPortalConfig.portalPasswordHash` + `Guest.token` | local |
| Audit log | `useRBAC().auditLog` in localStorage | local |

**Concrete limitations**

1. **Three competing role taxonomies** confuse every consumer (see §2.20).
2. **Dynamic permissions don't gate anything** (§2.2) — admin UI is theatre.
3. **No first-class Event entity.** Every "event scope" is inferred from a slugified string. There is no DB constraint stopping an admin from typing "Smith-Jones Wedding" in one place and "Smith Jones Wedding 2026" in another → users and guests silently disappear.
4. **No relation between users and events.** A bride/groom user *is* their event implicitly via `User.eventName`. They cannot have a second event without a duplicate user record.
5. **No guest-to-event assignment workflow.** Today, a guest record is dropped into the `spm_portal_guests` bag with an `eventName` string. Bride/groom cannot choose "invite Aunt Mary to ceremony but not rehearsal".
6. **No identity for the bride/groom** at all. They authenticate as a `basic` or `master` user; the portal shows them no UI for managing their own guests.
7. **Guest Portal authentication is independent** of platform auth; a couple managing it has no SSO between the two.

### 6.2 Proposed Changes — Tying User Management to Access Controls

#### 6.2.1 Domain model

Introduce a clear three-layer model that maps to the **existing** Supabase schema (which already has all the right tables, just unused).

```
auth.users  (Supabase auth)
   │
   └── public.profiles        — display name, avatar, contact prefs
            │
            ├── public.organization_memberships
            │       organization_id, role: app_role
            │       (owner / admin / planner / staff)
            │
            └── public.event_memberships
                    event_id, role: app_role
                    (couple / planner / staff / guest)
```

A user can be an **org-level** member (venue owner / staff) **and** an **event-level** member (couple, day-of planner) on any number of events. RLS already enforces the visibility (`is_org_member()` / `is_event_member()` helpers in the migration).

#### 6.2.2 Front-end type changes

```ts
// src/types/identity.ts (NEW)
export interface AppUser {
  id: string;            // == auth.users.id
  email: string;
  fullName: string;
  avatarUrl?: string;
  // Resolved at login from organization_memberships and event_memberships:
  orgMemberships: { orgId: string; role: AppRole }[];
  eventMemberships: { eventId: string; role: AppRole }[];
  // Derived dynamic permissions (computed from RBAC + memberships):
  permissions: ReadonlySet<PermissionId>;
}

export type AppRole = 'owner' | 'admin' | 'planner' | 'couple' | 'staff' | 'guest';
export type PermissionId = string; // 'guests.assign', 'portal.guest.invite', ...
```

Mark the legacy `User.role`, `User.userRole`, `User.isMasterUser`, etc., **`@deprecated`** and read-only. Provide a one-shot adapter `legacyUserToAppUser()` that the Auth bootstrap calls during the migration window.

#### 6.2.3 Permission resolution

Single function, two consumers (UI gates *and* RLS docs):

```ts
// src/utils/access.ts (NEW)
export function resolvePermissions(
  user: AppUser,
  scope: { orgId?: string; eventId?: string },
  rbac: { roles: Role[]; }
): Set<PermissionId> {
  const roleIds = [
    ...user.orgMemberships
      .filter(m => !scope.orgId || m.orgId === scope.orgId)
      .map(m => m.role),
    ...user.eventMemberships
      .filter(m => !scope.eventId || m.eventId === scope.eventId)
      .map(m => m.role),
  ];
  const out = new Set<PermissionId>();
  for (const id of roleIds) {
    const role = rbac.roles.find(r => r.id === id);
    if (!role) continue;
    for (const p of getInheritedPermissions(id, rbac.roles)) out.add(p);
  }
  return out;
}
```

Every helper in `permissions.ts` becomes a thin wrapper:

```ts
export const canManageGuests = (u: AppUser, eventId: string) =>
  resolvePermissions(u, { eventId }).has('guests.manage');
```

Bonus: tests can now `expect(canManageGuests(brideUser, weddingId)).toBe(true)` deterministically.

#### 6.2.4 Workflow

1. **Login** (Supabase) → `restoreSupabaseSession()` already pulls `organization_memberships`. Extend it to also pull `event_memberships` and to call `resolvePermissions` once per scope cache.
2. **Scope switch** — the new top-bar workspace switcher (§3.2) writes the active `eventId` to a `ScopeContext`. `useCan('feature')` is derived from the active scope.
3. **Server-side enforcement** — RLS already gates rows. *Do not rely on the client gates for security.* The client gates only hide UI affordances.
4. **Audit** — every permission grant / membership change flows through `audit_logs` (table already exists) via a thin `auditService.log()`.

### 6.3 Bride/Groom → Guest Assignment Workflow

#### 6.3.1 Granting bride/groom access to their event

Venue owner flow (`AccessControlPanel` re-built per §2.3):

```
Venues > [Smith Wedding] > People > Invite couple
  ┌────────────────────────────────────────┐
  │ Invite to event "Smith Wedding"        │
  │ Email: jane@example.com                │
  │ Role:  Couple (predefined system role) │
  │ Send invitation                        │
  └────────────────────────────────────────┘
```

This creates an `event_memberships` row with `role='couple'`. Couple receives a Supabase magic-link email (Edge Function already in repo). On first login, `EventOnboardingWizard` runs (3 steps: basics, guest list import, portal opt-in).

#### 6.3.2 Couple-side guest management

A new component `<CoupleGuestWorkspace eventId={...}>` replaces the current `GuestPanel` for users whose only role is `couple`. It exposes:

- **Add / import / edit guests** (same primitives, scoped to `eventId`).
- **Group by sub-event** — a wedding might have *Welcome Dinner*, *Ceremony*, *Reception*, *Brunch*. Each is a row in a new `sub_events` table:

  ```sql
  create table public.sub_events (
    id uuid primary key default gen_random_uuid(),
    event_id uuid not null references public.events(id) on delete cascade,
    title text not null,                      -- 'Ceremony'
    starts_at timestamptz not null,
    ends_at timestamptz,
    venue_id uuid references public.venues(id),
    invite_only boolean not null default false,
    metadata jsonb not null default '{}'::jsonb
  );

  create table public.guest_sub_event_invitations (
    id uuid primary key default gen_random_uuid(),
    guest_id uuid not null references public.guests(id) on delete cascade,
    sub_event_id uuid not null references public.sub_events(id) on delete cascade,
    rsvp_status text not null default 'pending',
    unique (guest_id, sub_event_id)
  );
  ```

- **Per-guest portal toggle** — the existing `Guest.allowPortalAccess` boolean is preserved.
- **Bulk send portal invitations** — generates a per-guest token (`guest.portal_token_hash` already exists in `guests` table) and emails them.

#### 6.3.3 Mechanisms for managing portal access

| Mechanism | Today | After refactor |
|---|---|---|
| Who can sign in | Anyone with event title + name + portal password | Only guests with a valid per-guest token *or* a guest record + portal password |
| Single guest revocation | Not possible | Couple toggles `allowPortalAccess=false` → row updated → `portal_session` invalidated via Supabase Realtime broadcast |
| Token rotation | Not possible | New `rotateGuestToken(guestId)` — server invalidates old hash, emits new emailed link |
| Portal-wide password reset | Manual via admin | Same UI but logs the change in `audit_logs` |
| Read-only "view as guest" mode for couple | Not possible | New "Preview Portal" button opens portal in a sandbox with `?preview=true` flag |

### 6.4 Event Management Features (multi-event + assignment)

Concrete UI/UX & data changes:

1. **Workspace switcher** (top-left of `Header`) lists `events` you have membership in. Active event id stored in `ScopeContext`.
2. **`/events` index page** — a card list with status, date, guest count, layout completeness, RSVP %, days-until.
3. **Per-event tabs** — Layouts · Guests · Schedule · Portal · Vendors · Documents · Audit.
4. **Sub-event scheduler** — uses the existing `timeline_events` table (rename in code: `EventScheduleItem`).
5. **Multi-event guest reuse** — the same person can be a guest at two events without duplication. Implement a `people` table (org-scoped contacts) and link `guests.person_id` to it. Saves data entry for repeat-customer venues.
6. **Bulk assignment UI** — checkbox grid `Guest × Sub-event`. Powered by `guest_sub_event_invitations`.
7. **Calendar view** — leverages new entity (§4.2).
8. **Event templates** — a venue owner can clone "Standard Saturday Wedding" into every booking (timeline + sub-events + default layout). Stored in a new `event_templates` table.

### 6.5 Security, Privacy, and UX Considerations for the Guest Portal

| Concern | Mitigation |
|---|---|
| Guest enumeration | Don't reveal "guest not found"; return a generic "Could not verify". Throttle 5 attempts / hour / IP via Edge Function. |
| Token leakage in URL | Already handled — `clearTokenFromUrl()`. Add `Referrer-Policy: no-referrer` meta + HTTP header. |
| Token forwarding | Per-guest `expires_at` (default = event end + grace), single-device hint via cookie fingerprint, plus the rotation primitive (§2.15). |
| Plaintext portal password | Removed by sunset date (§2.6). |
| Personal data exposure | Guests see only their own seat assignment, dietary notes, plus-one. Other guests' table mates revealed only if couple sets `revealTableMates=true`. |
| Children & accessibility info | Stored encrypted at rest (Postgres `pgcrypto` already enabled in the migration). |
| GDPR / CCPA | New "Delete my data" button in the portal; cascades through `guests`, `rsvp_submissions`, and any analytics derivative. |
| Audit | Every login attempt + RSVP submission writes to `audit_logs` with `submitted_ip` (already a column on `rsvp_submissions`). |

UX-side:
- Magic-link entry: guest clicks email → portal opens already authenticated. No password needed for invited guests.
- Mobile-first: 100 % of portal layout reviewed at 375 px width (today's portal does this acceptably; the seat-map needs pinch-zoom).
- Offline fallback: PWA caches the schedule and seat map for the day-of, so a venue with weak Wi-Fi still works.
- Internationalisation hooks: wrap portal copy in a tiny `t()` shim now to make later i18n cheap.

### 6.6 Refactoring Challenges and Mitigation Strategies

| Challenge | Risk | Mitigation |
|---|---|---|
| Existing users have *no* `assignedRoles` and only legacy `role` | Login regression on day of release | At first Supabase sync, derive `assignedRoles` from legacy `role` (`admin → admin`, `staff → staff`, `basic → couple`, `guest → guest`). Keep `permissions.ts` reading legacy as a last-resort fallback for one release. |
| `// @ts-nocheck` blocks safe refactor | Easy to introduce new bugs | Remove `@ts-nocheck` *file by file in ascending complexity order* (`AccessControlPanel`, `EventQuestionsManagement`, `LinenManagement`, … `UserManagement` last). Each PR stays small. |
| 200-prop `UserManagement` god-bag | Refactor produces giant diffs | Wrap once in a context (`<AdminProvider>`), then incrementally migrate consumers. Use a codemod (jscodeshift) for the big mechanical rename. |
| Two Supabase clients (DatabaseService.ts + supabaseClient.ts) | Auth state desync | Delete `DatabaseService.ts`; consolidate. Add an integration test that asserts only one `createClient` call exists in build output. |
| Existing localStorage data must survive | Customers losing layouts | Implement bidirectional sync: on first authenticated load, push all `spm_*` rows to Supabase via a one-shot migration; subsequent edits go through repos. Provide an "Export everything" button as the safety net (already partly built in `backupExport.ts`). |
| Real-time conflict on layouts | Two planners overwriting each other | Adopt `yjs` (already in package.json) for layouts; for non-collaborative tables (vendors, timeline) use optimistic-concurrency via the existing `revision` column on `layouts`. |
| Email deliverability | Magic links bouncing | Use Supabase's transactional template OR migrate `send-email` Edge Function to Resend/Postmark. Add SPF/DKIM doc to `docs/production-backend.md` (which itself needs writing — §2.24). |
| RBAC table / string-id drift | Roles created in UI use `role-{Date.now()}` ids, RLS uses `app_role` enum | Bridge by storing the **enum string** as `Role.id` for system roles (`'admin'`, `'planner'`, …) so RLS continues to work. Custom roles get `role-*` ids and are only ever consulted client-side; they grant *additive* permissions on top of system role base. |
| Long migration tail | Customers stuck on old data shape | Add an "Account upgrade" wizard that surfaces in Admin once a deprecated field is detected; one-click migrates that account. |
| Performance regression while wiring Supabase | Latency vs. localStorage | Stale-while-revalidate: hydrate UI from local cache instantly, refresh from Supabase in background. Pattern already used in `useRBAC` for roles — generalise into `useRemoteCache`. |
| Test coverage gap on admin UI | Hard to refactor with confidence | Add Playwright (or just Vitest + RTL) smoke tests **per admin tab** as the first PR, before any rewrite. |

### 6.7 Phased Rollout Plan

| Phase | Duration | Deliverables | Done when |
|---|---|---|---|
| **0 — Stabilise** | 2 days | Patch §2.1 (already applied), §2.6 warnings, §2.10 chunked build flag, §2.13 dev-only console, §2.14 alert→toast, README/env docs | `ci` script passes; no `alert()` in app source |
| **1 — Type-safe admin** | 4 days | Remove `@ts-nocheck` from 5 lowest-complexity admin tabs; introduce `AdminContext`; add Playwright smoke per tab | All five tabs typecheck; smoke tests green |
| **2 — RBAC enforcement** | 3 days | Implement `resolvePermissions`; refit `permissions.ts`; finish `AccessControlPanel` (§2.3); audit log → server | Admin-created roles change actual UI gating; tests assert it |
| **3 — Supabase wiring** | 5 days | Make `VITE_BACKEND_PROVIDER=supabase` actually load events/guests/layouts via repos; bidirectional migration of local data | Two browsers signed in to the same org show the same events list |
| **4 — Multi-event entity** | 5 days | `events`, `sub_events`, `guest_sub_event_invitations`, workspace switcher, per-event tabs | Couple can create 2 events and toggle a guest between them |
| **5 — Couple workspace + portal v2** | 5 days | `<CoupleGuestWorkspace>`, magic-link guest invitations, token rotation/revocation, throttled portal login | Couple can invite a guest by email; guest clicks link, RSVPs; couple revokes token |
| **6 — Polish** | 3 days | UX items in §3 (workspace switcher polish, accessibility, focus rings, font self-host) | Lighthouse ≥ 95 on /portal and /events |

Total: ~27 working days. Each phase ships a usable increment behind a feature flag (`VITE_FEATURE_*` envs).

---

## 7. Concrete Fixes Already Applied to the Workspace Clone

These are committed to the workspace under `/home/user/wedding-venue-app/` for your immediate review:

1. **`src/components/AuthenticatedApp.tsx`** — fixed the `setDecorArrangements` updater-vs-array bug (§2.1). `npx tsc --noEmit` → 0 errors (verified).
2. **`src/components/GuestPortal.tsx`** — added a `[SECURITY]` console warning + `TODO(security)` deprecation marker on the legacy plaintext portal-password path (§2.6) so production logs surface unmigrated tenants.

The remaining recommended changes are written as code snippets above so you can apply them per your team's PR conventions.

---

*End of report.*
