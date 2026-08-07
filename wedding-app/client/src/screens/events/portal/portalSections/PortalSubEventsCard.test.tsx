import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PortalSubEventsCard } from './PortalSubEventsCard';

const updateMutation = { mutate: vi.fn(), isPending: false };

describe('PortalSubEventsCard — sub-event creation (regression: create was impossible from the UI)', () => {
  it('offers a creation form when the create mutation is wired', () => {
    render(<PortalSubEventsCard isLoading={false} subEvents={[]} updateSubEventMutation={updateMutation} createSubEventMutation={{ mutate: vi.fn(), isPending: false }} />);
    expect(screen.getByText(/Add a sub-event/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add sub-event' })).toBeDisabled();
  });

  it('creates the sub-event with title, start time, and invite-only flag', () => {
    const create = vi.fn();
    render(<PortalSubEventsCard isLoading={false} subEvents={[]} updateSubEventMutation={updateMutation} createSubEventMutation={{ mutate: create, isPending: false }} />);
    fireEvent.change(screen.getByLabelText('Sub-event title'), { target: { value: 'Rehearsal dinner' } });
    fireEvent.change(screen.getByLabelText('Sub-event start time'), { target: { value: '2026-09-11T17:30' } });
    fireEvent.click(screen.getByLabelText('Invite-only'));
    fireEvent.click(screen.getByRole('button', { name: 'Add sub-event' }));
    expect(create).toHaveBeenCalledWith({ title: 'Rehearsal dinner', startsAt: '2026-09-11T17:30', inviteOnly: true });
  });

  it('does not create without a title or start time', () => {
    const create = vi.fn();
    render(<PortalSubEventsCard isLoading={false} subEvents={[]} updateSubEventMutation={updateMutation} createSubEventMutation={{ mutate: create, isPending: false }} />);
    fireEvent.change(screen.getByLabelText('Sub-event title'), { target: { value: 'Brunch' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add sub-event' }));
    expect(create).not.toHaveBeenCalled();
  });

  it('falls back to the legacy empty state when the create mutation is absent', () => {
    render(<PortalSubEventsCard isLoading={false} subEvents={[]} updateSubEventMutation={updateMutation} />);
    expect(screen.queryByText(/Add a sub-event/i)).not.toBeInTheDocument();
    expect(screen.getByText(/No sub-events created yet/i)).toBeInTheDocument();
  });

  it('renders existing sub-events with editable guest-facing fields', () => {
    render(
      <PortalSubEventsCard
        isLoading={false}
        subEvents={[{ id: 's1', title: 'Welcome Party', starts_at: '2026-09-11T18:00:00', invite_only: false, metadata: '{}' }]}
        updateSubEventMutation={updateMutation}
        createSubEventMutation={{ mutate: vi.fn(), isPending: false }}
      />,
    );
    expect(screen.getByText('Welcome Party')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Location/address')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));
    expect(updateMutation.mutate).toHaveBeenCalledWith({ id: 's1', metadata: expect.any(Object) });
  });
});
