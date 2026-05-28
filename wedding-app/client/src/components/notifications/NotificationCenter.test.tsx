import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NotificationCenter } from './NotificationCenter';

describe('NotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens and displays simulated alerts', async () => {
    render(<NotificationCenter />);
    
    // Check bell badge initially visible
    const bellBtn = screen.getByRole('button', { name: /Notifications/i });
    expect(bellBtn).toBeInTheDocument();
    
    // Open panel
    fireEvent.click(bellBtn);
    
    // Check titles map correctly
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('RSVP Deadline Warning')).toBeInTheDocument();
    expect(screen.getByText('Vendor COI Missing')).toBeInTheDocument();
    expect(screen.getByText('Task Escalation')).toBeInTheDocument();
    
    // 2 new unread
    expect(screen.getByText('2 New')).toBeInTheDocument();

    // Mark all read
    const markReadBtn = screen.getByTitle('Mark all read');
    fireEvent.click(markReadBtn);
    
    // Badge disappears
    await waitFor(() => {
       expect(screen.queryByText('2 New')).not.toBeInTheDocument();
    });

    // Clear all
    const clearBtn = screen.getByTitle('Clear all');
    fireEvent.click(clearBtn);

    // List goes empty
    await waitFor(() => {
       expect(screen.queryByText('RSVP Deadline Warning')).not.toBeInTheDocument();
    });
  });
});
