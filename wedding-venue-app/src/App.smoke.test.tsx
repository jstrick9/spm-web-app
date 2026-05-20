import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

/**
 * Re-enabled smoke test (was previously skipped with `describe.skip`).
 *
 * Two of the three contracts the original test wanted to assert can now run
 * here without hanging jsdom:
 *   1. Renders the LoginScreen when there is no session.
 *   2. Renders the GuestPortal route when the URL hash points at it.
 *
 * The third contract — "AuthenticatedApp mounts and the typed event bus opens
 * the Decor Designer" — is still too heavy to mount under jsdom because
 * `useLayoutState` + `Header` + `Sidebar` + `FloorPlanCanvas` together pull in
 * thousands of LOC of SVG / canvas code that JSDOM struggles with.  That
 * contract is still covered, but at the right granularity:
 *
 *   - `src/utils/appEvents.test.ts`           — typed bus delivery contract
 *   - `src/hooks/useAppModals.test.ts`        — modal opener subscribes & flips
 *     state when `spm_open_decor_designer` fires (regression test for the
 *     original Decor Designer bug)
 *   - `src/components/DecorDesigner.test.tsx` — the modal itself works once
 *     mounted (multi-select, duplicate, rulers, keyboard shortcuts)
 *
 * Together those three files prove the same end-to-end contract that an
 * AuthenticatedApp render would, without paying jsdom's full mount cost.
 *
 * NOTE (lazy-load): GuestPortal is now React.lazy(). Vitest's module mock
 * interceptor works on the ES-module graph, so vi.mock still works but the
 * Suspense boundary in AppContent means we must await the resolved state with
 * waitFor / findBy* queries.
 */

// Mock the lazy-loaded GuestPortal module – Vitest resolves the mock before
// the dynamic import fires so the component renders synchronously in jsdom.
vi.mock('./components/GuestPortal', () => ({
  default: () => <div data-testid="guest-portal-stub">GUEST_PORTAL</div>,
}));

import App from './App';

describe('App smoke', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.hash = '';
  });

  it('renders the LoginScreen when no session exists', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /seven paths manor/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('routes to the GuestPortal when the URL hash points at it', async () => {
    window.location.hash = '#/guest-portal';
    render(<App />);
    // GuestPortal is React.lazy() – wait for the Suspense boundary to resolve.
    expect(await screen.findByTestId('guest-portal-stub')).toBeInTheDocument();
    // And does NOT fall through to the LoginScreen.
    expect(screen.queryByRole('button', { name: /sign in/i })).not.toBeInTheDocument();
  });

  it.skip(
    'mounts the AuthenticatedApp shell (still too heavy for jsdom — see file header)',
    () => {
      // Intentionally skipped. See module docstring above for the layered test
      // strategy that covers this contract without paying the jsdom mount cost.
    },
  );
});
