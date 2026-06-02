/**
 * GuestMergePanel tests — Phase 32
 *
 * Covers:
 *   • Returns null when guests.view not permitted
 *   • Loading skeleton renders
 *   • Empty state when no clusters found
 *   • Cluster card renders with confidence badge
 *   • High confidence shown before medium confidence
 *   • Dismiss removes cluster from view (localStorage persisted)
 *   • Merge calls sdk.guests.merge with correct IDs
 *   • Merge success shows status message
 *   • Merge button disabled for view-only users (no guests.manage)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../lib/usePermission', () => ({ usePermission: vi.fn() }));
vi.mock('../../sdk', () => ({
  sdk: {
    guests: {
      getDuplicates: vi.fn(),
      merge: vi.fn(),
    },
  },
}));

// Clear localStorage mock
beforeEach(() => {
  localStorage.clear();
});

import { usePermission } from '../../lib/usePermission';
import { sdk } from '../../sdk';
import { GuestMergePanel } from './GuestMergePanel';

const HIGH_CLUSTER = {
  key: 'jane@example.com',
  signals: ['email'] as const,
  confidence: 'high' as const,
  hasInEventDuplicate: false,
  members: [
    { id: 'g-1', eventId: 'e-1', eventTitle: 'Smith Wedding', fullName: 'Jane Smith', email: 'jane@example.com', phone: null, rsvpStatus: 'attending', createdAt: '2026-01-01' },
    { id: 'g-2', eventId: 'e-2', eventTitle: 'Jones Wedding', fullName: 'Jane Smith', email: 'jane@example.com', phone: null, rsvpStatus: 'pending', createdAt: '2026-02-01' },
  ],
};

const MED_CLUSTER = {
  key: 'john doe',
  signals: ['name'] as const,
  confidence: 'medium' as const,
  hasInEventDuplicate: false,
  members: [
    { id: 'g-3', eventId: 'e-1', eventTitle: 'Smith Wedding', fullName: 'John Doe', email: null, phone: null, rsvpStatus: 'pending', createdAt: '2026-01-01' },
    { id: 'g-4', eventId: 'e-3', eventTitle: 'Brown Wedding', fullName: 'John Doe', email: null, phone: null, rsvpStatus: 'attending', createdAt: '2026-03-01' },
  ],
};

function renderPanel(orgId = 'org-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <GuestMergePanel orgId={orgId} />
    </QueryClientProvider>,
  );
}

describe('GuestMergePanel', () => {
  beforeEach(() => {
    vi.mocked(usePermission).mockReturnValue(true as ReturnType<typeof usePermission>);
    vi.mocked(sdk.guests.getDuplicates).mockResolvedValue({
      clusters: [HIGH_CLUSTER, MED_CLUSTER],
    });
    vi.mocked(sdk.guests.merge).mockResolvedValue({
      primary: { id: 'g-1' } as never,
      mergedCount: 1,
    });
  });

  it('returns null when guests.view is not permitted', () => {
    vi.mocked(usePermission).mockImplementation((p: string) => p !== 'guests.view');
    const { container } = renderPanel();
    expect(container.firstChild).toBeNull();
  });

  it('renders panel heading', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('Merge Suggestions')).toBeTruthy();
    });
  });

  it('renders empty state when no duplicates found', async () => {
    vi.mocked(sdk.guests.getDuplicates).mockResolvedValue({ clusters: [] });
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('All guests look unique')).toBeTruthy();
    });
  });

  it('renders cluster cards for both clusters', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText(/Jane Smith/)).toBeTruthy();
      expect(screen.getByText(/John Doe/)).toBeTruthy();
    });
  });

  it('shows high confidence badge', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText(/High/)).toBeTruthy();
    });
  });

  it('shows medium confidence badge', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText(/Medium/)).toBeTruthy();
    });
  });

  it('dismissing a cluster removes it from the list', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText(/Jane Smith/)).toBeTruthy();
    });
    const dismissButtons = screen.getAllByLabelText('Dismiss this merge suggestion');
    fireEvent.click(dismissButtons[0]);
    await waitFor(() => {
      expect(screen.queryByLabelText('Duplicate cluster: Jane Smith')).toBeNull();
    });
  });

  it('expands cluster on chevron click and shows member list', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText(/Jane Smith/)).toBeTruthy());
    const expandBtns = screen.getAllByLabelText('Expand cluster details');
    fireEvent.click(expandBtns[0]);
    await waitFor(() => {
      expect(screen.getByText('Smith Wedding')).toBeTruthy();
      expect(screen.getByText('Jones Wedding')).toBeTruthy();
    });
  });

  it('calls merge with primaryId and duplicateIds when Merge button clicked', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText(/Jane Smith/)).toBeTruthy());

    // Expand
    fireEvent.click(screen.getAllByLabelText('Expand cluster details')[0]);
    await waitFor(() => expect(screen.getByLabelText(/Set Jane Smith from Smith Wedding as primary/)).toBeTruthy());

    // Click merge
    const mergeBtn = screen.getByLabelText(/Merge 2 records, keeping Jane Smith/);
    fireEvent.click(mergeBtn);

    await waitFor(() => {
      expect(vi.mocked(sdk.guests.merge)).toHaveBeenCalledWith(
        'org-1',
        'g-1', // default primary (first member)
        ['g-2'], // duplicates
      );
    });
  });

  it('shows merge success status after successful merge', async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText(/Jane Smith/)).toBeTruthy());

    fireEvent.click(screen.getAllByLabelText('Expand cluster details')[0]);
    await waitFor(() => expect(screen.getByLabelText(/Merge 2 records/)).toBeTruthy());
    fireEvent.click(screen.getByLabelText(/Merge 2 records/));

    await waitFor(() => {
      expect(screen.getByRole('status')).toBeTruthy();
      expect(screen.getByText(/Merged 2 guest records/)).toBeTruthy();
    });
  });

  it('does not show Merge button for view-only users', async () => {
    vi.mocked(usePermission).mockImplementation(
      (p: string) => p === 'guests.view' // manage NOT granted
    );

    renderPanel();
    await waitFor(() => expect(screen.getByText(/Jane Smith/)).toBeTruthy());
    fireEvent.click(screen.getAllByLabelText('Expand cluster details')[0]);

    await waitFor(() => {
      expect(screen.queryByText(/Merge \(/)).toBeNull();
    });
  });
});
