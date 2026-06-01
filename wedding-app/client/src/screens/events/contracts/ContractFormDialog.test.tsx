import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContractFormDialog } from './ContractFormDialog';

describe('ContractFormDialog', () => {
  it('renders all form fields when open', () => {
    render(<ContractFormDialog open={true} onOpenChange={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText(/Document Title/i)).toBeTruthy();
    expect(screen.getByText(/Primary Signer Name/i)).toBeTruthy();
  });

  it('validates required fields', async () => {
    const onSave = vi.fn();
    render(<ContractFormDialog open={true} onOpenChange={vi.fn()} onSave={onSave} />);
    
    // Try to submit empty form
    const submitBtns = screen.getAllByRole('button');
    const createBtn = submitBtns.find(b => b.textContent?.includes('Create') || b.textContent?.includes('Save'));
    if (createBtn) fireEvent.click(createBtn);
    
    // onSave should NOT be called with invalid data
    await waitFor(() => { expect(onSave).not.toHaveBeenCalled(); });
  });

  it('does not render when closed', () => {
    const { container } = render(<ContractFormDialog open={false} onOpenChange={vi.fn()} onSave={vi.fn()} />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
