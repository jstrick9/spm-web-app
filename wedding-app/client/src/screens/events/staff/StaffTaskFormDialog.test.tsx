import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffTaskFormDialog } from './StaffTaskFormDialog';

vi.mock('../../../sdk', () => ({
  sdk: {
    staff: {
      createTask: vi.fn().mockResolvedValue({ task: { id: 't1' } }),
      updateTask: vi.fn().mockResolvedValue({ task: { id: 't1' } }),
    },
  },
}));
vi.mock('../../../ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('StaffTaskFormDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders form fields when open in create mode', () => {
    render(<StaffTaskFormDialog open={true} onOpenChange={vi.fn()} organizationId="org1" eventId="e1" task={null} />, { wrapper: wrap() });
    expect(screen.getByText(/task title/i)).toBeTruthy();
    expect(screen.getByText(/phase/i)).toBeTruthy();
    expect(screen.getByText(/priority/i)).toBeTruthy();
  });

  it('does not render when closed', () => {
    const { container } = render(<StaffTaskFormDialog open={false} onOpenChange={vi.fn()} organizationId="org1" eventId="e1" task={null} />, { wrapper: wrap() });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('has create button', () => {
    render(<StaffTaskFormDialog open={true} onOpenChange={vi.fn()} organizationId="org1" eventId="e1" task={null} />, { wrapper: wrap() });
    const btns = screen.getAllByRole('button');
    const createBtn = btns.find(b => b.textContent?.includes('Create') || b.textContent?.includes('Save') || b.textContent?.includes('Add'));
    expect(createBtn).toBeTruthy();
  });
});
