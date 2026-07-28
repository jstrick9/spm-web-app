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
  it('creates a measured reception scaffold with dimensions, units, footprint, and operational features', async () => {
    render(wrap(<VenueSpaceScaffoldWizard orgId="org-1" onSelectVenue={vi.fn()} />));
    await userEvent.click(screen.getByRole('button', { name: /Measure the space/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(screen.getByLabelText('Emergency exit'));
    await userEvent.click(screen.getByLabelText('Accessible route'));
    await userEvent.click(screen.getByLabelText('Power / cable point'));
    await userEvent.click(screen.getByLabelText('Service / loading entry'));
    await userEvent.click(screen.getByRole('button', { name: /Review setup/i }));
    await userEvent.click(screen.getByRole('button', { name: /Create draft scaffold/i }));
    expect(mocks.create).toHaveBeenCalledWith('org-1', expect.objectContaining({ templateKey: 'custom', width: 80, height: 60, capacity: 120, unitSystem: 'imperial', approvalStatus: 'draft', shape: expect.objectContaining({ kind: 'rectangle' }) }));
    expect(mocks.create.mock.calls[0][1].masterLayout.zones.map((zone: any) => zone.type)).toEqual(expect.arrayContaining(['exit', 'accessible_route', 'power', 'loading']));
  });
});
