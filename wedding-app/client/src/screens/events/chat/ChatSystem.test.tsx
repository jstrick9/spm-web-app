
// Mock IndexedDB
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { render, screen, fireEvent } from '@testing-library/react';
import { ChatSystem } from './ChatSystem';

describe('ChatSystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUser = {
    id: 'u1',
    email: 'test@demo.com',
    fullName: 'Test User'
  };

  it('renders chat interface and categories', () => {
    render(<ChatSystem eventId="evt-1" currentUser={mockUser} />);
    
    expect(screen.getByText(/Event Communications/i)).toBeInTheDocument();
    
    // Check categories
    expect(screen.getByRole('button', { name: /general/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /layout/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logistics/i })).toBeInTheDocument();
  });
  
  it('sends the sender\'s actual role, not a hardcoded label', async () => {
    // Capture the POST body by stubbing fetch (handleSend is server-first).
    const captured: Array<{ url: string; body: string }> = [];
    const origFetch = globalThis.fetch;
    (globalThis as any).fetch = async (url: any, init?: any) => {
      if (init?.method === 'POST') {
        captured.push({ url: String(url), body: String(init.body) });
        return { ok: true, status: 200, text: async () => JSON.stringify({ message: { id: 'm-1' } }), json: async () => ({ message: { id: 'm-1' } }) } as Response;
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ messages: [], unread: 0 }), json: async () => ({ messages: [], unread: 0 }) } as Response;
    };
    try {
      render(<ChatSystem eventId="evt-1" currentUser={mockUser} senderRole="owner" />);
      const input = screen.getByPlaceholderText(/Message #general.../i);
      fireEvent.change(input, { target: { value: 'Hello from the owner!' } });
      const form = screen.getByPlaceholderText(/Message #general.../i).closest('form');
      fireEvent.submit(form!);
      await screen.findByText('Hello from the owner!');
      await new Promise((r) => setTimeout(r, 50));
      const post = captured.find((c) => c.url.includes('/api/messages/'));
      expect(post).toBeTruthy();
      expect(JSON.parse(post!.body).senderRole).toBe('owner');
    } finally {
      (globalThis as any).fetch = origFetch;
    }
  });

  it('allows sending a message', async () => {
    render(<ChatSystem eventId="evt-1" currentUser={mockUser} />);
    
    const input = screen.getByPlaceholderText(/Message #general.../i);
    fireEvent.change(input, { target: { value: 'Hello world!' } });
    
    // const sendBtn = screen.getByRole('button', { name: /Send/i });
    
    
    // trigger form submit by mocking the event directly
    const form = screen.getByPlaceholderText(/Message #general.../i).closest('form');
    fireEvent.submit(form!);
    
    expect(await screen.findByText('Hello world!')).toBeInTheDocument();
    // expect(screen.getByText('Test User •', { exact: false })).toBeInTheDocument();
  });
});
