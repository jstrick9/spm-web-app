import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NotificationCenter } from './NotificationCenter';

// Mock router
vi.mock('../../lib/router', () => ({
  useRouter: () => ({ navigate: vi.fn() }),
}));

describe('NotificationCenter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the bell icon button', () => {
    render(<NotificationCenter />);
    expect(screen.getByRole('button', { name: /Notifications/i })).toBeTruthy();
  });

  it('opens dropdown on click', () => {
    render(<NotificationCenter />);
    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }));
    expect(screen.getByText('Notifications')).toBeTruthy();
    expect(screen.getByText(/No notifications yet/)).toBeTruthy();
  });

  it('shows notification when SSE event fires', () => {
    render(<NotificationCenter />);

    // Open the dropdown first
    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }));

    // Fire SSE event
    act(() => {
      window.dispatchEvent(new CustomEvent('wvi:sse-event', {
        detail: {
          id: 42,
          type: 'guest.created',
          payload: { name: 'Alice', eventId: 'e1' },
          actorUserId: 'u1',
          timestamp: new Date().toISOString(),
        },
      }));
    });

    expect(screen.getByText('New Guest Added')).toBeTruthy();
    expect(screen.getByText(/Alice was added/)).toBeTruthy();
  });

  it('shows unread badge count', () => {
    render(<NotificationCenter />);

    // Fire events
    act(() => {
      window.dispatchEvent(new CustomEvent('wvi:sse-event', {
        detail: { id: 1, type: 'event.created', payload: { title: 'Test' }, actorUserId: null, timestamp: new Date().toISOString() },
      }));
      window.dispatchEvent(new CustomEvent('wvi:sse-event', {
        detail: { id: 2, type: 'rsvp.submitted', payload: { attending: true, eventId: 'e1' }, actorUserId: null, timestamp: new Date().toISOString() },
      }));
    });

    // Badge should show "2"
    const badge = screen.getByText('2');
    expect(badge).toBeTruthy();
  });

  it('mark all read clears unread badge', () => {
    render(<NotificationCenter />);

    act(() => {
      window.dispatchEvent(new CustomEvent('wvi:sse-event', {
        detail: { id: 10, type: 'event.created', payload: { title: 'W' }, actorUserId: null, timestamp: new Date().toISOString() },
      }));
    });

    fireEvent.click(screen.getByRole('button', { name: /Notifications/i }));
    fireEvent.click(screen.getByText('Mark all read'));

    // Badge should be gone
    expect(screen.queryByText('1')).toBeNull();
  });
});
