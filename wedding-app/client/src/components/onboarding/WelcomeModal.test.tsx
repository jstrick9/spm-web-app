import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WelcomeModal } from './WelcomeModal';

describe('WelcomeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders onboarding and allows navigation', () => {
    // Should render for owner mapping all slides
    render(<WelcomeModal memberships={[{ roleKey: 'owner' } as any]} onComplete={vi.fn()} />);
    
    expect(screen.getByText('Welcome to the WVI Platform')).toBeInTheDocument();
    
    // Test navigation
    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);
    
    expect(screen.getByText('Interactive Floor Plans')).toBeInTheDocument();
  });
  
  it('filters slides based on role', () => {
    render(<WelcomeModal memberships={[{ roleKey: 'vendor' } as any]} onComplete={vi.fn()} />);
    
    // Vendors should not see the "Interactive Floor Plans" screen
    expect(screen.queryByText('Interactive Floor Plans')).not.toBeInTheDocument();
  });
});
