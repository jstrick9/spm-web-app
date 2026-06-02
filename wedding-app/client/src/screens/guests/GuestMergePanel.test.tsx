import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GuestMergePanel } from './GuestMergePanel';

const duplicatesMock = vi.fn();
const mergeMock = vi.fn().mockResolvedValue({ primary: {}, mergedCount: 1 });

vi.mock('../../sdk', () => ({
  sdk: { guests: {
    duplicates: (...a: unknown[]) => duplicatesMock(...a),
    merge: (...a: unknown[]) => mergeMock(...a),
  } },
}));
vi.mock('../../ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
let canManage = true;
vi.mock('../../lib/usePermission', () => ({ usePermission: () => canManage }));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const CLUSTER = {
  key: 'jane@x.com', signals: ['email'], confidence: 'high', hasInEventDuplicate: false,
  members: [
    { id: 'g1', eventId: 'e1', eventTitle: 'Wedding A', fullName: 'Jane Doe', email: 'jane@x.com', phone: null, rsvpStatus: 'attending', createdAt: '2026-01-01' },
    { id: 'g2', eventId: 'e2', eventTitle: 'Wedding B', fullName: 'Jane D.', email: 'jane@x.com', phone: null, rsvpStatus: 'pending', createdAt: '2026-02-01' },
  ],
};

beforeEach(() => {
  canManage = true;
  vi.clearAllMocks();
  duplicatesMock.mockResolvedValue({ clusters: [CLUSTER] });
});

describe('GuestMergePanel', () => {
  it('renders a duplicate cluster and its members when expanded', async () => {
    render(<GuestMergePanel orgId="org1" />, { wrapper: wrap() });
    const toggle = await screen.findByText(/Possible Duplicate Guests/i);
    fireEvent.click(toggle);
    expect(await screen.findByText('Wedding A')).toBeInTheDocument();
    expect(screen.getByText('Wedding B')).toBeInTheDocument();
    expect(screen.getAllByText('jane@x.com').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('high')).toBeInTheDocument();
  });

  it('merges the selected primary with the others on confirm', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<GuestMergePanel orgId="org1" />, { wrapper: wrap() });
    fireEvent.click(await screen.findByText(/Possible Duplicate Guests/i));
    const btn = await screen.findByRole('button', { name: /Merge into selected/i });
    fireEvent.click(btn);
    await waitFor(() => expect(mergeMock).toHaveBeenCalledWith('org1', 'g1', ['g2']));
  });

  it('renders nothing when there are no duplicates', async () => {
    duplicatesMock.mockResolvedValue({ clusters: [] });
    const { container } = render(<GuestMergePanel orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => expect(duplicatesMock).toHaveBeenCalled());
    expect(container.querySelector('*')?.textContent ?? '').not.toMatch(/Possible Duplicate Guests/i);
  });

  it('hides merge controls without guests.manage', async () => {
    canManage = false;
    render(<GuestMergePanel orgId="org1" />, { wrapper: wrap() });
    fireEvent.click(await screen.findByText(/Possible Duplicate Guests/i));
    await screen.findByText('Wedding A');
    expect(screen.queryByRole('button', { name: /Merge into selected/i })).toBeNull();
    expect(screen.getByText(/need the guests.manage permission/i)).toBeInTheDocument();
  });
});
