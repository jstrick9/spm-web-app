import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';
import { VenueSpaceScaffoldWizard } from './VenueSpaceScaffoldWizard';

const mocks = vi.hoisted(() => ({ create: vi.fn().mockResolvedValue({ venue: { id: 'venue-1', name: 'Reception', width: 80, height: 60, capacity: 120 } }) }));
vi.mock('../../../sdk/venues', () => ({ venuesSdk: { list: vi.fn().mockResolvedValue({ venues: [] }), create: mocks.create, update: vi.fn(), uploadUnderlay: vi.fn() } }));
function wrap(ui: React.ReactNode) { return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ToastProvider>{ui}</ToastProvider></QueryClientProvider>; }
describe('VenueSpaceScaffoldWizard', () => {
  it('creates a reception scaffold with dimensions, units, capacity, and template', async () => {
    const selected = vi.fn(); render(wrap(<VenueSpaceScaffoldWizard orgId="org-1" onSelectVenue={selected} />));
    await userEvent.click(screen.getByRole('button', { name: /Reception/i }));
    await userEvent.click(screen.getByRole('button', { name: /Create draft scaffold/i }));
    expect(mocks.create).toHaveBeenCalledWith('org-1', expect.objectContaining({ templateKey: 'reception', width: 80, height: 60, capacity: 120, unitSystem: 'imperial', approvalStatus: 'draft' }));
  });
});
