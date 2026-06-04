import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StaffOperationsPanel from './StaffOperationsPanel';

describe('StaffOperationsPanel access guard', () => {
  it('shows access denied for unauthorized users', () => {
    render(
      <StaffOperationsPanel
        onClose={() => undefined}
        currentUser={{
          id: 'u1',
          username: 'guest-user',
          role: 'guest',
          name: 'Guest User',
          isActive: true,
          createdAt: new Date().toISOString(),
        } as any}
        isAdmin={false}
        venueId="v1"
        eventName="Test Event"
        users={[] as any}
        venues={[] as any}
      />,
    );

    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    expect(
      screen.getByText(/you do not have permission to access staff operations/i),
    ).toBeInTheDocument();
  });
});