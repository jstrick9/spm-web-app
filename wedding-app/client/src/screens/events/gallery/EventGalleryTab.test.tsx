import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventGalleryTab } from './EventGalleryTab';
import { ToastProvider } from '../../../ui/Toast';

describe('EventGalleryTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders gallery sidebar and categories', () => {
    render(<ToastProvider><EventGalleryTab eventId="test-event" /></ToastProvider>);
    
    expect(screen.getByText('Photo & Mood Board Gallery')).toBeInTheDocument();
    
    // Check categories load
    expect(screen.getByRole('button', { name: /All Photos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /florals/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /linens/i })).toBeInTheDocument();
    
    // Check initial sample images render
    expect(screen.getByText('2')).toBeInTheDocument(); // All photos count
  });

  it('filters by category', () => {
    render(<ToastProvider><EventGalleryTab eventId="test-event" /></ToastProvider>);
    
    const filterBtn = screen.getByRole('button', { name: /lighting/i });
    fireEvent.click(filterBtn);
    
    expect(screen.getByText('No photos in this category')).toBeInTheDocument();
  });
});
