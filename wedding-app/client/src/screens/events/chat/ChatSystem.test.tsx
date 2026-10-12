// Mock IndexedDB
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatSystem } from './ChatSystem';

const mockUser = { id: 'u1', email: 'test@demo.com', fullName: 'Test User' };

function response(body: unknown): Response {
  return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body } as Response;
}

describe('ChatSystem', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    // Every render performs an initial GET; use one predictable mock for both
    // loading and posting so the optimistic-send assertion is never dependent
    // on the environment's native fetch implementation.
    globalThis.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') return response({ message: { id: 'm-1' } });
      return response({ messages: [], unread: 0 });
    }) as typeof fetch;
  });

  afterEach(() => { globalThis.fetch = originalFetch; });

  it('renders chat interface and categories', () => {
    render(<ChatSystem eventId="evt-1" currentUser={mockUser} />);
    expect(screen.getByText(/Event Communications/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /general/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /layout/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logistics/i })).toBeInTheDocument();
  });

  it('sends the sender’s actual role, not a hardcoded label', async () => {
    render(<ChatSystem eventId="evt-1" currentUser={mockUser} senderRole="owner" />);
    const input = screen.getByPlaceholderText(/Message #general.../i);
    fireEvent.change(input, { target: { value: 'Hello from the owner!' } });
    fireEvent.submit(input.closest('form')!);

    expect(await screen.findByText('Hello from the owner!')).toBeInTheDocument();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/messages/'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ body: 'Hello from the owner!', senderRole: 'owner' }) }),
    ));
  });

  it('shows an optimistic message while the server request resolves', async () => {
    render(<ChatSystem eventId="evt-1" currentUser={mockUser} />);
    const input = screen.getByPlaceholderText(/Message #general.../i);
    fireEvent.change(input, { target: { value: 'Hello world!' } });
    fireEvent.submit(input.closest('form')!);

    expect(await screen.findByText('Hello world!')).toBeInTheDocument();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/messages/'), expect.objectContaining({ method: 'POST' }),
    ));
  });
});
