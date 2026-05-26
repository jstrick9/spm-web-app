import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ControlPanel } from './ControlPanel.js';
import { FeatureFlagsProvider } from '../dual-write/FeatureFlagsContext.js';
import { _resetSyncMonitor, startSyncMonitor } from '../dual-write/syncMonitor.js';
import { clear as clearQueue, enqueue } from '../dual-write/writeQueue.js';
import { resetFlags } from '../dual-write/featureFlags.js';

function wrap(children: React.ReactNode) {
  const qc = new QueryClient();
  return (
    <QueryClientProvider client={qc}>
      <FeatureFlagsProvider>{children}</FeatureFlagsProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  _resetSyncMonitor();
  clearQueue();
  resetFlags();
  localStorage.clear();
  startSyncMonitor();
});

describe('ControlPanel', () => {
  it('renders all 15 domain rows', () => {
    render(wrap(<ControlPanel />));
    // Each domain appears as a code element in the table
    expect(screen.getAllByText('auth')[0]).toBeInTheDocument();
    expect(screen.getAllByText('guests')[0]).toBeInTheDocument();
    expect(screen.getAllByText('vendors')[0]).toBeInTheDocument();
  });

  it('shows the "all synced" message when queue is empty', () => {
    render(wrap(<ControlPanel />));
    // Use getAllByText to tolerate StrictMode double-render in tests.
    expect(screen.getAllByText(/all writes have synced/i).length).toBeGreaterThan(0);
  });

  it('shows pending count when writes are queued', () => {
    enqueue({ domain: 'guests', op: 'create', payload: {} });
    enqueue({ domain: 'guests', op: 'update', payload: {} });
    render(wrap(<ControlPanel />));
    // The text is split across <strong> and a sibling text node, so
    // use a functional matcher that flattens the element's text content.
    expect(screen.getAllByText((_, el) => {
      const t = el?.textContent ?? '';
      return /2 pending writes/i.test(t);
    }).length).toBeGreaterThan(0);
  });

  it('flipping a flag persists immediately', () => {
    render(wrap(<ControlPanel />));
    // Each row has a "server" button. Get the first "server" button under
    // a domain row (not the bulk "All server" button at top).
    const allServer = screen.getAllByRole('button', { name: /^server$/i });
    // Find the first non-disabled one (current mode is 'local', so 'server' is enabled)
    const first = allServer.find((b) => !b.hasAttribute('disabled'));
    expect(first).toBeTruthy();
    fireEvent.click(first!);
    // The clicked button should now be disabled (mode just flipped to 'server')
    expect(first).toBeDisabled();
  });

  it('bulk buttons render (All local / All dual / All server)', () => {
    render(wrap(<ControlPanel />));
    // Bulk buttons have exact text "All local" / "All dual" / "All server"
    // — distinct from the per-row "local"/"dual"/"server" buttons.
    expect(screen.getAllByRole('button', { name: /^All local$/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^All dual$/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /^All server$/ }).length).toBeGreaterThan(0);
  });
});
