import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContractPrintView } from './ContractPrintView';

const mockContract = {
  id: 'c1', title: 'Venue Agreement', recipientName: 'Sarah Smith',
  amountCents: 1000000, content: 'Agreement text here.', signature: 'Sarah Smith',
  sentAt: '2026-09-01', signedAt: '2026-09-05',
};

const mockEvent = {
  id: 'e1', title: 'Smith Wedding', start_date: '2026-09-12',
};

describe('ContractPrintView', () => {
  it('renders contract title', () => {
    render(<ContractPrintView contract={mockContract} event={mockEvent} venueName="Seven Paths Manor" />);
    expect(screen.getByText('Venue Agreement')).toBeTruthy();
  });

  it('renders venue name', () => {
    render(<ContractPrintView contract={mockContract} event={mockEvent} venueName="Seven Paths Manor" />);
    expect(screen.getByText(/Seven Paths Manor/)).toBeTruthy();
  });

  it('renders recipient name', () => {
    render(<ContractPrintView contract={mockContract} event={mockEvent} venueName="Seven Paths Manor" />);
    expect(screen.getByText(/Sarah Smith/)).toBeTruthy();
  });
});
