import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App login gate', () => {
  it('renders login screen when there is no active session', () => {
    localStorage.removeItem('spm_session');
    render(<App />);

    expect(screen.getByRole('heading', { name: /seven paths manor/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(document.querySelector('input[type="password"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });
});
