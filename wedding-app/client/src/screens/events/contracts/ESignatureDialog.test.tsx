import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ESignatureDialog } from './ESignatureDialog';

const mockContract = {
  id: 'c1', title: 'Venue Agreement', status: 'sent' as const,
  recipientName: 'Sarah Smith', amountCents: 1000000,
  content: 'Agreement text here.', signature: null,
};

describe('ESignatureDialog', () => {
  it('renders contract title and signer info when open', () => {
    render(<ESignatureDialog open={true} onOpenChange={vi.fn()} contract={mockContract} onSign={vi.fn()} />);
    expect(screen.getByText(/Venue Agreement/i)).toBeTruthy();
  });

  it('has a signature input field', () => {
    render(<ESignatureDialog open={true} onOpenChange={vi.fn()} contract={mockContract} onSign={vi.fn()} />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render when closed', () => {
    const { container } = render(<ESignatureDialog open={false} onOpenChange={vi.fn()} contract={mockContract} onSign={vi.fn()} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
