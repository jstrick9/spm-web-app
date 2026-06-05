
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
