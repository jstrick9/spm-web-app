import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FormField } from './FormField';
import { Input } from './Input';

describe('FormField', () => {
  it('wires the label to the control by id', () => {
    render(
      <FormField label="Venue name" htmlFor="venue-name">
        <Input id="venue-name" value="" onChange={() => {}} />
      </FormField>,
    );
    expect(screen.getByLabelText('Venue name')).toBeTruthy();
  });

  it('marks required fields and sets aria-required on the control', () => {
    render(
      <FormField label="Guest email" htmlFor="guest-email" required>
        <Input id="guest-email" value="" onChange={() => {}} aria-required />
      </FormField>,
    );
    expect(screen.getByText('*')).toBeTruthy();
    expect(screen.getByLabelText(/guest email/i).getAttribute('aria-required')).toBe('true');
  });

  it('renders an accessible validation error via aria-describedby + role=alert', () => {
    render(
      <FormField label="Amount" htmlFor="amount" error="Enter an amount greater than zero.">
        <Input id="amount" value="0" onChange={() => {}} aria-describedby="amount-description" aria-invalid />
      </FormField>,
    );
    const error = screen.getByRole('alert');
    expect(error.textContent).toBe('Enter an amount greater than zero.');
    expect(error.id).toBe('amount-description');
    expect(screen.getByLabelText('Amount').getAttribute('aria-invalid')).toBe('true');
  });

  it('renders a hint when no error is present', () => {
    render(
      <FormField label="Date" htmlFor="date" hint="Use YYYY-MM-DD.">
        <Input id="date" value="" onChange={() => {}} aria-describedby="date-description" />
      </FormField>,
    );
    expect(screen.getByText('Use YYYY-MM-DD.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
