import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventSettingsForm } from './EventSettingsForm';

const mockEvent = {
  id: 'evt1',
  organization_id: 'org1',
  title: 'Smith Wedding',
  slug: 'smith-wedding',
  status: 'planning' as const,
  start_date: '2026-09-15',
  end_date: '2026-09-15',
  guest_count: 150,
  primary_contact_user_id: null,
  budget_cents: 2500000,
  metadata: '{}',
  created_at: '2026-01-01',
};

// vi.mock factories must not reference variables declared in the same scope
// (they are hoisted). Inline the mock object directly.
vi.mock('../../../sdk', () => ({
  sdk: {
    events: {
      get: vi.fn().mockResolvedValue({
        event: {
          id: 'evt1', organization_id: 'org1', title: 'Smith Wedding',
          slug: 'smith-wedding', status: 'planning', start_date: '2026-09-15',
          end_date: '2026-09-15', guest_count: 150, primary_contact_user_id: null,
          budget_cents: 2500000, metadata: '{}', created_at: '2026-01-01',
        },
      }),
      update: vi.fn().mockResolvedValue({ event: { id: 'evt1', title: 'Updated' } }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  },
  ApiError: class extends Error { code = 'unknown'; kind = 'http'; },
}));

vi.mock('../../../ui/Toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
  );
}

describe('EventSettingsForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with event data once loaded', async () => {
    renderWithProviders(<EventSettingsForm eventId="evt1" />);
    await waitFor(() => {
      expect(screen.getByLabelText('Event Title')).toBeTruthy();
    });
    const titleInput = screen.getByLabelText('Event Title') as HTMLInputElement;
    expect(titleInput.value).toBe('Smith Wedding');
  });

  it('renders date fields', async () => {
    renderWithProviders(<EventSettingsForm eventId="evt1" />);
    await waitFor(() => {
      expect(screen.getByLabelText('Start Date')).toBeTruthy();
      expect(screen.getByLabelText('End Date')).toBeTruthy();
    });
  });

  it('renders guest count and budget fields', async () => {
    renderWithProviders(<EventSettingsForm eventId="evt1" />);
    await waitFor(() => {
      expect(screen.getByLabelText('Expected Guest Count')).toBeTruthy();
      expect(screen.getByLabelText('Budget')).toBeTruthy();
    });
  });

  it('shows the danger zone with delete button', async () => {
    renderWithProviders(<EventSettingsForm eventId="evt1" />);
    await waitFor(() => {
      expect(screen.getByText('Danger Zone')).toBeTruthy();
      expect(screen.getByText('Delete Event')).toBeTruthy();
    });
  });

  it('shows save bar when form is dirty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EventSettingsForm eventId="evt1" />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Event Title')).toBeTruthy();
    });

    const titleInput = screen.getByLabelText('Event Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'New Title');

    await waitFor(() => {
      expect(screen.getByText('You have unsaved changes')).toBeTruthy();
      expect(screen.getByText('Save Changes')).toBeTruthy();
      expect(screen.getByText('Discard')).toBeTruthy();
    });
  });

  it('budget converts dollars to cents correctly', async () => {
    renderWithProviders(<EventSettingsForm eventId="evt1" />);
    await waitFor(() => {
      const budgetInput = screen.getByLabelText('Budget') as HTMLInputElement;
      // 2500000 cents = $25,000
      expect(budgetInput.value).toBe('25000');
    });
  });
});
